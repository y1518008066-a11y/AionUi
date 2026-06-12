/**
 * AI Router Layer — DualRoutingStrategy
 *
 * 双路由策略：根据任务复杂度自动分流
 * - 简单/隐私任务 → 本地模型（LM Studio / Ollama 等，免费离线）
 * - 复杂/专业任务 → 云端模型（DeepSeek / OpenAI 等）
 *
 * 判断规则（按优先级）：
 * 1. 用户显式指定了 providerId → 直接用指定的
 * 2. 消息包含隐私敏感关键词 → 本地
 * 3. 消息很短（≤ 简单阈值） → 本地
 * 4. 消息很长或包含复杂任务关键词 → 云端
 * 5. 默认 → 本地（隐私优先）
 *
 * 集成方式：纯新增文件，不修改任何现有代码。
 * 在 strategy.ts 工厂函数中添加 case 即可启用。
 */

import type { IProvider } from '../jarvis-core/interfaces';
import type { RoutingContext, RoutingDecision } from './types';
import type { IRoutingStrategy } from './strategy';

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

/** 本地 provider 的类型标识 */
const LOCAL_PROVIDER_TYPES = new Set(['lmstudio', 'ollama', 'vllm', 'localai', 'custom']);

/** 云端 provider 的类型标识 */
const CLOUD_PROVIDER_TYPES = new Set(['openai', 'deepseek', 'openai-compatible', 'manual']);

/**
 * 简单任务的字符数阈值。
 * 用户消息总长度低于此值 → 本地处理。
 */
const SIMPLE_LENGTH_THRESHOLD = 200;

/**
 * 复杂任务的字符数阈值。
 * 用户消息总长度超过此值 → 云端处理。
 */
const COMPLEX_LENGTH_THRESHOLD = 800;

/**
 * 隐私敏感关键词。
 * 消息包含任一关键词 → 强制走本地。
 */
const PRIVACY_KEYWORDS = [
  '密码', 'password', '密钥', 'secret', 'token', 'api key',
  '身份证', '手机号', '银行卡', '地址', '私钥',
  'private', 'confidential', 'credential',
];

/**
 * 复杂任务关键词。
 * 消息包含任一关键词 → 优先走云端。
 */
const COMPLEX_KEYWORDS = [
  '分析', '总结', '翻译', '写代码', '解释', '优化',
  '重构', '设计', '架构', '审查', 'review',
  'analyze', 'summarize', 'translate', 'explain', 'refactor',
  'optimize', 'architecture', 'design pattern',
];

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/** 提取消息中的纯文本内容 */
function extractText(messages: RoutingContext['request']['messages']): string {
  let text = '';
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      text += msg.content + ' ';
    }
  }
  return text.trim().toLowerCase();
}

/** 判断 provider 是否为本地类型 */
function isLocalProvider(p: IProvider): boolean {
  // 1. 通过协议判断（lmstudio 用的 openai 协议，需要额外判断）
  // 2. 通过 endpoint 判断（localhost / 127.0.0.1）
  const url = (p.baseUrl || '').toLowerCase();
  if (url.includes('127.0.0.1') || url.includes('localhost') || url.includes('192.168.')) {
    return true;
  }
  // 3. 通过 id/name 模糊匹配
  const id = (p.id || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  if (id.includes('local') || id.includes('lmstudio') || id.includes('ollama')) return true;
  if (name.includes('自定义') || name.includes('本地') || name.includes('local')) return true;
  return false;
}

/** 判断 provider 是否为云端类型 */
function isCloudProvider(p: IProvider): boolean {
  if (isLocalProvider(p)) return false;
  const url = (p.baseUrl || '').toLowerCase();
  if (url.includes('api.openai.com') || url.includes('api.anthropic.com') ||
      url.includes('generativelanguage.googleapis.com') || url.includes('openrouter.ai') ||
      url.includes('api.deepseek.com')) {
    return true;
  }
  const id = (p.id || '').toLowerCase();
  if (id.includes('cloud') || id.includes('openai') || id.includes('deepseek') ||
      id.includes('gemini') || id.includes('claude')) return true;
  return false;
}

/** 检查文本是否包含任一关键词 */
function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

// ---------------------------------------------------------------------------
// 策略实现
// ---------------------------------------------------------------------------

const createDualRoutingStrategy = (): IRoutingStrategy => ({
  name: 'dual',

  select(context: RoutingContext): RoutingDecision | null {
    const enabled = context.providers.filter((p) => p.enabled);
    if (enabled.length === 0) return null;

    // 1. 用户显式指定 → 直接用
    if (context.request.providerId) {
      const specified = enabled.find((p) => p.id === context.request.providerId);
      if (specified) {
        return {
          provider: specified,
          model: context.request.model || 'default',
          reason: '[双路由] 用户指定: ' + specified.name,
        };
      }
    }

    // 分离本地和云端 provider
    const localProviders = enabled.filter(isLocalProvider);
    const cloudProviders = enabled.filter(isCloudProvider);

    // 如果只有一种类型 → 直接用
    if (localProviders.length === 0) {
      const p = cloudProviders[0] || enabled[0];
      return {
        provider: p,
        model: context.request.model || 'default',
        reason: '[双路由] 仅云端可用: ' + p.name,
      };
    }
    if (cloudProviders.length === 0) {
      const p = localProviders[0];
      return {
        provider: p,
        model: context.request.model || 'default',
        reason: '[双路由] 仅本地可用: ' + p.name,
      };
    }

    // 提取消息文本
    const text = extractText(context.request.messages);

    // 2. 隐私关键词 → 强制本地
    if (containsAny(text, PRIVACY_KEYWORDS)) {
      const p = localProviders[0];
      return {
        provider: p,
        model: context.request.model || 'default',
        reason: '[双路由] 隐私保护 → 本地: ' + p.name,
      };
    }

    // 3. 超短消息 → 本地
    if (text.length <= SIMPLE_LENGTH_THRESHOLD) {
      const p = localProviders[0];
      return {
        provider: p,
        model: context.request.model || 'default',
        reason: '[双路由] 简单任务(' + text.length + '字) → 本地: ' + p.name,
      };
    }

    // 4. 复杂关键词 或 长消息 → 云端
    if (containsAny(text, COMPLEX_KEYWORDS) || text.length >= COMPLEX_LENGTH_THRESHOLD) {
      const p = cloudProviders[0];
      return {
        provider: p,
        model: context.request.model || 'default',
        reason: '[双路由] 复杂任务(' + text.length + '字) → 云端: ' + p.name,
      };
    }

    // 5. 默认 → 本地（隐私优先）
    const p = localProviders[0];
    return {
      provider: p,
      model: context.request.model || 'default',
      reason: '[双路由] 默认本地(隐私优先): ' + p.name,
    };
  },
});

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------

export { createDualRoutingStrategy };
