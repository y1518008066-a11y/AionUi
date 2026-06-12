/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Runtime — Session
 *
 * Manages the state and lifecycle of a single agent session.
 * Owns conversation history, tracks iterations, tool calls,
 * observations, timing, and status transitions.
 */

import { ConversationHistory } from './history';
import type {
  AgentSessionId,
  AgentStatus,
  AgentToolCall,
  AgentToolResult,
  AgentObservation,
  AgentMessage,
  AgentConfig,
  AgentSession,
} from './types';
import { DEFAULT_AGENT_CONFIG } from './types';

// ---------------------------------------------------------------------------
// Counter for unique session ids
// ---------------------------------------------------------------------------

let sessionCounter = 0;

// ---------------------------------------------------------------------------
// Agent Session
// ---------------------------------------------------------------------------

class AgentSessionManager {
  readonly id: AgentSessionId;
  readonly history: ConversationHistory;
  readonly config: AgentConfig;

  private _status: AgentStatus = 'idle';
  private _iteration = 0;
  private _toolResults: AgentToolResult[] = [];
  private _observations: AgentObservation[] = [];
  private _createdAt: number;
  private _startedAt: number | null = null;
  private _completedAt: number | null = null;
  private _tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private _finalAnswer: string | null = null;
  private _error: string | null = null;
  private _signal: AbortSignal;

  constructor(
    config: Partial<AgentConfig> = {},
    signal?: AbortSignal,
  ) {
    this.id = 'agent-' + (++sessionCounter) + '-' + Date.now();
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    this.history = new ConversationHistory();
    this.history.init(this.config.systemPrompt);
    this._createdAt = Date.now();
    this._signal = signal || new AbortController().signal;
  }

  // -----------------------------------------------------------------------
  // State accessors
  // -----------------------------------------------------------------------

  get status(): AgentStatus { return this._status; }
  get iteration(): number { return this._iteration; }
  get toolResults(): AgentToolResult[] { return [...this._toolResults]; }
  get observations(): AgentObservation[] { return [...this._observations]; }
  get createdAt(): number { return this._createdAt; }
  get startedAt(): number | null { return this._startedAt; }
  get completedAt(): number | null { return this._completedAt; }
  get tokenUsage() { return { ...this._tokenUsage }; }
  get finalAnswer(): string | null { return this._finalAnswer; }
  get error(): string | null { return this._error; }
  get signal(): AbortSignal { return this._signal; }

  get totalDurationMs(): number {
    if (!this._startedAt) return 0;
    const end = this._completedAt || Date.now();
    return end - this._startedAt;
  }

  // -----------------------------------------------------------------------
  // Status transitions
  // -----------------------------------------------------------------------

  start(): void {
    this._status = 'reasoning';
    this._startedAt = Date.now();
  }

  transitionToActing(): void {
    this._status = 'acting';
  }

  transitionToObserving(): void {
    this._status = 'observing';
  }

  transitionToReasoning(): void {
    this._iteration++;
    this._status = 'reasoning';
  }

  complete(finalAnswer: string): void {
    this._status = 'completed';
    this._finalAnswer = finalAnswer;
    this._completedAt = Date.now();
  }

  fail(error: string): void {
    this._status = 'error';
    this._error = error;
    this._completedAt = Date.now();
  }

  cancel(): void {
    this._status = 'cancelled';
    this._completedAt = Date.now();
  }

  timeout(): void {
    this._status = 'timeout';
    this._completedAt = Date.now();
  }

  // -----------------------------------------------------------------------
  // Data updates
  // -----------------------------------------------------------------------

  addUserMessage(content: string): void {
    this.history.addUser(content);
  }

  addAssistantResponse(content: string | null, toolCalls?: AgentToolCall[]): void {
    this.history.addAssistant(content, toolCalls);
  }

  addObservations(observations: AgentObservation[]): void {
    this._observations.push(...observations);
    this.history.addObservations(observations);
  }

  addToolResults(results: AgentToolResult[]): void {
    this._toolResults.push(...results);
  }

  addTokenUsage(usage: { promptTokens: number; completionTokens: number; totalTokens: number }): void {
    this._tokenUsage.promptTokens += usage.promptTokens;
    this._tokenUsage.completionTokens += usage.completionTokens;
    this._tokenUsage.totalTokens += usage.totalTokens;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  getMessages(): AgentMessage[] {
    return this.history.getAll();
  }

  get isFinished(): boolean {
    return ['completed', 'error', 'cancelled', 'timeout'].includes(this._status);
  }

  /**
   * Build a summary of the session for diagnostics.
   */
  toSummary() {
    return {
      id: this.id,
      status: this._status,
      iterations: this._iteration,
      toolCalls: this._toolResults.length,
      durationMs: this.totalDurationMs,
      error: this._error,
      createdAt: this._createdAt,
    };
  }

  /**
   * Build the full session snapshot.
   */
  toSession(): AgentSession {
    return {
      id: this.id,
      messages: this.getMessages(),
      toolHistory: this._toolResults,
      observations: this._observations,
      iteration: this._iteration,
      status: this._status,
      createdAt: this._createdAt,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      totalDurationMs: this.totalDurationMs,
      tokenUsage: { ...this._tokenUsage },
      providerId: this.config.providerId,
      model: this.config.model,
      modeId: null,
      finalAnswer: this._finalAnswer,
      error: this._error,
      signal: this._signal,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { AgentSessionManager };