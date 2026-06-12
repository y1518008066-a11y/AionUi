/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Execution Bridge Layer — Bridge
 *
 * Connects the AI Router to the Execution Pipeline.
 *
 * Listens to AI Router response events, converts them into
 * ExecutionRequests, and runs them through the pipeline.
 *
 * Currently STRUCTURAL ONLY — the bridge hooks are defined but
 * no automated routing is wired. This is the integration point
 * for future tasks.
 */

import type { IEventBus, IJarvisCore } from '../jarvis-core/interfaces';
import type { AIRouter } from '../ai-router/router';
import type { RouterResponse } from '../ai-router/types';
import type { ExecutionRequest, ExecutionAction, ExecutionResult, ExecutionId } from './types';
import { ExecutionPipeline } from './executor';

// ---------------------------------------------------------------------------
// Counter for generating unique execution ids
// ---------------------------------------------------------------------------

let executionCounter = 0;

function generateExecutionId(): ExecutionId {
  return 'exec-' + String(++executionCounter) + '-' + Date.now();
}

// ---------------------------------------------------------------------------
// Execution Bridge
// ---------------------------------------------------------------------------

/**
 * The ExecutionBridge connects AI Router output to the execution pipeline.
 *
 * Responsibilities:
 * - Receive AI Router responses
 * - Parse actions from responses (future: structured output parsing)
 * - Create ExecutionRequests
 * - Run through the ExecutionPipeline
 * - Emit lifecycle events
 *
 * Currently, it provides the structural hook. Future tasks will wire
 * it into the AI Router's response stream automatically.
 */
class ExecutionBridge {
  private readonly eventBus: IEventBus;
  private readonly jarvisCore: IJarvisCore;
  private readonly pipeline: ExecutionPipeline;

  private aiRouter: AIRouter | null = null;

  constructor(jarvisCore: IJarvisCore) {
    this.jarvisCore = jarvisCore;
    this.eventBus = jarvisCore.events;
    this.pipeline = new ExecutionPipeline(this.eventBus);

    console.log('[ExecutionBridge] Initialized.');
  }

  // -----------------------------------------------------------------------
  // Router binding
  // -----------------------------------------------------------------------

  /**
   * Bind this bridge to an AI Router instance.
   *
   * Once bound, the bridge will automatically listen for router
   * response events and convert them into executions.
   *
   * Currently STRUCTURAL — the listener is registered but no real
   * action parsing is implemented.
   */
  bindRouter(router: AIRouter): void {
    this.aiRouter = router;
    console.log('[ExecutionBridge] Bound to AI Router.');

    // Listen for router responses from the JarvisCore EventBus.
    // In future, this will automatically pipe AI responses into
    // the execution pipeline.
    this.eventBus.on('router:response', (_event) => {
      // Future: auto-parse response and execute actions.
      // Currently a no-op — the bridge provides the hook,
      // but the caller must explicitly invoke executeFromResponse().
    });
  }

  /**
   * Check whether the bridge is bound to a router.
   */
  get isBound(): boolean {
    return this.aiRouter !== null;
  }

  // -----------------------------------------------------------------------
  // Execution entry points
  // -----------------------------------------------------------------------

  /**
   * Execute actions extracted from an AI Router response.
   *
   * This is the primary integration point. Callers pass a RouterResponse
   * and (optionally) parsed actions; the bridge creates an
   * ExecutionRequest and runs it through the pipeline.
   *
   * @param response — The AI Router response to act on.
   * @param actions — Actions extracted from the response (empty = no-op execution).
   * @param metadata — Optional metadata to attach to the execution.
   */
  async executeFromResponse(
    response: RouterResponse,
    actions: ExecutionAction[] = [],
    metadata: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const request: ExecutionRequest = {
      id: generateExecutionId(),
      sourceRequest: {
        messages: [], // Router response alone may not carry the full request
      },
      sourceResponse: response,
      actions,
      metadata,
      createdAt: Date.now(),
    };

    return this.pipeline.run(request);
  }

  /**
   * Execute a pre-built ExecutionRequest directly.
   *
   * Useful when actions are constructed programmatically rather than
   * derived from an AI Router response.
   */
  async executeRequest(request: ExecutionRequest): Promise<ExecutionResult> {
    return this.pipeline.run(request);
  }

  /**
   * Execute a single action directly.
   *
   * Convenience wrapper that creates a minimal ExecutionRequest
   * around a single action.
   */
  async executeAction(action: ExecutionAction): Promise<ExecutionResult> {
    const request: ExecutionRequest = {
      id: generateExecutionId(),
      sourceRequest: { messages: [] },
      sourceResponse: {
        id: 'direct-' + action.id,
        providerId: 'direct',
        model: 'none',
        content: '',
        timestamp: Date.now(),
        latencyMs: 0,
      },
      actions: [action],
      metadata: { source: 'direct' },
      createdAt: Date.now(),
    };

    return this.pipeline.run(request);
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /**
   * Get a diagnostic summary of the bridge state.
   */
  getDiagnostics(): Record<string, unknown> {
    return {
      bound: this.isBound,
      executionCount: executionCounter,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ExecutionBridge };
