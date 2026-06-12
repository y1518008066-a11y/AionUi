/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Action Engine — Module Entry
 */

export { ActionEngine } from './engine';
export { ActionRegistry } from './registry';
export { ActionDispatcher } from './dispatcher';
export { getActionEngine, resetActionEngine } from './singleton';

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
} from './types';