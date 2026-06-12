/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin System Core — Manager
 *
 * Orchestrates plugin lifecycle: install, load, enable, disable,
 * unload, destroy. Delegates state transitions to PluginLifecycle and
 * storage to PluginRegistry.
 *
 * ALL methods are STRUCTURAL ONLY — they validate state transitions,
 * call lifecycle hooks, and log. No real plugin behavior occurs yet.
 */

import type { IEventBus } from '../jarvis-core/interfaces';
import type {
  IPlugin,
  PluginId,
  PluginContext,
  PluginStorage,
  PluginLogger,
  HookResult,
  HookRegistration,
} from './types';
import { PluginRegistry } from './registry';
import { BasePlugin } from './plugin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock PluginContext for structural use.
 * In future, this will provide real storage, logger, and event bus.
 */
function createMockContext(pluginId: PluginId, eventBus: IEventBus): PluginContext {
  const mockStorage: PluginStorage = {
    async get<T = unknown>(_key: string): Promise<T | null> {
      return null;
    },
    async set<T = unknown>(_key: string, _value: T): Promise<void> {},
    async delete(_key: string): Promise<void> {},
    async clear(): Promise<void> {},
    async keys(): Promise<string[]> {
      return [];
    },
  };

  const mockLogger: PluginLogger = {
    debug(message: string, ...args: unknown[]): void {
      console.debug('[Plugin:' + pluginId + '] ' + message, ...args);
    },
    info(message: string, ...args: unknown[]): void {
      console.log('[Plugin:' + pluginId + '] ' + message, ...args);
    },
    warn(message: string, ...args: unknown[]): void {
      console.warn('[Plugin:' + pluginId + '] ' + message, ...args);
    },
    error(message: string, ...args: unknown[]): void {
      console.error('[Plugin:' + pluginId + '] ' + message, ...args);
    },
  };

  return {
    pluginId,
    events: eventBus,
    storage: mockStorage,
    logger: mockLogger,
    dataDir: '',
  };
}

// ---------------------------------------------------------------------------
// Plugin Manager
// ---------------------------------------------------------------------------

class PluginManager {
  private readonly registry: PluginRegistry;
  private readonly eventBus: IEventBus;

  /** Hook registrations for before/after execute. */
  private readonly beforeHooks: HookRegistration[] = [];
  private readonly afterHooks: HookRegistration[] = [];

  constructor(eventBus: IEventBus) {
    this.registry = new PluginRegistry();
    this.eventBus = eventBus;
    console.log('[PluginManager] Initialized.');
  }

  // -----------------------------------------------------------------------
  // Lifecycle management
  // -----------------------------------------------------------------------

  /**
   * Install a plugin.
   *
   * Registers the plugin and transitions it to 'installed'.
   * Calls onInstall() on the plugin.
   */
  async installPlugin(plugin: IPlugin): Promise<void> {
    this.registry.register(plugin);

    const context = createMockContext(plugin.manifest.id, this.eventBus);

    try {
      if (plugin instanceof BasePlugin) {
        plugin._transition('installed');
      }
      await plugin.onInstall(context);
      this.eventBus.emit({ type: 'plugin:installed', pluginId: plugin.manifest.id });
    } catch (error) {
      this.eventBus.emit({
        type: 'plugin:error',
        pluginId: plugin.manifest.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Load a plugin into memory.
   *
   * Transitions from 'installed' to 'loaded'.
   * Calls onLoad() on the plugin.
   */
  async loadPlugin(pluginId: PluginId): Promise<void> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error('[PluginManager] Plugin not found: ' + pluginId);
    }

    const context = createMockContext(pluginId, this.eventBus);

    try {
      if (plugin instanceof BasePlugin) {
        plugin._transition('loaded');
      }
      await plugin.onLoad(context);
      this.eventBus.emit({ type: 'plugin:loaded', pluginId });
    } catch (error) {
      this.eventBus.emit({
        type: 'plugin:error',
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Enable (activate) a plugin.
   *
   * Transitions from 'loaded' to 'enabled'.
   * Calls onEnable() on the plugin.
   */
  async enablePlugin(pluginId: PluginId): Promise<void> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error('[PluginManager] Plugin not found: ' + pluginId);
    }

    const context = createMockContext(pluginId, this.eventBus);

    try {
      if (plugin instanceof BasePlugin) {
        plugin._transition('enabled');
      }
      await plugin.onEnable(context);
      this.eventBus.emit({ type: 'plugin:enabled', pluginId });
    } catch (error) {
      this.eventBus.emit({
        type: 'plugin:error',
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Disable (pause) a plugin.
   *
   * Transitions from 'enabled' to 'disabled'.
   * Calls onDisable() on the plugin.
   */
  async disablePlugin(pluginId: PluginId): Promise<void> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error('[PluginManager] Plugin not found: ' + pluginId);
    }

    const context = createMockContext(pluginId, this.eventBus);

    try {
      if (plugin instanceof BasePlugin) {
        plugin._transition('disabled');
      }
      await plugin.onDisable(context);
      this.eventBus.emit({ type: 'plugin:disabled', pluginId });
    } catch (error) {
      this.eventBus.emit({
        type: 'plugin:error',
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Unload a plugin from memory.
   *
   * Transitions from 'loaded' or 'disabled' to 'installed'.
   * Calls onUnload() on the plugin.
   */
  async unloadPlugin(pluginId: PluginId): Promise<void> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error('[PluginManager] Plugin not found: ' + pluginId);
    }

    const context = createMockContext(pluginId, this.eventBus);

    try {
      if (plugin instanceof BasePlugin) {
        plugin._transition('uninstalled');
      }
      await plugin.onUnload(context);
      this.eventBus.emit({ type: 'plugin:unloaded', pluginId });
    } catch (error) {
      this.eventBus.emit({
        type: 'plugin:error',
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Permanently destroy (remove) a plugin.
   *
   * Unregisters from the registry, transitions to 'uninstalled'.
   * Calls onDestroy() on the plugin.
   */
  async destroyPlugin(pluginId: PluginId): Promise<void> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error('[PluginManager] Plugin not found: ' + pluginId);
    }

    const context = createMockContext(pluginId, this.eventBus);

    try {
      if (plugin instanceof BasePlugin) {
        plugin._transition('uninstalled');
      }
      await plugin.onDestroy(context);
    } catch (error) {
      console.error('[PluginManager] Error destroying plugin ' + pluginId + ':', error);
    }

    this.registry.unregister(pluginId);
    this.eventBus.emit({ type: 'plugin:destroyed', pluginId });
  }

  // -----------------------------------------------------------------------
  // Registry accessors
  // -----------------------------------------------------------------------

  getPlugin(pluginId: PluginId): IPlugin | undefined {
    return this.registry.get(pluginId);
  }

  listPlugins(): IPlugin[] {
    return this.registry.list();
  }

  listEnabledPlugins(): IPlugin[] {
    return this.registry.listByState('enabled');
  }

  get pluginCount(): number {
    return this.registry.size;
  }

  // -----------------------------------------------------------------------
  // Execution hooks
  // -----------------------------------------------------------------------

  /**
   * Register a beforeExecute hook for a specific action type.
   */
  registerBeforeHook(hook: HookRegistration): void {
    this.beforeHooks.push(hook);
    this.beforeHooks.sort((a, b) => a.priority - b.priority);
    console.log(
      '[PluginManager] Before-hook registered: ' +
        hook.actionType +
        ' (plugin: ' +
        hook.pluginId +
        ', priority: ' +
        hook.priority +
        ')'
    );
  }

  /**
   * Register an afterExecute hook for a specific action type.
   */
  registerAfterHook(hook: HookRegistration): void {
    this.afterHooks.push(hook);
    this.afterHooks.sort((a, b) => a.priority - b.priority);
    console.log(
      '[PluginManager] After-hook registered: ' +
        hook.actionType +
        ' (plugin: ' +
        hook.pluginId +
        ', priority: ' +
        hook.priority +
        ')'
    );
  }

  /**
   * Run all beforeExecute hooks for an action type.
   *
   * Returns the first 'deny' or 'modify' decision, or 'allow' if
   * all hooks pass.
   */
  async runBeforeHooks(
    context: PluginContext,
    actionType: string,
    params: Record<string, unknown>
  ): Promise<HookResult> {
    const hooks = this.beforeHooks.filter((h) => h.actionType === actionType);

    for (const hook of hooks) {
      try {
        // eslint-disable-next-line no-await-in-loop -- hooks must run sequentially
        const result = await hook.handler(context, params);
        if (result.decision === 'deny' || result.decision === 'modify') {
          return result;
        }
      } catch (error) {
        console.error('[PluginManager] Before-hook error (' + hook.pluginId + ' / ' + actionType + '):', error);
      }
    }

    return { decision: 'allow' };
  }

  /**
   * Run all afterExecute hooks for an action type.
   */
  async runAfterHooks(
    context: PluginContext,
    actionType: string,
    params: Record<string, unknown>,
    result: unknown
  ): Promise<void> {
    const hooks = this.afterHooks.filter((h) => h.actionType === actionType);

    for (const hook of hooks) {
      try {
        // eslint-disable-next-line no-await-in-loop -- hooks must run sequentially
        await hook.handler(context, params);
        // Note: after-hooks don't get the result passed in HookRegistration.handler
        // signature. In a real implementation, HookRegistration would carry a
        // separate after-handler.
      } catch (error) {
        console.error('[PluginManager] After-hook error (' + hook.pluginId + ' / ' + actionType + '):', error);
      }
    }

    // Also notify the source plugin of the result
    void result;
    void params;
  }

  /**
   * Remove all hooks for a specific plugin.
   */
  removePluginHooks(pluginId: PluginId): void {
    const beforeCount = this.beforeHooks.length;
    const afterCount = this.afterHooks.length;

    for (let i = this.beforeHooks.length - 1; i >= 0; i--) {
      if (this.beforeHooks[i].pluginId === pluginId) {
        this.beforeHooks.splice(i, 1);
      }
    }
    for (let i = this.afterHooks.length - 1; i >= 0; i--) {
      if (this.afterHooks[i].pluginId === pluginId) {
        this.afterHooks.splice(i, 1);
      }
    }

    console.log(
      '[PluginManager] Removed hooks for plugin ' +
        pluginId +
        ' (before: ' +
        (beforeCount - this.beforeHooks.length) +
        ', after: ' +
        (afterCount - this.afterHooks.length) +
        ')'
    );
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  getDiagnostics(): Record<string, unknown> {
    return {
      pluginCount: this.registry.size,
      enabledCount: this.listEnabledPlugins().length,
      beforeHookCount: this.beforeHooks.length,
      afterHookCount: this.afterHooks.length,
      plugins: this.listPlugins().map((p) => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        state: p.state,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { PluginManager };
