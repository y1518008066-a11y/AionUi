/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Execution Bridge Layer — Executor
 *
 * Implements the execution pipeline: a sequence of stages that process
 * an ExecutionRequest through validate → preprocess → route → execute →
 * postprocess → complete.
 *
 * The execute stage is MOCK ONLY — it logs actions and returns synthetic
 * results. Real system actions will be implemented in a future task.
 */

import type { IEventBus } from '../jarvis-core/interfaces';
import type {
  ExecutionContext,
  ExecutionResult,
  ExecutionRequest,
  ActionResult,
  PipelineStageHandler,
  ExecutionError,
} from './types';

// ---------------------------------------------------------------------------
// Pipeline stage implementations
// ---------------------------------------------------------------------------

/**
 * Stage 1: Validate the execution request.
 *
 * Checks that the request is well-formed and all actions have required
 * fields. Currently a structural pass-through.
 */
const validateStage: PipelineStageHandler = (context: ExecutionContext): ExecutionContext => {
  const { actions } = context.request;

  if (actions.length === 0) {
    return {
      ...context,
      stage: 'complete',
      status: 'completed',
      results: [],
      errors: [],
    };
  }

  for (const action of actions) {
    if (!action.type) {
      const error: ExecutionError = {
        stage: 'validate',
        actionId: action.id,
        code: 'INVALID_ACTION_TYPE',
        message: 'Action type is required.',
      };
      return {
        ...context,
        stage: 'validate',
        status: 'failed',
        errors: [...context.errors, error],
      };
    }
  }

  return { ...context, stage: 'validate' };
};

/**
 * Stage 2: Preprocess actions.
 *
 * Normalizes parameters, resolves defaults, and prepares actions for
 * execution. Currently a structural pass-through.
 */
const preprocessStage: PipelineStageHandler = (context: ExecutionContext): ExecutionContext => {
  return { ...context, stage: 'preprocess' };
};

/**
 * Stage 3: Route actions to appropriate handlers.
 *
 * In future: looks up registered handlers by action type, checks
 * permissions, and routes to the correct handler.
 * Currently a structural pass-through.
 */
const routeStage: PipelineStageHandler = (context: ExecutionContext): ExecutionContext => {
  return { ...context, stage: 'route' };
};

/**
 * Stage 4: Execute actions (MOCK ONLY).
 *
 * Currently logs each action and returns a synthetic success result.
 * No real system side effects occur.
 * Future: dispatch to registered action handlers.
 */
const executeStage: PipelineStageHandler = async (context: ExecutionContext): Promise<ExecutionContext> => {
  const results: ActionResult[] = [];

  for (const action of context.request.actions) {
    const t0 = performance.now();

    // MOCK: Log the action intent — no real execution.
    console.log(
      '[ExecutionBridge] MOCK execute: ' + action.type + ' (id: ' + action.id + ', priority: ' + action.priority + ')'
    );

    // eslint-disable-next-line no-await-in-loop -- mock delay is intentional and sequential
    await new Promise((resolve) => setTimeout(resolve, 1));

    results.push({
      actionId: action.id,
      success: true,
      data: {
        mock: true,
        actionType: action.type,
        params: action.params,
        message: 'This is a mock result. Real execution will be implemented in a future task.',
      },
      durationMs: Math.round(performance.now() - t0),
    });
  }

  return {
    ...context,
    stage: 'execute',
    results,
  };
};

/**
 * Stage 5: Postprocess results.
 *
 * Aggregates action results, formats output, and prepares final response.
 * Currently a structural pass-through.
 */
const postprocessStage: PipelineStageHandler = (context: ExecutionContext): ExecutionContext => {
  return { ...context, stage: 'postprocess' };
};

// ---------------------------------------------------------------------------
// Execution pipeline runner
// ---------------------------------------------------------------------------

/**
 * Creates an execution pipeline that processes a request through all
 * stages, emitting events at each step via the JarvisCore EventBus.
 */
class ExecutionPipeline {
  private readonly eventBus: IEventBus;

  private stages: PipelineStageHandler[];

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
    this.stages = [validateStage, preprocessStage, routeStage, executeStage, postprocessStage];
  }

  /**
   * Replace the pipeline stages (for extensibility).
   */
  setStages(stages: PipelineStageHandler[]): void {
    this.stages = stages;
    console.log('[ExecutionBridge] Pipeline stages updated: ' + stages.length + ' stages.');
  }

  /**
   * Run the pipeline against an execution request.
   *
   * Each stage is called in sequence. If a stage sets status to 'failed'
   * or 'cancelled', the pipeline stops.
   */
  async run(request: ExecutionRequest): Promise<ExecutionResult> {
    const t0 = performance.now();

    this.eventBus.emit({
      type: 'execution:start',
      executionId: request.id,
      actionCount: request.actions.length,
    });

    let context: ExecutionContext = {
      request,
      stage: 'validate',
      status: 'running',
      results: [],
      errors: [],
      startedAt: Date.now(),
      state: {},
    };

    for (const stage of this.stages) {
      try {
        // eslint-disable-next-line no-await-in-loop -- pipeline stages must run sequentially
        context = await stage(context);

        // Emit stage event
        this.eventBus.emit({
          type: 'execution:stage',
          executionId: request.id,
          stage: context.stage,
        });

        // Stop on failure or cancellation
        if (context.status === 'failed') {
          for (const error of context.errors) {
            this.eventBus.emit({
              type: 'execution:error',
              executionId: request.id,
              stage: error.stage,
              error,
            });
          }
          break;
        }

        if (context.status === 'cancelled') {
          this.eventBus.emit({
            type: 'execution:cancelled',
            executionId: request.id,
          });
          break;
        }

        // If validate detected no actions, we are done early
        if (context.stage === 'complete' && context.status === 'completed') {
          break;
        }
      } catch (error) {
        const execError: ExecutionError = {
          stage: context.stage,
          code: 'PIPELINE_STAGE_ERROR',
          message: error instanceof Error ? error.message : String(error),
          cause: error,
        };

        context = {
          ...context,
          status: 'failed',
          errors: [...context.errors, execError],
        };

        this.eventBus.emit({
          type: 'execution:error',
          executionId: request.id,
          stage: context.stage,
          error: execError,
        });

        break;
      }
    }

    // Mark complete (unless already failed/cancelled)
    if (context.status === 'running') {
      context = { ...context, stage: 'complete', status: 'completed' };
    }

    const totalDurationMs = Math.round(performance.now() - t0);

    this.eventBus.emit({
      type: 'execution:complete',
      executionId: request.id,
      success: context.status === 'completed',
      durationMs: totalDurationMs,
    });

    return {
      executionId: request.id,
      success: context.status === 'completed',
      actions: context.results,
      errors: context.errors,
      totalDurationMs,
      finalStage: context.stage,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ExecutionPipeline };
