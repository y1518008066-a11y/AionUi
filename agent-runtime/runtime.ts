/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Runtime — Core Loop
 *
 * Implements the Reason → Act → Observe loop:
 *
 *   1. REASON:  Send conversation + tools to LLM
 *   2. ACT:     If tool calls → dispatch through ActionEngine
 *   3. OBSERVE: Feed tool results back as observations
 *   4. REPEAT:  Continue until final answer, max iterations, or timeout
 *
 * All tool execution goes through ActionEngine.dispatch().
 * No direct plugin calls.
 */

import { AgentSessionManager } from './session';
import type {
  AgentConfig,
  AgentToolCall,
  AgentToolResult,
  AgentObservation,
  AgentDiagnostics,
  AgentSessionSummary,
  LLMProvider,
  LLMResponse,
} from './types';
import type { ActionInput, ActionOutput } from '../action-engine/types';

// ---------------------------------------------------------------------------
// Tool execution interface (ActionEngine-compatible)
// ---------------------------------------------------------------------------

type ToolExecutor = {
  dispatch(input: ActionInput): Promise<ActionOutput>;
  dispatchBatch(inputs: ActionInput[]): Promise<ActionOutput[]>;
};

// ---------------------------------------------------------------------------
// Agent Runtime
// ---------------------------------------------------------------------------

class AgentRuntime {
  private readonly llmProvider: LLMProvider;
  private readonly toolExecutor: ToolExecutor;

  /** All sessions (active + completed). */
  private sessions: AgentSessionManager[] = [];

  /** Aggregate stats. */
  private stats = {
    completedSessions: 0,
    totalToolCalls: 0,
    totalIterations: 0,
    totalLLMLatencyMs: 0,
    totalErrors: 0,
    totalCancelled: 0,
    totalTimeouts: 0,
  };

  constructor(llmProvider: LLMProvider, toolExecutor: ToolExecutor) {
    this.llmProvider = llmProvider;
    this.toolExecutor = toolExecutor;
    console.log('[AgentRuntime] Initialized.');
  }

  // -----------------------------------------------------------------------
  // Run
  // -----------------------------------------------------------------------

  /**
   * Run the full Reason → Act → Observe loop for a user prompt.
   *
   * @param userPrompt - The user's query.
   * @param config - Agent configuration overrides.
   * @param signal - Optional AbortSignal for cancellation.
   * @returns The session (with final answer if successful).
   */
  async run(
    userPrompt: string,
    config: Partial<AgentConfig> = {},
    signal?: AbortSignal,
  ): Promise<AgentSessionManager> {
    const session = new AgentSessionManager(config, signal);
    this.sessions.push(session);

    // Add the user message
    session.addUserMessage(userPrompt);
    session.start();

    console.log('[AgentRuntime] Session started: ' + session.id + ' | Prompt: ' + userPrompt.substring(0, 80));

    const overallT0 = Date.now();
    const timeoutMs = session.config.timeoutMs;

    try {
      // Main Reason → Act → Observe loop
      while (!session.isFinished) {
        // Check cancellation before every iteration
        if (session.signal.aborted) {
          session.cancel();
          this.stats.totalCancelled++;
          console.log('[AgentRuntime] Session cancelled: ' + session.id);
          break;
        }

        // Check global timeout
        if (timeoutMs > 0 && (Date.now() - overallT0) > timeoutMs) {
          session.timeout();
          this.stats.totalTimeouts++;
          console.log('[AgentRuntime] Session timeout: ' + session.id + ' after ' + timeoutMs + 'ms');
          break;
        }

        // Check max iterations
        if (session.iteration >= session.config.maxIterations) {
          session.fail('Maximum iterations reached (' + session.config.maxIterations + ').');
          this.stats.totalErrors++;
          console.log('[AgentRuntime] Max iterations reached: ' + session.id);
          break;
        }

        // === REASON ===
        session.transitionToReasoning();
        const llmResponse = await this.reason(session);

        // Handle final answer (no tool calls)
        const hasToolCalls = llmResponse.toolCalls && llmResponse.toolCalls.length > 0;
        const hasContent = llmResponse.content && llmResponse.content.trim().length > 0;

        if (!hasToolCalls) {
          // This is the final answer
          const answer = llmResponse.content || 'No response.';
          session.complete(answer);
          this.stats.completedSessions++;
          console.log('[AgentRuntime] Session completed: ' + session.id + ' | Iterations: ' + session.iteration);
          break;
        }

        // === ACT ===
        session.transitionToActing();
        const { results, observations } = await this.act(session, llmResponse.toolCalls);

        session.addToolResults(results);
        this.stats.totalToolCalls += results.length;

        // Check cancellation after acting
        if (session.signal.aborted) {
          session.cancel();
          this.stats.totalCancelled++;
          console.log("[AgentRuntime] Session cancelled after act: " + session.id);
          break;
        }

        // === OBSERVE ===
        session.transitionToObserving();
        session.addObservations(observations);

        // Track iteration (once per full Reason→Act→Observe cycle)
        this.stats.totalIterations++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      session.fail(msg);
      this.stats.totalErrors++;
      console.error('[AgentRuntime] Session error: ' + session.id + ' | ' + msg);
    }

    this.stats.totalLLMLatencyMs += session.totalDurationMs;

    console.log(
      '[AgentRuntime] Session finished: ' + session.id +
      ' | Status: ' + session.status +
      ' | Iterations: ' + session.iteration +
      ' | Tools: ' + session.toolResults.length +
      ' | Duration: ' + session.totalDurationMs + 'ms'
    );

    return session;
  }

  // -----------------------------------------------------------------------
  // REASON phase
  // -----------------------------------------------------------------------

  private async reason(session: AgentSessionManager): Promise<LLMResponse> {
    const messages = session.history.getForLLM();

    console.log(
      '[AgentRuntime:REASON] Iteration ' + session.iteration +
      ' | Messages: ' + messages.length +
      ' | Tools: ' + session.config.tools.length
    );

    const response = await this.llmProvider.chat({
      messages,
      tools: session.config.tools,
      model: session.config.model,
      temperature: session.config.temperature,
      maxTokens: session.config.maxTokens,
      signal: session.signal,
    });

    session.addTokenUsage(response.usage);
    session.addAssistantResponse(response.content, response.toolCalls);

    console.log(
      '[AgentRuntime:REASON] Response | Content: ' + (response.content ? response.content.length + ' chars' : 'null') +
      ' | Tool calls: ' + response.toolCalls.length +
      ' | Finish: ' + response.finishReason +
      ' | Latency: ' + response.latencyMs + 'ms'
    );

    return response;
  }

  // -----------------------------------------------------------------------
  // ACT phase (execute tool calls through ActionEngine)
  // -----------------------------------------------------------------------

  private async act(
    session: AgentSessionManager,
    toolCalls: AgentToolCall[],
  ): Promise<{ results: AgentToolResult[]; observations: AgentObservation[] }> {
    const results: AgentToolResult[] = [];
    const observations: AgentObservation[] = [];

    // Map tool calls to ActionEngine inputs
    const inputs: ActionInput[] = toolCalls.map((tc) => ({
      actionId: tc.name,
      callerPluginId: 'agent-runtime',
      params: tc.arguments,
    }));

    console.log('[AgentRuntime:ACT] Dispatching ' + inputs.length + ' tool call(s) via ActionEngine');

    let outputs: ActionOutput[];

    if (session.config.allowParallelTools && inputs.length > 1) {
      outputs = await this.toolExecutor.dispatchBatch(inputs);
    } else {
      // Sequential execution
      outputs = [];
      for (const input of inputs) {
        const output = await this.toolExecutor.dispatch(input);
        outputs.push(output);
      }
    }

    // Build results and observations
    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i];
      const tc = toolCalls[i];

      const result: AgentToolResult = {
        toolCallId: tc.id,
        name: tc.name,
        success: output.success,
        result: output.data,
        error: output.error,
        durationMs: output.durationMs,
      };

      results.push(result);

      // Build observation text for the LLM
      const obsContent = output.success
        ? JSON.stringify(output.data)
        : 'Error: ' + (output.error || 'Unknown error');

      observations.push({
        toolCallId: tc.id,
        name: tc.name,
        content: obsContent,
        timestamp: Date.now(),
      });
    }

    console.log(
      '[AgentRuntime:ACT] Results | Success: ' + results.filter((r) => r.success).length +
      ' / ' + results.length +
      ' | Total duration: ' + results.reduce((s, r) => s + r.durationMs, 0) + 'ms'
    );

    return { results, observations };
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Get a specific session by id.
   */
  getSession(id: string): AgentSessionManager | undefined {
    return this.sessions.find((s) => s.id === id);
  }

  /**
   * Get all sessions.
   */
  getAllSessions(): AgentSessionManager[] {
    return [...this.sessions];
  }

  /**
   * Get the number of active (non-finished) sessions.
   */
  get activeSessions(): number {
    return this.sessions.filter((s) => !s.isFinished).length;
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /**
   * Get comprehensive diagnostics.
   */
  getDiagnostics(): AgentDiagnostics {
    const sessionsByStatus: Record<string, number> = {};
    const sessionSummaries: AgentSessionSummary[] = [];

    for (const session of this.sessions) {
      const status = session.status;
      sessionsByStatus[status] = (sessionsByStatus[status] || 0) + 1;
      sessionSummaries.push(session.toSummary());
    }

    const totalSessions = this.sessions.length;
    const totalIterations = this.sessions.reduce((s, sess) => s + sess.iteration, 0);

    return {
      activeSessions: this.activeSessions,
      completedSessions: this.stats.completedSessions,
      sessionsByStatus,
      totalToolCalls: this.stats.totalToolCalls,
      totalIterations: this.stats.totalIterations,
      totalLLMLatencyMs: this.stats.totalLLMLatencyMs,
      avgIterations: totalSessions > 0 ? Math.round(totalIterations / totalSessions) : 0,
      avgToolCalls: totalSessions > 0 ? Math.round(this.stats.totalToolCalls / totalSessions) : 0,
      totalErrors: this.stats.totalErrors,
      totalCancelled: this.stats.totalCancelled,
      totalTimeouts: this.stats.totalTimeouts,
      sessions: sessionSummaries,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { AgentRuntime };
export type { ToolExecutor };