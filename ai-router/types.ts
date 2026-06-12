/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AI Router Layer — Type Definitions
 *
 * Defines the request/response contracts for the unified AI routing layer.
 * All types depend only on jarvis-core interfaces — no provider-specific
 * dependencies.
 */

import type { IProvider, EventHandler } from '../jarvis-core/interfaces';

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/** Role of a message participant. */
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A single message in a conversation. */
type ChatMessage = {
  role: MessageRole;
  content: string;
  /** Optional tool call results. */
  toolCalls?: ToolCall[];
  /** Optional tool results from previous calls. */
  toolResults?: ToolResult[];
};

/** A tool/function call requested by the AI. */
type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

/** Result of a tool/function execution. */
type ToolResult = {
  toolCallId: string;
  name: string;
  result: unknown;
};

// ---------------------------------------------------------------------------
// Router request / response
// ---------------------------------------------------------------------------

/** Parameters for a router request. */
type RouterRequest = {
  /** The conversation messages to send. */
  messages: ChatMessage[];

  /** Provider id to use (optional — router may select automatically). */
  providerId?: string;

  /** Model name override (optional — uses provider default if not set). */
  model?: string;

  /** System prompt to prepend. */
  systemPrompt?: string;

  /** Maximum tokens for the response. */
  maxTokens?: number;

  /** Temperature for response generation. */
  temperature?: number;

  /** Tools/functions the AI may call. */
  tools?: ToolDefinition[];

  /** Arbitrary metadata passed through to the provider. */
  metadata?: Record<string, unknown>;
};

/** Definition of a tool/function the AI can call. */
type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** A standardised response from the router. */
type RouterResponse = {
  /** Unique id for this response. */
  id: string;

  /** The provider that generated this response. */
  providerId: string;

  /** The model used. */
  model: string;

  /** Text content of the response. */
  content: string;

  /** Tool calls the AI requested (if any). */
  toolCalls?: ToolCall[];

  /** Token usage statistics. */
  usage?: TokenUsage;

  /** Whether the response was stopped early (e.g. by a stop sequence). */
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';

  /** Timestamp when the request was sent. */
  timestamp: number;

  /** Latency in milliseconds. */
  latencyMs: number;
};

/** Token usage statistics. */
type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/** A chunk emitted during a streaming response. */
type StreamChunk = {
  /** Delta content since the last chunk. */
  content: string;

  /** Whether this is the final chunk. */
  done: boolean;

  /** Tool calls in this chunk (if any). */
  toolCalls?: ToolCall[];

  /** Token usage (only present in the final chunk). */
  usage?: TokenUsage;

  /** Finish reason (only present in the final chunk). */
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
};

// ---------------------------------------------------------------------------
// Router events
// ---------------------------------------------------------------------------

/** Events emitted by the AI Router. */
type RouterEvent =
  | {
      type: 'router:request';
      requestId: string;
      providerId: string;
      model: string;
      messageCount: number;
    }
  | {
      type: 'router:response';
      requestId: string;
      providerId: string;
      model: string;
      latencyMs: number;
      contentLength: number;
    }
  | {
      type: 'router:error';
      requestId: string;
      providerId: string;
      error: string;
    }
  | {
      type: 'router:provider:activated';
      providerId: string;
    }
  | {
      type: 'router:provider:deactivated';
      providerId: string;
    };

// ---------------------------------------------------------------------------
// Routing strategy
// ---------------------------------------------------------------------------

/** Criteria the routing strategy uses to select a provider. */
type RoutingContext = {
  /** The incoming request. */
  request: RouterRequest;

  /** All registered providers. */
  providers: IProvider[];

  /** The currently active provider id (may be null). */
  activeProviderId: string | null;

  /** The currently active mode id (may be null). */
  activeModeId: string | null;

  /** Mode overrides (from the active mode). */
  modeOverrides: Record<string, unknown>;
};

/** Result of provider selection. */
type RoutingDecision = {
  /** The selected provider. */
  provider: IProvider;

  /** The model to use. */
  model: string;

  /** Why this provider was selected (for observability). */
  reason: string;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  MessageRole,
  ChatMessage,
  ToolCall,
  ToolResult,
  RouterRequest,
  ToolDefinition,
  RouterResponse,
  TokenUsage,
  StreamChunk,
  RouterEvent,
  RoutingContext,
  RoutingDecision,
  EventHandler,
};
export type { IProvider };
