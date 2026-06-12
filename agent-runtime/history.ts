/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Runtime — Conversation History
 *
 * Manages the message history for an agent session, including
 * system prompts, user messages, assistant responses, tool calls,
 * and tool results (observations).
 */

import type { AgentMessage, AgentMessageRole, AgentToolCall, AgentObservation } from './types';

// ---------------------------------------------------------------------------
// History Manager
// ---------------------------------------------------------------------------

class ConversationHistory {
  private messages: AgentMessage[] = [];

  /**
   * Initialize the history with a system prompt.
   */
  init(systemPrompt: string): void {
    this.messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];
  }

  /**
   * Add a user message.
   */
  addUser(content: string): void {
    this.messages.push({
      role: 'user',
      content,
    });
  }

  /**
   * Add an assistant response (with optional tool calls).
   */
  addAssistant(content: string | null, toolCalls?: AgentToolCall[]): void {
    this.messages.push({
      role: 'assistant',
      content: content || '',
      toolCalls: toolCalls || undefined,
    });
  }

  /**
   * Add tool results as observations.
   */
  addObservations(observations: AgentObservation[]): void {
    for (const obs of observations) {
      this.messages.push({
        role: 'tool',
        content: obs.content,
        toolCallId: obs.toolCallId,
        name: obs.name,
      });
    }
  }

  /**
   * Get all messages.
   */
  getAll(): AgentMessage[] {
    return [...this.messages];
  }

  /**
   * Get only messages for sending to the LLM.
   *
   * Some providers require different handling — this provides
   * a clean abstraction point for future provider-specific formatting.
   */
  getForLLM(): AgentMessage[] {
    return this.getAll();
  }

  /**
   * Get the last N messages (for truncation).
   */
  getLast(n: number): AgentMessage[] {
    // Always keep the system message
    const system = this.messages.filter((m) => m.role === 'system');
    const rest = this.messages.filter((m) => m.role !== 'system');
    return [...system, ...rest.slice(-n)];
  }

  /**
   * Number of messages (excluding system).
   */
  get size(): number {
    return this.messages.filter((m) => m.role !== 'system').length;
  }

  /**
   * Total number of messages including system.
   */
  get totalSize(): number {
    return this.messages.length;
  }

  /**
   * Clear all messages.
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Get messages as a plain array for serialization.
   */
  toJSON(): AgentMessage[] {
    return this.getAll();
  }

  /**
   * Restore messages from serialized data.
   */
  fromJSON(messages: AgentMessage[]): void {
    this.messages = messages;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ConversationHistory };