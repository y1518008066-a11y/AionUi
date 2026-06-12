/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Runtime — Module Entry
 */

export { AgentRuntime } from './runtime';
export { AgentSessionManager } from './session';
export { ConversationHistory } from './history';

// Tool calling provider (production)
export {
  ToolCallingProvider,
  createLMStudioProvider,
  createOpenAIProvider,
  toOpenAITools,
  toOpenAIMessages,
  parseToolCalls,
} from './tool-provider';

export type {
  AgentStatus,
  AgentToolDefinition,
  AgentToolCall,
  AgentToolResult,
  AgentObservation,
  AgentMessageRole,
  AgentMessage,
  AgentConfig,
  AgentSessionId,
  AgentSession,
  LLMResponse,
  LLMProvider,
  AgentDiagnostics,
  AgentSessionSummary,
} from './types';

export type { ToolCallingProviderConfig } from './tool-provider';

export { DEFAULT_AGENT_CONFIG } from './types';