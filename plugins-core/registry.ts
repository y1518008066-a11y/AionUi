/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin System Core — Registry
 *
 * In-memory registry for all known plugins. Provides CRUD operations
 * with no runtime side effects — just data management.
 */

import type { IPlugin, PluginId } from './types';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

class PluginRegistry {
  private readonly plugins = new Map<PluginId, IPlugin>();

  /**
   * Register a plugin in the registry.
   *
   * @throws If a plugin with the same id is already registered.
   */
  register(plugin: IPlugin): void {
    if (this.plugins.has(plugin.manifest.id)) {
      throw new Error('[PluginRegistry] Plugin "' + plugin.manifest.id + '" is already registered.');
    }
    this.plugins.set(plugin.manifest.id, plugin);
    console.log(
      '[PluginRegistry] Registered: ' +
        plugin.manifest.name +
        ' (' +
        plugin.manifest.id +
        ' v' +
        plugin.manifest.version +
        ')'
    );
  }

  /**
   * Remove a plugin from the registry.
   *
   * @returns true if the plugin was found and removed.
   */
  unregister(pluginId: PluginId): boolean {
    const existed = this.plugins.has(pluginId);
    if (existed) {
      this.plugins.delete(pluginId);
      console.log('[PluginRegistry] Unregistered: ' + pluginId);
    }
    return existed;
  }

  /**
   * Get a plugin by id.
   */
  get(pluginId: PluginId): IPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin exists in the registry.
   */
  has(pluginId: PluginId): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * List all registered plugins.
   */
  list(): IPlugin[] {
    return [...this.plugins.values()];
  }

  /**
   * List plugins filtered by state.
   */
  listByState(state: string): IPlugin[] {
    return this.list().filter((p) => p.state === state);
  }

  /**
   * List plugins filtered by origin.
   */
  listByOrigin(origin: string): IPlugin[] {
    return this.list().filter((p) => p.manifest.origin === origin);
  }

  /**
   * List plugins that declare a specific capability.
   */
  listByCapability(capability: keyof IPlugin['capabilities']): IPlugin[] {
    return this.list().filter((p) => p.capabilities[capability]);
  }

  /**
   * List plugins that handle a specific action type.
   */
  listByAction(actionType: string): IPlugin[] {
    return this.list().filter((p) => p.capabilities.actions.includes(actionType));
  }

  /**
   * Number of registered plugins.
   */
  get size(): number {
    return this.plugins.size;
  }

  /**
   * Remove all plugins from the registry.
   */
  clear(): void {
    const count = this.plugins.size;
    this.plugins.clear();
    console.log('[PluginRegistry] Cleared ' + count + ' plugins.');
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { PluginRegistry };
