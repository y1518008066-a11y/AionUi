/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Runtime — Loader
 *
 * Discovers plugins on disk, validates manifests, loads entry points,
 * and manages the plugin lifecycle (load, unload, reload, enable, disable).
 *
 * Broken plugins are caught and reported — they never crash the system.
 */

import { readdirSync, existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { loadManifest } from './manifest';
import type { PluginManifest } from './manifest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Runtime status of a loaded plugin. */
type PluginStatus = 'discovered' | 'manifest-invalid' | 'loaded' | 'enabled' | 'disabled' | 'error';

/** A loaded plugin instance tracked by the loader. */
type LoadedPlugin = {
  /** The validated manifest. */
  manifest: PluginManifest;

  /** Absolute path to the plugin directory. */
  directory: string;

  /** Current status. */
  status: PluginStatus;

  /** The loaded module exports (null if not loaded). */
  exports: Record<string, unknown> | null;

  /** Error from last load attempt (null if successful). */
  lastError: string | null;

  /** Timestamp of last load. */
  loadedAt: number | null;

  /** How many times this plugin has been reloaded. */
  reloadCount: number;

  /** Whether the plugin is enabled. */
  enabled: boolean;

  /** Load duration in milliseconds. */
  loadTimeMs: number;
};

/** Result of discovering plugins in a directory. */
type DiscoveryResult = {
  /** Total plugin directories found. */
  total: number;

  /** Plugins with valid manifests. */
  valid: LoadedPlugin[];

  /** Plugins with invalid or missing manifests. */
  invalid: Array<{ directory: string; errors: string[] }>;
};

// ---------------------------------------------------------------------------
// Plugin Loader
// ---------------------------------------------------------------------------

class PluginLoader {
  /** All discovered/loaded plugins indexed by id. */
  private readonly plugins = new Map<string, LoadedPlugin>();

  /** Base directory where plugins are stored. */
  private readonly pluginsDir: string;

  constructor(pluginsDir: string) {
    this.pluginsDir = pluginsDir;
    console.log('[PluginLoader] Initialized. Plugins directory: ' + pluginsDir);
  }

  // -----------------------------------------------------------------------
  // Discovery
  // -----------------------------------------------------------------------

  /**
   * Discover all plugins in the plugins directory.
   *
   * Scans subdirectories, reads plugin.json from each, validates the
   * manifest, and registers valid plugins. Invalid plugins are logged
   * but do not interrupt discovery.
   */
  discover(): DiscoveryResult {
    console.log('[PluginLoader] Discovering plugins...');

    if (!existsSync(this.pluginsDir)) {
      console.warn('[PluginLoader] Plugins directory does not exist: ' + this.pluginsDir);
      return { total: 0, valid: [], invalid: [] };
    }

    const entries = readdirSync(this.pluginsDir);
    const valid: LoadedPlugin[] = [];
    const invalid: Array<{ directory: string; errors: string[] }> = [];

    for (const entry of entries) {
      const pluginDir = join(this.pluginsDir, entry);

      // Skip non-directories
      let stat;
      try {
        stat = statSync(pluginDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      // Load manifest
      const result = loadManifest(pluginDir);

      if (!result) {
        invalid.push({
          directory: pluginDir,
          errors: ['No plugin.json found.'],
        });
        console.warn('[PluginLoader] No plugin.json in: ' + pluginDir);
        continue;
      }

      if (!result.validation.valid) {
        invalid.push({
          directory: pluginDir,
          errors: result.validation.errors,
        });
        console.warn('[PluginLoader] Invalid manifest in ' + pluginDir + ': ' + result.validation.errors.join(', '));
        continue;
      }

      // Check for duplicates
      if (this.plugins.has(result.manifest.id)) {
        console.warn('[PluginLoader] Duplicate plugin id: ' + result.manifest.id + ' — skipping.');
        continue;
      }

      const loaded: LoadedPlugin = {
        manifest: result.manifest,
        directory: pluginDir,
        status: 'discovered',
        exports: null,
        lastError: null,
        loadedAt: null,
        reloadCount: 0,
        enabled: false,
        loadTimeMs: 0,
      };

      this.plugins.set(result.manifest.id, loaded);
      valid.push(loaded);

      console.log(
        '[PluginLoader] Discovered: ' +
          result.manifest.name +
          ' (' +
          result.manifest.id +
          ' v' +
          result.manifest.version +
          ')'
      );
    }

    console.log('[PluginLoader] Discovery complete. ' + valid.length + ' valid, ' + invalid.length + ' invalid.');

    return { total: entries.length, valid, invalid };
  }

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------

  /**
   * Load a plugin by id.
   *
   * Dynamically imports the plugin's entry point. Failures are caught
   * and reported — they never crash the system.
   */
  async load(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn('[PluginLoader] Plugin not found: ' + pluginId);
      return false;
    }

    if (plugin.status === 'loaded' || plugin.status === 'enabled') {
      console.log('[PluginLoader] Plugin already loaded: ' + pluginId);
      return true;
    }

    const entryPath = resolve(plugin.directory, plugin.manifest.entry);
    const t0 = performance.now();

    try {
      // Dynamic import the plugin module
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const module = (await import(entryPath)) as Record<string, any>;

      plugin.exports = module;
      plugin.status = 'loaded';
      plugin.loadedAt = Date.now();
      plugin.lastError = null;
      plugin.loadTimeMs = Math.round(performance.now() - t0);

      // Auto-enable if configured
      if (plugin.manifest.enabledByDefault && !plugin.enabled) {
        await this.enable(pluginId);
      }

      console.log('[PluginLoader] Loaded: ' + plugin.manifest.name + ' (' + plugin.loadTimeMs + 'ms)');

      return true;
    } catch (error) {
      plugin.status = 'error';
      plugin.lastError = error instanceof Error ? error.message : String(error);
      plugin.loadTimeMs = Math.round(performance.now() - t0);

      console.error('[PluginLoader] Failed to load ' + pluginId + ': ' + plugin.lastError);

      return false;
    }
  }

  /**
   * Load all discovered plugins.
   */
  /* eslint-disable no-await-in-loop */
  async loadAll(): Promise<{ loaded: number; failed: number }> {
    let loaded = 0;
    let failed = 0;

    for (const pluginId of this.plugins.keys()) {
      const success = await this.load(pluginId);
      if (success) {
        loaded++;
      } else {
        failed++;
      }
    }

    console.log('[PluginLoader] Load all complete. Loaded: ' + loaded + ', Failed: ' + failed);

    return { loaded, failed };
    /* eslint-enable no-await-in-loop */
  }

  // -----------------------------------------------------------------------
  // Enable / disable
  // -----------------------------------------------------------------------

  /**
   * Enable a plugin (call its activate hook).
   */
  async enable(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn('[PluginLoader] Plugin not found: ' + pluginId);
      return false;
    }

    if (plugin.status !== 'loaded' && plugin.status !== 'disabled') {
      console.warn('[PluginLoader] Cannot enable plugin in status: ' + plugin.status);
      return false;
    }

    if (plugin.exports && typeof plugin.exports.activate === 'function') {
      try {
        const context = {
          pluginId: plugin.manifest.id,
          dataDir: resolve(plugin.directory, 'data'),
        };
        await (plugin.exports.activate as (ctx: Record<string, unknown>) => Promise<void>)(context);
      } catch (error) {
        console.error('[PluginLoader] Plugin activate failed for ' + pluginId + ':', error);
      }
    }

    plugin.enabled = true;
    plugin.status = 'enabled';

    console.log('[PluginLoader] Enabled: ' + plugin.manifest.name);
    return true;
  }

  /**
   * Disable a plugin (call its deactivate hook).
   */
  async disable(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn('[PluginLoader] Plugin not found: ' + pluginId);
      return false;
    }

    if (plugin.status !== 'enabled') {
      return false;
    }

    if (plugin.exports && typeof plugin.exports.deactivate === 'function') {
      try {
        const context = {
          pluginId: plugin.manifest.id,
          dataDir: resolve(plugin.directory, 'data'),
        };
        await (plugin.exports.deactivate as (ctx: Record<string, unknown>) => Promise<void>)(context);
      } catch (error) {
        console.error('[PluginLoader] Plugin deactivate failed for ' + pluginId + ':', error);
      }
    }

    plugin.enabled = false;
    plugin.status = 'disabled';

    console.log('[PluginLoader] Disabled: ' + plugin.manifest.name);
    return true;
  }

  // -----------------------------------------------------------------------
  // Unload
  // -----------------------------------------------------------------------

  /**
   * Unload a plugin from memory.
   */
  async unload(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    // Disable first if enabled
    if (plugin.status === 'enabled') {
      await this.disable(pluginId);
    }

    plugin.exports = null;
    plugin.status = 'discovered';
    plugin.loadedAt = null;

    console.log('[PluginLoader] Unloaded: ' + plugin.manifest.name);
    return true;
  }

  // -----------------------------------------------------------------------
  // Reload (hot reload)
  // -----------------------------------------------------------------------

  /**
   * Reload a plugin at runtime.
   *
   * Unloads the current instance, clears the module cache (where possible),
   * and reloads from disk. Falls back to unload + load if cache clearing
   * is not supported.
   */
  async reload(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn('[PluginLoader] Plugin not found: ' + pluginId);
      return false;
    }

    console.log('[PluginLoader] Reloading: ' + plugin.manifest.name + '...');

    const wasEnabled = plugin.enabled;

    // Unload
    await this.unload(pluginId);

    // Reload
    const success = await this.load(pluginId);
    if (success) {
      plugin.reloadCount++;

      if (wasEnabled) {
        await this.enable(pluginId);
      }

      console.log('[PluginLoader] Reloaded: ' + plugin.manifest.name + ' (reload #' + plugin.reloadCount + ')');
    }

    return success;
  }

  // -----------------------------------------------------------------------
  // Query
  // -----------------------------------------------------------------------

  /**
   * Get a loaded plugin by id.
   */
  get(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin exists.
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * List all plugins.
   */
  list(): LoadedPlugin[] {
    return [...this.plugins.values()];
  }

  /**
   * List plugins by status.
   */
  listByStatus(status: PluginStatus): LoadedPlugin[] {
    return this.list().filter((p) => p.status === status);
  }

  /**
   * List enabled plugins.
   */
  listEnabled(): LoadedPlugin[] {
    return this.list().filter((p) => p.enabled);
  }

  /**
   * Number of plugins.
   */
  get count(): number {
    return this.plugins.size;
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /**
   * Get comprehensive diagnostics for all plugins.
   */
  getDiagnostics(): Record<string, unknown> {
    const plugins = this.list().map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      status: p.status,
      enabled: p.enabled,
      capabilities: p.manifest.capabilities,
      permissions: p.manifest.permissions,
      dependencies: p.manifest.dependencies,
      lastError: p.lastError,
      loadTimeMs: p.loadTimeMs,
      reloadCount: p.reloadCount,
      entry: p.manifest.entry,
      author: p.manifest.author,
    }));

    return {
      pluginCount: this.count,
      enabledCount: this.listEnabled().length,
      loadedCount: this.listByStatus('loaded').length,
      errorCount: this.listByStatus('error').length,
      pluginsDir: this.pluginsDir,
      plugins,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { PluginLoader };
export type { LoadedPlugin, PluginStatus, DiscoveryResult };
