/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Execution Bridge Layer — Entry Point
 *
 * Provides the structural backbone connecting AI Router outputs to
 * the execution pipeline. All stages are mock-only — no real system
 * side effects occur.
 *
 * Usage:
 *
 * `	s
 * import { ExecutionBridge } from './execution-bridge';
 *
 * const bridge = new ExecutionBridge(jarvisCore);
 * bridge.bindRouter(aiRouter);
 *
 * const result = await bridge.executeFromResponse(response, actions);
 * `
 */

import { ExecutionBridge } from './bridge';
import { ExecutionPipeline } from './executor';

export { ExecutionBridge, ExecutionPipeline };

// Re-export types for convenience
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
} from './types';
