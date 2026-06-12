/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Execution Bridge Layer — Type Definitions
 *
 * Defines the execution model types for the bridge between AI Router
 * outputs and future system actions. All types are structural only —
 * no real system execution is implemented yet.
 */

import type { RouterResponse, RouterRequest } from '../ai-router/types';

// ---------------------------------------------------------------------------
// Execution model
// ---------------------------------------------------------------------------

/** Unique identifier for an execution run. */
type ExecutionId = string;

/** Current phase of the execution pipeline. */
type PipelineStage = 'validate' | 'preprocess' | 'route' | 'execute' | 'postprocess' | 'complete';

/** Status of an execution. */
type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * An execution action represents a single unit of work derived from
 * an AI Router response.
 *
 * Examples (future): open file, run terminal command, send notification,
 * create document, call MCP tool.
 */
type ExecutionAction = {
  /** Unique action id within this execution. */
  id: string;

  /** Human-readable type label (e.g. "file:open", "terminal:run"). */
  type: string;

  /** Parameters for this action. */
  params: Record<string, unknown>;

  /** Priority within the execution (lower = higher priority). */
  priority: number;

  /** Execution timeout in milliseconds (0 = no timeout). */
  timeoutMs: number;
};

/**
 * An execution request originates from the AI Router output.
 *
 * It carries the original router response plus parsed actions
 * the bridge extracted.
 */
type ExecutionRequest = {
  /** Unique execution id. */
  id: ExecutionId;

  /** The original AI Router request that triggered this. */
  sourceRequest: RouterRequest;

  /** The AI Router response that triggered this execution. */
  sourceResponse: RouterResponse;

  /** Actions extracted from the response. */
  actions: ExecutionAction[];

  /** Metadata from the router / mode. */
  metadata: Record<string, unknown>;

  /** Timestamp when the execution was created. */
  createdAt: number;
};

/**
 * Context passed through each stage of the execution pipeline.
 */
type ExecutionContext = {
  /** The execution request being processed. */
  request: ExecutionRequest;

  /** Current pipeline stage. */
  stage: PipelineStage;

  /** Current overall status. */
  status: ExecutionStatus;

  /** Accumulated results from executed actions. */
  results: ActionResult[];

  /** Errors encountered during execution. */
  errors: ExecutionError[];

  /** Timestamp when execution started. */
  startedAt: number;

  /** Arbitrary state shared between pipeline stages. */
  state: Record<string, unknown>;
};

/**
 * Result of executing a single action.
 */
type ActionResult = {
  /** Matching action id. */
  actionId: string;

  /** Whether the action succeeded. */
  success: boolean;

  /** Output data from the action. */
  data: unknown;

  /** Error message if the action failed. */
  error?: string;

  /** Duration in milliseconds. */
  durationMs: number;
};

/**
 * Structured error from the execution pipeline.
 */
type ExecutionError = {
  /** Which stage produced the error. */
  stage: PipelineStage;

  /** Which action was being processed (if applicable). */
  actionId?: string;

  /** Machine-readable error code. */
  code: string;

  /** Human-readable error message. */
  message: string;

  /** Original error object for debugging. */
  cause?: unknown;
};

/**
 * Final result of an execution pipeline run.
 */
type ExecutionResult = {
  /** Matching execution id. */
  executionId: ExecutionId;

  /** Whether the overall execution succeeded. */
  success: boolean;

  /** Individual action results. */
  actions: ActionResult[];

  /** Errors encountered. */
  errors: ExecutionError[];

  /** Total duration in milliseconds. */
  totalDurationMs: number;

  /** Final pipeline stage reached. */
  finalStage: PipelineStage;
};

// ---------------------------------------------------------------------------
// Pipeline stage handler type
// ---------------------------------------------------------------------------

/**
 * A single stage in the execution pipeline.
 *
 * Each stage receives the current context, can modify it, and returns
 * the (possibly modified) context for the next stage.
 */
type PipelineStageHandler = (context: ExecutionContext) => ExecutionContext | Promise<ExecutionContext>;

// ---------------------------------------------------------------------------
// Bridge events
// ---------------------------------------------------------------------------

/** Events emitted by the execution bridge via JarvisCore EventBus. */
type BridgeEvent =
  | {
      type: 'execution:start';
      executionId: ExecutionId;
      actionCount: number;
    }
  | {
      type: 'execution:stage';
      executionId: ExecutionId;
      stage: PipelineStage;
      actionId?: string;
    }
  | {
      type: 'execution:complete';
      executionId: ExecutionId;
      success: boolean;
      durationMs: number;
    }
  | {
      type: 'execution:error';
      executionId: ExecutionId;
      stage: PipelineStage;
      error: ExecutionError;
    }
  | {
      type: 'execution:cancelled';
      executionId: ExecutionId;
    };

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  ExecutionId,
  PipelineStage,
  ExecutionStatus,
  ExecutionAction,
  ExecutionRequest,
  ExecutionContext,
  ActionResult,
  ExecutionError,
  ExecutionResult,
  PipelineStageHandler,
  BridgeEvent,
};
