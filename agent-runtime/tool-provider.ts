/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Runtime — Tool Calling Provider
 *
 * Production implementation of LLMProvider for OpenAI-compatible APIs
 * (LM Studio, OpenAI, NewAPI, etc.).
 *
 * Converts AgentToolDefinition[] to OpenAI tool schema, sends requests,
 * parses tool_calls from responses, and handles streaming + non-streaming.
 */

import type {
  AgentMessage,
  AgentToolDefinition,
  AgentToolCall,
  LLMResponse,
  LLMProvider,
} from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

type ToolCallingProviderConfig = {
  /** Base URL for the API (e.g. http://127.0.0.1:1234/v1). */
  baseUrl: string;

  /** API key (empty string for LM Studio local). */
  apiKey?: string;

  /** Default model to use. */
  model: string;

  /** Request timeout in milliseconds. */
  timeoutMs: number;

  /** Whether to use streaming responses. */
  streaming: boolean;
};

const DEFAULT_CONFIG: ToolCallingProviderConfig = {
  baseUrl: 'http://127.0.0.1:1234/v1',
  apiKey: '',
  model: 'auto',
  timeoutMs: 60000,
  streaming: false,
};

// ---------------------------------------------------------------------------
// OpenAI-compatible schema conversion
// ---------------------------------------------------------------------------

/**
 * Convert AgentToolDefinition[] to OpenAI tool schema.
 */
function toOpenAITools(tools: AgentToolDefinition[]): Record<string, unknown>[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Parse OpenAI tool_calls into AgentToolCall[].
 */
function parseToolCalls(
  toolCalls: Array<{
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }> = []
): AgentToolCall[] {
  return toolCalls
    .filter((tc) => tc.type === 'function' || tc.function)
    .map((tc, i) => {
      let args: Record<string, unknown> = {};
      const rawArgs = tc.function?.arguments || '{}';
      try {
        args = JSON.parse(rawArgs);
      } catch {
        args = { _raw: rawArgs };
      }

      return {
        id: tc.id || 'call_' + i + '_' + Date.now(),
        name: tc.function?.name || 'unknown',
        arguments: args,
      };
    });
}

/**
 * Convert AgentMessage[] to OpenAI message format.
 */
function toOpenAIMessages(
  messages: AgentMessage[]
): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    const openaiMsg: Record<string, unknown> = {
      role: msg.role,
    };

    if (msg.role === 'tool') {
      openaiMsg.tool_call_id = msg.toolCallId;
      openaiMsg.content = msg.content;
    } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      openaiMsg.content = msg.content || null;
      openaiMsg.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    } else {
      openaiMsg.content = msg.content;
    }

    return openaiMsg;
  });
}

// ---------------------------------------------------------------------------
// Tool Calling Provider
// ---------------------------------------------------------------------------

class ToolCallingProvider implements LLMProvider {
  private config: ToolCallingProviderConfig;

  constructor(config: Partial<ToolCallingProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update configuration at runtime.
   */
  updateConfig(partial: Partial<ToolCallingProviderConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Send chat completion request with tools.
   */
  async chat(params: {
    messages: AgentMessage[];
    tools: AgentToolDefinition[];
    model: string;
    temperature: number;
    maxTokens: number;
    signal: AbortSignal;
  }): Promise<LLMResponse> {
    const t0 = performance.now();

    const model = params.model === 'auto' ? this.config.model : params.model;
    const openaiMessages = toOpenAIMessages(params.messages);
    const openaiTools = params.tools.length > 0 ? toOpenAITools(params.tools) : undefined;

    const body: Record<string, unknown> = {
      model,
      messages: openaiMessages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream: false,
    };

    if (openaiTools) {
      body.tools = openaiTools;
      body.tool_choice = 'auto';
    }

    console.log(
      '[ToolCallingProvider] Request | Model: ' + model +
      ' | Messages: ' + openaiMessages.length +
      ' | Tools: ' + (openaiTools ? openaiTools.length : 0) +
      ' | Max tokens: ' + params.maxTokens
    );

    try {
      const response = await this.fetchWithTimeout(
        this.config.baseUrl + '/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey ? { Authorization: 'Bearer ' + this.config.apiKey } : {}),
          },
          body: JSON.stringify(body),
          signal: params.signal,
        },
        this.config.timeoutMs
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(
          'HTTP ' + response.status + ' ' + response.statusText +
          (errText ? ': ' + errText.substring(0, 300) : '')
        );
      }

      const data = await response.json() as {
        choices?: Array<{
          finish_reason?: string;
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id?: string;
              type?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const choice = data.choices?.[0];
      const finishReason = (choice?.finish_reason || 'stop') as LLMResponse['finishReason'];
      const content = choice?.message?.content || null;
      const rawToolCalls = choice?.message?.tool_calls || [];
      const toolCalls = parseToolCalls(rawToolCalls);

      const latencyMs = Math.round(performance.now() - t0);

      console.log(
        '[ToolCallingProvider] Response | Content: ' + (content ? content.length + ' chars' : 'null') +
        ' | Tool calls: ' + toolCalls.length +
        ' | Finish: ' + finishReason +
        ' | Latency: ' + latencyMs + 'ms'
      );

      return {
        content,
        toolCalls,
        finishReason,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - t0);

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Request aborted after ' + latencyMs + 'ms.');
      }

      console.error('[ToolCallingProvider] Error:', err);
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private async fetchWithTimeout(
    url: string,
    options: RequestInit & { timeoutMs?: number },
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Link external signal
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a ToolCallingProvider configured for LM Studio (local).
 */
function createLMStudioProvider(model?: string): ToolCallingProvider {
  return new ToolCallingProvider({
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: model || 'auto',
    timeoutMs: 60000,
  });
}

/**
 * Create a ToolCallingProvider configured for OpenAI.
 */
function createOpenAIProvider(apiKey: string, model?: string): ToolCallingProvider {
  return new ToolCallingProvider({
    baseUrl: 'https://api.openai.com/v1',
    apiKey,
    model: model || 'gpt-4o',
    timeoutMs: 60000,
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  ToolCallingProvider,
  createLMStudioProvider,
  createOpenAIProvider,
  toOpenAITools,
  toOpenAIMessages,
  parseToolCalls,
};

export type { ToolCallingProviderConfig };