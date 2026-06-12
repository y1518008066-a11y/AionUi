/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Action Engine — Registry
 *
 * In-memory registry for all actions across all plugins.
 * No plugin should call another plugin directly — everything
 * goes through the Action Registry.
 */

import type { ActionId, ActionDefinition, ActionHandler, RegisteredAction } from './types';

// ---------------------------------------------------------------------------
// Action Registry
// ---------------------------------------------------------------------------

class ActionRegistry {
  private readonly actions = new Map<ActionId, RegisteredAction>();

  /**
   * Register an action with its handler.
   *
   * @throws If an action with the same id is already registered.
   */
  register(definition: ActionDefinition, handler: ActionHandler): void {
    if (this.actions.has(definition.id)) {
      throw new Error(
        '[ActionRegistry] Action "' + definition.id + '" is already registered by plugin "' +
        (this.actions.get(definition.id)?.definition.pluginId || 'unknown') + '".'
      );
    }

    this.actions.set(definition.id, { definition, handler });
    console.log(
      '[ActionRegistry] Registered: ' + definition.id +
      ' (plugin: ' + definition.pluginId +
      ', permissions: ' + definition.permissions.join(', ') + ')'
    );
  }

  /**
   * Unregister an action.
   *
   * @returns true if the action was found and removed.
   */
  unregister(actionId: ActionId): boolean {
    const existed = this.actions.has(actionId);
    if (existed) {
      this.actions.delete(actionId);
      console.log('[ActionRegistry] Unregistered: ' + actionId);
    }
    return existed;
  }

  /**
   * Unregister all actions for a plugin.
   *
   * @returns Number of actions removed.
   */
  unregisterByPlugin(pluginId: string): number {
    let count = 0;
    for (const [id, action] of this.actions) {
      if (action.definition.pluginId === pluginId) {
        this.actions.delete(id);
        count++;
      }
    }
    if (count > 0) {
      console.log('[ActionRegistry] Unregistered ' + count + ' actions for plugin: ' + pluginId);
    }
    return count;
  }

  /**
   * Get a registered action (definition + handler).
   */
  get(actionId: ActionId): RegisteredAction | undefined {
    return this.actions.get(actionId);
  }

  /**
   * Get just the definition for an action.
   */
  getDefinition(actionId: ActionId): ActionDefinition | undefined {
    return this.actions.get(actionId)?.definition;
  }

  /**
   * Check if an action is registered.
   */
  has(actionId: ActionId): boolean {
    return this.actions.has(actionId);
  }

  /**
   * List all registered actions.
   */
  list(): ActionDefinition[] {
    return [...this.actions.values()].map((r) => r.definition);
  }

  /**
   * List actions registered by a specific plugin.
   */
  listByPlugin(pluginId: string): ActionDefinition[] {
    return this.list().filter((a) => a.pluginId === pluginId);
  }

  /**
   * List actions in a specific category.
   */
  listByCategory(category: string): ActionDefinition[] {
    return this.list().filter((a) => a.category === category);
  }

  /**
   * Number of registered actions.
   */
  get size(): number {
    return this.actions.size;
  }

  /**
   * Remove all actions.
   */
  clear(): void {
    const count = this.actions.size;
    this.actions.clear();
    console.log('[ActionRegistry] Cleared ' + count + ' actions.');
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ActionRegistry };