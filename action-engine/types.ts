/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Action Engine — Type Definitions
 *
 * Defines the action model: what actions look like, how they're
 * registered, dispatched, and audited.
 */

import type { PluginPermission } from '../plugin-marketplace/types';

// ---------------------------------------------------------------------------
// Action identity
// ---------------------------------------------------------------------------

/** Unique action id (e.g. "computer.screenshot", "browser.navigate"). */
type ActionId = string;

/** Parameter definition for an action. */
type ActionParameter = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: unknown;
};

/** Return type descriptor for an action. */
type ActionReturnType = {
  type: 'void' | 'string' | 'number' | 'boolean' | 'object' | 'array' | 'buffer';
  description: string;
};

/** An action definition registered by a plugin. */
type ActionDefinition = {
  /** Unique action id (namespaced, e.g. "computer.screenshot"). */
  id: ActionId;

  /** The plugin that owns this action. */
  pluginId: string;

  /** Human-readable description. */
  description: string;

  /** Permissions required to execute this action. */
  permissions: PluginPermission[];

  /** Parameter definitions. */
  parameters: ActionParameter[];

  /** What this action returns. */
  returnType: ActionReturnType;

  /** Category for grouping in UI/diagnostics. */
  category?: string;
};

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------

/** Validated input to an action dispatch. */
type ActionInput = {
  actionId: ActionId;
  /** Caller plugin id. */
  callerPluginId: string;
  params: Record<string, unknown>;
};

/** Result of dispatching an action. */
type ActionOutput = {
  actionId: ActionId;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
};

/** Full execution context passed to action handlers. */
type ActionContext = {
  /** Unique execution id. */
  executionId: string;

  /** The action being executed. */
  actionId: ActionId;

  /** Plugin that owns the action. */
  pluginId: string;

  /** Plugin that called the action. */
  callerPluginId: string;

  /** Current active mode id. */
  modeId: string | null;

  /** Current active provider id. */
  providerId: string | null;

  /** Original request id (from AI Router). */
  requestId: string | null;

  /** Parameters passed to the action. */
  params: Record<string, unknown>;

  /** Timestamp when execution started. */
  startedAt: number;

  /** Granted permissions for this execution. */
  grantedPermissions: PluginPermission[];

  /** Denied permissions for this execution. */
  deniedPermissions: PluginPermission[];

  /** Abort signal for cancellation. */
  signal: AbortSignal;
};

/** The handler function that actually executes an action. */
type ActionHandler = (ctx: ActionContext) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Dispatch options
// ---------------------------------------------------------------------------

/** Options for dispatching an action. */
type DispatchOptions = {
  /** Timeout in milliseconds (0 = no timeout). */
  timeoutMs?: number;

  /** Number of retries on failure. */
  retries?: number;

  /** Delay between retries in milliseconds. */
  retryDelayMs?: number;

  /** Abort signal for cancellation. */
  signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Audit & events
// ---------------------------------------------------------------------------

/** Audit trail entry for an action execution. */
type AuditEntry = {
  executionId: string;
  actionId: ActionId;
  pluginId: string;
  callerPluginId: string;
  success: boolean;
  durationMs: number;
  error?: string;
  deniedPermissions: PluginPermission[];
  timestamp: number;
};

/** Events emitted by the Action Engine. */
type ActionEngineEvent =
  | {
      type: 'action:start';
      executionId: string;
      actionId: ActionId;
      pluginId: string;
      callerPluginId: string;
    }
  | {
      type: 'action:success';
      executionId: string;
      actionId: ActionId;
      pluginId: string;
      durationMs: number;
    }
  | {
      type: 'action:error';
      executionId: string;
      actionId: ActionId;
      pluginId: string;
      error: string;
      durationMs: number;
    }
  | {
      type: 'action:timeout';
      executionId: string;
      actionId: ActionId;
      pluginId: string;
      timeoutMs: number;
    }
  | {
      type: 'action:cancelled';
      executionId: string;
      actionId: ActionId;
      pluginId: string;
    };

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Registered action entry in the registry. */
type RegisteredAction = {
  definition: ActionDefinition;
  handler: ActionHandler;
};

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/** Action engine diagnostics. */
type ActionEngineDiagnostics = {
  registeredActions: number;
  totalExecutions: number;
  totalSuccess: number;
  totalFailures: number;
  totalTimeouts: number;
  totalCancelled: number;
  totalPermissionDenials: number;
  avgLatencyMs: number;
  actionsByPlugin: Record<string, number>;
  auditLog: AuditEntry[];
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  ActionId,
  ActionParameter,
  ActionReturnType,
  ActionDefinition,
  ActionInput,
  ActionOutput,
  ActionContext,
  ActionHandler,
  DispatchOptions,
  AuditEntry,
  ActionEngineEvent,
  RegisteredAction,
  ActionEngineDiagnostics,
};