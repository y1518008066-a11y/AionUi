/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Runtime — Type Definitions
 *
 * Defines the session model, agent loop state, tool call / observation
 * pipeline, and diagnostic types for the Reason → Act → Observe loop.
 */

// ---------------------------------------------------------------------------
// Agent status
// ---------------------------------------------------------------------------

type AgentStatus =
  | 'idle'        // Not yet started
  | 'reasoning'   // Waiting for LLM response
  | 'acting'      // Executing tool calls
  | 'observing'   // Processing tool results
  | 'completed'   // Final answer delivered
  | 'error'       // Execution failed
  | 'cancelled'   // User cancelled
  | 'timeout';    // Max time exceeded

// ---------------------------------------------------------------------------
// Tool types
// ---------------------------------------------------------------------------

/** A tool definition exposed to the LLM. */
type AgentToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** A tool call requested by the LLM. */
type AgentToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

/** Result of executing a tool through the ActionEngine. */
type AgentToolResult = {
  toolCallId: string;
  name: string;
  success: boolean;
  result: unknown;
  error?: string;
  durationMs: number;
};

/** An observation fed back to the LLM after tool execution. */
type AgentObservation = {
  toolCallId: string;
  name: string;
  content: string; // JSON-stringified or text summary of the result
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/** Role of a message participant. */
type AgentMessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A message in the agent conversation. */
type AgentMessage = {
  role: AgentMessageRole;
  content: string;

  /** Tool calls made by the assistant (role=assistant). */
  toolCalls?: AgentToolCall[];

  /** Tool call id this message responds to (role=tool). */
  toolCallId?: string;

  /** Name of the tool this message responds to (role=tool). */
  name?: string;
};

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

type AgentConfig = {
  /** System prompt for the agent. */
  systemPrompt: string;

  /** Maximum iterations of the Reason → Act → Observe loop. */
  maxIterations: number;

  /** Overall timeout in milliseconds (0 = no timeout). */
  timeoutMs: number;

  /** Provider id to use (from provider registry). */
  providerId: string;

  /** Model name to use. */
  model: string;

  /** Temperature for response generation. */
  temperature: number;

  /** Maximum tokens per LLM call. */
  maxTokens: number;

  /** Available tools for the agent. */
  tools: AgentToolDefinition[];

  /** Whether to allow parallel tool calls. */
  allowParallelTools: boolean;
};

/** Default agent configuration. */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
  systemPrompt: 'You are a helpful AI assistant with access to tools. Use tools when needed to answer user questions.',
  maxIterations: 10,
  timeoutMs: 120000,
  providerId: 'lmstudio',
  model: 'auto',
  temperature: 0.7,
  maxTokens: 2048,
  tools: [],
  allowParallelTools: false,
};

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

type AgentSessionId = string;

/** Full state of an agent session. */
type AgentSession = {
  /** Unique session id. */
  id: AgentSessionId;

  /** Conversation history. */
  messages: AgentMessage[];

  /** Tool execution history. */
  toolHistory: AgentToolResult[];

  /** Observation history. */
  observations: AgentObservation[];

  /** Current iteration count. */
  iteration: number;

  /** Current agent status. */
  status: AgentStatus;

  /** Timestamp when the session was created. */
  createdAt: number;

  /** Timestamp when the session started executing. */
  startedAt: number | null;

  /** Timestamp when the session completed. */
  completedAt: number | null;

  /** Total duration in milliseconds. */
  totalDurationMs: number;

  /** Accumulated token usage. */
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Provider used. */
  providerId: string;

  /** Model used. */
  model: string;

  /** Active mode id. */
  modeId: string | null;

  /** Final answer content. */
  finalAnswer: string | null;

  /** Error message if status is error. */
  error: string | null;

  /** Abort signal for cancellation. */
  signal: AbortSignal;
};

// ---------------------------------------------------------------------------
// LLM interface
// ---------------------------------------------------------------------------

/** Result from an LLM call. */
type LLMResponse = {
  /** Text content of the response (null if tool calls only). */
  content: string | null;

  /** Tool calls requested by the LLM. */
  toolCalls: AgentToolCall[];

  /** Why the LLM stopped. */
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';

  /** Token usage. */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Latency in milliseconds. */
  latencyMs: number;
};

/** Interface for calling an LLM. */
type LLMProvider = {
  /** Send messages and tools, get response with potential tool calls. */
  chat(params: {
    messages: AgentMessage[];
    tools: AgentToolDefinition[];
    model: string;
    temperature: number;
    maxTokens: number;
    signal: AbortSignal;
  }): Promise<LLMResponse>;
};

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

type AgentDiagnostics = {
  /** Number of active sessions. */
  activeSessions: number;

  /** Number of completed sessions. */
  completedSessions: number;

  /** Sessions by status. */
  sessionsByStatus: Record<string, number>;

  /** Total tool calls across all sessions. */
  totalToolCalls: number;

  /** Total iterations across all sessions. */
  totalIterations: number;

  /** Total LLM latency across all sessions. */
  totalLLMLatencyMs: number;

  /** Average iterations per session. */
  avgIterations: number;

  /** Average tool calls per session. */
  avgToolCalls: number;

  /** Total errors. */
  totalErrors: number;

  /** Total cancelled. */
  totalCancelled: number;

  /** Total timeouts. */
  totalTimeouts: number;

  /** Per-session summaries. */
  sessions: AgentSessionSummary[];
};

type AgentSessionSummary = {
  id: AgentSessionId;
  status: AgentStatus;
  iterations: number;
  toolCalls: number;
  durationMs: number;
  error: string | null;
  createdAt: number;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

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
};

export { DEFAULT_AGENT_CONFIG };