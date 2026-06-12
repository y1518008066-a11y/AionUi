/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Action Engine — Main Engine
 *
 * The single execution layer for every plugin.
 *
 * Architecture:
 *   AI → AIRouter → Execution Bridge → Action Engine → Plugin Runtime → Plugin
 *
 * Adapter integration point:
 *   Plugins that wrap external capabilities (Browser, Computer Use) should
 *   register their actions through ActionEngine. The adapter layer
 *   (see ../adapters/) defines the contracts — ActionEngine dispatches
 *   to whichever backend is configured.
 *
 * Responsibilities:
 * - Register/unregister actions (delegates to ActionRegistry)
 * - Dispatch actions with full lifecycle (delegates to ActionDispatcher)
 * - Permission validation before every execution
 * - Audit trail recording
 * - EventBus emission
 * - Diagnostics
 */

import { ActionRegistry } from './registry';
import { ActionDispatcher } from './dispatcher';
import { PermissionManager } from '../plugin-marketplace/permissions';
import type {
  ActionDefinition,
  ActionHandler,
  ActionInput,
  ActionOutput,
  ActionContext,
  DispatchOptions,
  ActionEngineDiagnostics,
  ActionEngineEvent,
} from './types';
import type { PluginPermission } from '../plugin-marketplace/types';

// ---------------------------------------------------------------------------
// Action Engine
// ---------------------------------------------------------------------------

class ActionEngine {
  private readonly registry: ActionRegistry;
  private readonly dispatcher: ActionDispatcher;
  private readonly permissionManager: PermissionManager;

  /** Currently active mode id (set externally by ModeManager integration). */
  activeModeId: string | null = null;

  /** Currently active provider id (set externally by AIRouter integration). */
  activeProviderId: string | null = null;

  /** Handler to emit events (compatible with JarvisCore EventBus). */
  private eventHandler: ((event: ActionEngineEvent) => void) | null = null;

  constructor() {
    this.permissionManager = new PermissionManager();
    this.registry = new ActionRegistry();
    this.dispatcher = new ActionDispatcher(this.permissionManager, {
      emit: (event: ActionEngineEvent) => {
        this.eventHandler?.(event);
      },
    });

    console.log('[ActionEngine] Initialized.');
  }

  // -----------------------------------------------------------------------
  // Event binding
  // -----------------------------------------------------------------------

  /**
   * Set the event emission handler (e.g., wire to JarvisCore EventBus).
   */
  onEvent(handler: (event: ActionEngineEvent) => void): void {
    this.eventHandler = handler;
  }

  // -----------------------------------------------------------------------
  // Action Registration
  // -----------------------------------------------------------------------

  /**
   * Register an action with its handler.
   * Called by plugins during their onEnable() lifecycle.
   */
  registerAction(definition: ActionDefinition, handler: ActionHandler): void {
    this.registry.register(definition, handler);
  }

  /**
   * Unregister an action.
   */
  unregisterAction(actionId: string): boolean {
    return this.registry.unregister(actionId);
  }

  /**
   * Unregister all actions for a plugin.
   */
  unregisterByPlugin(pluginId: string): number {
    return this.registry.unregisterByPlugin(pluginId);
  }

  // -----------------------------------------------------------------------
  // Action Dispatch
  // -----------------------------------------------------------------------

  /**
   * Dispatch a single action.
   */
    async dispatch(input: ActionInput, options?: DispatchOptions): Promise<ActionOutput> {
    const registered = this.registry.get(input.actionId);
    if (!registered) {
      return {
        actionId: input.actionId,
        success: false,
        error: 'Action not registered: ' + input.actionId,
        durationMs: 0,
      };
    }

    const executionId = this.dispatcher.generateExecutionId();
    const ctx: ActionContext = {
      executionId,
      actionId: input.actionId,
      pluginId: registered.definition.pluginId,
      callerPluginId: input.callerPluginId,
      modeId: this.activeModeId,
      providerId: this.activeProviderId,
      requestId: null,
      params: input.params,
      startedAt: Date.now(),
      grantedPermissions: [],
      deniedPermissions: [],
      signal: options?.signal || new AbortController().signal,
    };

    return this.dispatcher.dispatch(ctx, registered.handler, {
      ...options,
    });
  }

  /**
   * Dispatch multiple actions in batch.
   */
    async dispatchBatch(inputs: ActionInput[], options?: DispatchOptions): Promise<ActionOutput[]> {
    const tasks = inputs.map((input) => {
      const registered = this.registry.get(input.actionId);
      if (!registered) {
        return Promise.resolve({
          actionId: input.actionId,
          success: false,
          error: 'Action not registered: ' + input.actionId,
          durationMs: 0,
        } as ActionOutput);
      }

      const executionId = this.dispatcher.generateExecutionId();
      const ctx: ActionContext = {
        executionId,
        actionId: input.actionId,
        pluginId: registered.definition.pluginId,
        callerPluginId: input.callerPluginId,
        modeId: this.activeModeId,
        providerId: this.activeProviderId,
        requestId: null,
        params: input.params,
        startedAt: Date.now(),
        grantedPermissions: [],
        deniedPermissions: [],
        signal: options?.signal || new AbortController().signal,
      };

      return this.dispatcher.dispatch(ctx, registered.handler, { ...options });
    });

    return Promise.all(tasks);
  }

  // -----------------------------------------------------------------------
  // Action Queries
  // -----------------------------------------------------------------------

  /**
   * List all registered actions.
   */
  listActions(): ActionDefinition[] {
    return this.registry.list();
  }

  /**
   * Get a specific action definition.
   */
  getAction(actionId: string): ActionDefinition | undefined {
    return this.registry.getDefinition(actionId);
  }

  /**
   * Check if an action is registered.
   */
  hasAction(actionId: string): boolean {
    return this.registry.has(actionId);
  }

  /**
   * List actions by plugin.
   */
  listActionsByPlugin(pluginId: string): ActionDefinition[] {
    return this.registry.listByPlugin(pluginId);
  }

  /**
   * List actions by category.
   */
  listActionsByCategory(category: string): ActionDefinition[] {
    return this.registry.listByCategory(category);
  }

  // -----------------------------------------------------------------------
  // Permission Management
  // -----------------------------------------------------------------------

  /**
   * Grant a permission to a plugin.
   */
  grantPermission(pluginId: string, permission: PluginPermission): void {
    this.permissionManager.grant(pluginId, permission);
  }

  /**
   * Revoke a permission from a plugin.
   */
  revokePermission(pluginId: string, permission: PluginPermission): void {
    this.permissionManager.revoke(pluginId, permission);
  }

  /**
   * Check if a plugin has a specific permission.
   */
  hasPermission(pluginId: string, permission: PluginPermission): boolean {
    return this.permissionManager.has(pluginId, permission);
  }

  /**
   * Get all permissions for a plugin.
   */
  getPermissions(pluginId: string): PluginPermission[] {
    return this.permissionManager.list(pluginId);
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /**
   * Get comprehensive diagnostics.
   */
  getDiagnostics(): ActionEngineDiagnostics {
    const allActions = this.registry.list();
    const actionsByPlugin: Record<string, number> = {};
    for (const a of allActions) {
      actionsByPlugin[a.pluginId] = (actionsByPlugin[a.pluginId] || 0) + 1;
    }

    const auditLog = this.dispatcher.getAuditLog();

    const totalExecutions = auditLog.length;
    const totalSuccess = auditLog.filter((e) => e.success).length;
    const totalFailures = auditLog.filter((e) => !e.success && e.error).length;
    const totalTimeouts = auditLog.filter((e) => !e.success && e.error?.includes('timeout')).length;
    const totalCancelled = auditLog.filter((e) => !e.success && e.error?.includes('cancelled')).length;
    const totalPermissionDenials = auditLog.filter(
      (e) => !e.success && e.error?.includes('permission')
    ).length;
    const avgLatencyMs =
      totalExecutions > 0
        ? Math.round(auditLog.reduce((s, e) => s + e.durationMs, 0) / totalExecutions)
        : 0;

    return {
      registeredActions: this.registry.size,
      totalExecutions,
      totalSuccess,
      totalFailures,
      totalTimeouts,
      totalCancelled,
      totalPermissionDenials,
      avgLatencyMs,
      actionsByPlugin,
      auditLog,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ActionEngine };

