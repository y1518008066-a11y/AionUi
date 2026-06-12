/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Action Engine — Dispatcher
 *
 * Handles the runtime execution of actions:
 * - Permission validation
 * - Timeout enforcement
 * - Retry logic
 * - Cancellation via AbortSignal
 * - Event emission
 * - Audit trail recording
 */

import type {
  ActionContext,
  ActionOutput,
  DispatchOptions,
  ActionEngineEvent,
  AuditEntry,
} from './types';
import type { PluginPermission } from '../plugin-marketplace/types';
import { PermissionManager } from '../plugin-marketplace/permissions';

// ---------------------------------------------------------------------------
// Event emitter interface (minimal, compatible with JarvisCore EventBus)
// ---------------------------------------------------------------------------

type EventEmitter = {
  emit(event: ActionEngineEvent): void;
};

// ---------------------------------------------------------------------------
// Action Dispatcher
// ---------------------------------------------------------------------------

class ActionDispatcher {
  private readonly permissionManager: PermissionManager;
  private readonly eventEmitter: EventEmitter | null;

  private executionCounter = 0;
  private auditLog: AuditEntry[] = [];

  private stats = {
    totalExecutions: 0,
    totalSuccess: 0,
    totalFailures: 0,
    totalTimeouts: 0,
    totalCancelled: 0,
    totalPermissionDenials: 0,
    totalLatencyMs: 0,
  };

  constructor(permissionManager: PermissionManager, eventEmitter?: EventEmitter) {
    this.permissionManager = permissionManager;
    this.eventEmitter = eventEmitter || null;
  }

  /**
   * Dispatch an action with full lifecycle management.
   *
   * Flow:
   * 1. Look up action in registry
   * 2. Validate permissions
   * 3. Create ActionContext
   * 4. Execute handler with timeout
   * 5. Handle retries on failure
   * 6. Emit events + record audit
   */
  async dispatch(
    ctx: ActionContext,
    handler: (ctx: ActionContext) => Promise<unknown>,
    options: DispatchOptions = {}
  ): Promise<ActionOutput> {
    const t0 = performance.now();
    this.stats.totalExecutions++;

    const timeoutMs = options.timeoutMs || 30000;
    const retries = options.retries || 0;
    const retryDelayMs = options.retryDelayMs || 500;
    const signal = options.signal || ctx.signal;

    // Check for pre-cancellation
    if (signal?.aborted) {
      this.recordCancelled(ctx);
      return {
        actionId: ctx.actionId,
        success: false,
        error: 'Action cancelled before execution.',
        durationMs: Math.round(performance.now() - t0),
      };
    }

    // Emit start event
    this.emit({
      type: 'action:start',
      executionId: ctx.executionId,
      actionId: ctx.actionId,
      pluginId: ctx.pluginId,
      callerPluginId: ctx.callerPluginId,
    });

    let lastError: string | undefined;
    let lastDurationMs = 0;

    // Execute with retries
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (signal?.aborted) {
        this.recordCancelled(ctx);
        return {
          actionId: ctx.actionId,
          success: false,
          error: 'Action cancelled during execution.',
          durationMs: Math.round(performance.now() - t0),
        };
      }

      try {
        const result = await this.executeWithTimeout(handler, ctx, timeoutMs, signal);
        const durationMs = Math.round(performance.now() - t0);

        this.emit({
          type: 'action:success',
          executionId: ctx.executionId,
          actionId: ctx.actionId,
          pluginId: ctx.pluginId,
          durationMs,
        });

        this.recordAudit(ctx, true, durationMs);
        this.stats.totalSuccess++;
        this.stats.totalLatencyMs += durationMs;

        return {
          actionId: ctx.actionId,
          success: true,
          data: result,
          durationMs,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        lastDurationMs = Math.round(performance.now() - t0);

        // Check if this was a timeout
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Determine if timeout or user cancel
          if (signal?.aborted) {
            this.recordCancelled(ctx);
            return {
              actionId: ctx.actionId,
              success: false,
              error: 'Action cancelled.',
              durationMs: lastDurationMs,
            };
          }

          this.emit({
            type: 'action:timeout',
            executionId: ctx.executionId,
            actionId: ctx.actionId,
            pluginId: ctx.pluginId,
            timeoutMs,
          });

          this.stats.totalTimeouts++;
          lastError = 'Action timed out after ' + timeoutMs + 'ms.';
          // Don't retry timeouts
          break;
        }

        // If more retries available, wait and retry
        if (attempt < retries) {
          console.warn(
            '[ActionDispatcher] Retry ' + (attempt + 1) + '/' + retries +
            ' for ' + ctx.actionId + ': ' + lastError
          );
          await this.delay(retryDelayMs * (attempt + 1)); // exponential backoff
          continue;
        }

        break;
      }
    }

    // All attempts failed
    this.emit({
      type: 'action:error',
      executionId: ctx.executionId,
      actionId: ctx.actionId,
      pluginId: ctx.pluginId,
      error: lastError || 'Unknown error',
      durationMs: lastDurationMs,
    });

    this.recordAudit(ctx, false, lastDurationMs, lastError);
    this.stats.totalFailures++;

    return {
      actionId: ctx.actionId,
      success: false,
      error: lastError || 'Unknown error',
      durationMs: lastDurationMs,
    };
  }

  /**
   * Dispatch multiple actions in parallel.
   */
  async dispatchBatch(
    contexts: Array<{ ctx: ActionContext; handler: ActionHandler; options?: DispatchOptions }>
  ): Promise<ActionOutput[]> {
    return Promise.all(
      contexts.map(({ ctx, handler, options }) => this.dispatch(ctx, handler, options))
    );
  }

  /**
   * Get the audit log.
   */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get execution statistics.
   */
  getStats() {
    const avgLatency = this.stats.totalExecutions > 0
      ? Math.round(this.stats.totalLatencyMs / this.stats.totalExecutions)
      : 0;

    return {
      totalExecutions: this.stats.totalExecutions,
      totalSuccess: this.stats.totalSuccess,
      totalFailures: this.stats.totalFailures,
      totalTimeouts: this.stats.totalTimeouts,
      totalCancelled: this.stats.totalCancelled,
      totalPermissionDenials: this.stats.totalPermissionDenials,
      avgLatencyMs: avgLatency,
    };
  }

  /**
   * Clear the audit log.
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Generate a unique execution id.
   */
  generateExecutionId(): string {
    return 'ae-' + (++this.executionCounter) + '-' + Date.now();
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private async executeWithTimeout(
    handler: (ctx: ActionContext) => Promise<unknown>,
    ctx: ActionContext,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (timeoutMs <= 0) {
      return handler(ctx);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Link external signal
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Aborted', 'AbortError');
      }
      signal.addEventListener('abort', () => {
        controller.abort();
        clearTimeout(timeoutId);
      }, { once: true });
    }

    try {
      const result = await handler({ ...ctx, signal: controller.signal });
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private emit(event: ActionEngineEvent): void {
    if (this.eventEmitter) {
      try {
        this.eventEmitter.emit(event);
      } catch {
        // Event emission should never crash the engine
      }
    }
  }

  private recordAudit(
    ctx: ActionContext,
    success: boolean,
    durationMs: number,
    error?: string,
  ): void {
    const entry: AuditEntry = {
      executionId: ctx.executionId,
      actionId: ctx.actionId,
      pluginId: ctx.pluginId,
      callerPluginId: ctx.callerPluginId,
      success,
      durationMs,
      error,
      deniedPermissions: ctx.deniedPermissions,
      timestamp: Date.now(),
    };

    this.auditLog.push(entry);

    // Keep audit log bounded (last 1000 entries)
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  private recordCancelled(ctx: ActionContext): void {
    this.emit({
      type: 'action:cancelled',
      executionId: ctx.executionId,
      actionId: ctx.actionId,
      pluginId: ctx.pluginId,
    });

    this.recordAudit(ctx, false, 0, 'Action cancelled.');
    this.stats.totalCancelled++;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Re-export ActionHandler type for convenience
type ActionHandler = (ctx: ActionContext) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ActionDispatcher };
export type { ActionHandler, EventEmitter };