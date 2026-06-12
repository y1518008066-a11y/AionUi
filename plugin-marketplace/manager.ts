/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Marketplace 鈥?Unified Plugin Manager
 *
 * The central orchestrator for the entire plugin ecosystem.
 * Integrates PluginLoader, Marketplace, Installer, DependencyResolver,
 * and PermissionManager into a single API.
 */

import { PluginLoader } from '../plugin-runtime/index';
import { Marketplace, createLocalMarketplace } from './marketplace';
import { PluginInstaller } from './installer';
import { DependencyResolver } from './dependency';
import { PermissionManager } from './permissions';
import { loadManifest } from '../plugin-runtime/manifest';
import type {
  PluginStatus,
  PluginState,
  PluginOrigin,
  InstallSource,
  InstallResult,
  UninstallResult,
  MarketplaceQuery,
  MarketplaceEntry,
  MarketplaceDiagnostics,
  PluginPermission,
  PluginCapability,
} from './types';

// ---------------------------------------------------------------------------
// Plugin Manager
// ---------------------------------------------------------------------------

class PluginManager {
  private loader: PluginLoader;
  private marketplace: Marketplace;
  private installer: PluginInstaller;
  private dependencyResolver: DependencyResolver;
  private permissionManager: PermissionManager;

  private origins = new Map<string, PluginOrigin>();
  private installedAt = new Map<string, number>();
  private updatedAt = new Map<string, number>();

  constructor(pluginsRootDir = 'plugins') {
    this.loader = new PluginLoader(pluginsRootDir);
    this.marketplace = createLocalMarketplace(pluginsRootDir);
    this.installer = new PluginInstaller();
    this.dependencyResolver = new DependencyResolver();
    this.permissionManager = new PermissionManager();

    console.log('[PluginManager] Initialized. Root: ' + pluginsRootDir);
  }

  // -----------------------------------------------------------------------
  // Discovery
  // -----------------------------------------------------------------------

  discover(): void {
    this.loader.discover();

    const plugins = this.loader.list();
    for (const p of plugins) {
      const manifest = p.manifest;
      if (manifest) {
        this.dependencyResolver.register(
          {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            author: manifest.author,
            description: manifest.description,
            entry: manifest.entry,
            permissions: (manifest.permissions || []) as PluginPermission[],
            dependencies: manifest.dependencies || [],
            capabilities: (manifest.capabilities || []) as PluginCapability[],
            minimumJarvisVersion: manifest.minimumJarvisVersion,
            enabledByDefault: manifest.enabledByDefault || false,
          },
          true
        );
        this.origins.set(manifest.id, 'local');
      }
    }
  }

  // -----------------------------------------------------------------------
  // Install / Uninstall / Upgrade
  // -----------------------------------------------------------------------

  async install(source: InstallSource): Promise<InstallResult> {
    const result = await this.installer.install(source);

    if (result.ok) {
      this.loader.discover();
      await this.loader.load(result.pluginId);

      this.origins.set(result.pluginId, source.type === 'marketplace' ? 'marketplace' : 'local');
      this.installedAt.set(result.pluginId, Date.now());
      this.updatedAt.set(result.pluginId, Date.now());

      const manifestResult = loadManifest(result.installPath);
      if (manifestResult?.validation.valid) {
        const m = manifestResult.manifest;
        this.dependencyResolver.register(
          {
            id: m.id,
            name: m.name,
            version: m.version,
            author: m.author,
            description: m.description,
            entry: m.entry,
            permissions: (m.permissions || []) as PluginPermission[],
            dependencies: m.dependencies || [],
            capabilities: (m.capabilities || []) as PluginCapability[],
            minimumJarvisVersion: m.minimumJarvisVersion,
            enabledByDefault: m.enabledByDefault || false,
          },
          true
        );
      }
    }

    return result;
  }

  async uninstall(pluginId: string, fullRemove = false): Promise<UninstallResult> {
    const affected = this.dependencyResolver.checkUninstallImpact(pluginId);

    if (this.loader.get(pluginId)?.enabled) {
      await this.loader.disable(pluginId);
    }
    await this.loader.unload(pluginId);

    const result = this.installer.uninstall(pluginId, fullRemove);

    this.permissionManager.removePlugin(pluginId);
    this.origins.delete(pluginId);
    this.installedAt.delete(pluginId);
    this.updatedAt.delete(pluginId);

    this.loader.discover();
    return { ...result, affectedDependents: affected };
  }

  async upgrade(pluginId: string, source: InstallSource): Promise<InstallResult> {
    const result = await this.installer.upgrade(pluginId, source);
    if (result.ok) {
      this.loader.discover();
      await this.loader.load(pluginId);
      this.updatedAt.set(pluginId, Date.now());
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async enable(pluginId: string): Promise<boolean> {
    // Ensure plugin is discovered and loaded before enabling
    this.loader.discover();
    const loaded = await this.loader.load(pluginId);
    if (!loaded) {
      console.warn('[PluginManager] Cannot enable ' + pluginId + ': load failed');
      return false;
    }
    return this.loader.enable(pluginId);

  }

  async disable(pluginId: string): Promise<boolean> {
    return this.loader.disable(pluginId);
  }

  /**
   * Check if a plugin is currently enabled.
   */
  isEnabled(pluginId: string): boolean {
    const p = this.loader.get(pluginId);
    return p?.enabled === true;
  }

  /**
   * List all currently enabled plugin ids.
   */
  listEnabled(): string[] {
    return this.loader.listEnabled().map((p) => p.manifest.id);
  }

  /**
   * Get a reference to the PluginLoader (for diagnostics / mode orchestration).
   */
  getLoader(): PluginLoader {
    return this.loader;
  }

  async reload(pluginId: string): Promise<boolean> {
    return this.loader.reload(pluginId);
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  list(): PluginStatus[] {
    const plugins = this.loader.list();
    return plugins.map((p) => ({
      id: p.manifest?.id || '',
      name: p.manifest?.name || '',
      version: p.manifest?.version || '0.0.0',
      state: this.mapState(p.status, p.enabled),
      origin: this.origins.get(p.manifest?.id || '') || 'local',
      enabled: p.enabled || false,
      capabilities: (p.manifest?.capabilities || []) as PluginCapability[],
      permissions: (p.manifest?.permissions || []) as PluginPermission[],
      dependencies: p.manifest?.dependencies || [],
      path: p.manifest?.entry || '',
      installedAt: this.installedAt.get(p.manifest?.id || '') || 0,
      updatedAt: this.updatedAt.get(p.manifest?.id || '') || 0,
      loadTimeMs: p.loadTimeMs || 0,
      reloadCount: p.reloadCount || 0,
      lastError: p.lastError || null,
      updateAvailable: null,
    }));
  }

  async searchMarketplace(query: MarketplaceQuery = {}): Promise<MarketplaceEntry[]> {
    return this.marketplace.search(query);
  }

  getStatus(pluginId: string): PluginStatus | null {
    const p = this.loader.get(pluginId);
    if (!p) return null;

    return {
      id: p.manifest?.id || pluginId,
      name: p.manifest?.name || '',
      version: p.manifest?.version || '0.0.0',
      state: this.mapState(p.status, p.enabled),
      origin: this.origins.get(pluginId) || 'local',
      enabled: p.enabled || false,
      capabilities: (p.manifest?.capabilities || []) as PluginCapability[],
      permissions: (p.manifest?.permissions || []) as PluginPermission[],
      dependencies: p.manifest?.dependencies || [],
      path: p.manifest?.entry || '',
      installedAt: this.installedAt.get(pluginId) || 0,
      updatedAt: this.updatedAt.get(pluginId) || 0,
      loadTimeMs: p.loadTimeMs || 0,
      reloadCount: p.reloadCount || 0,
      lastError: p.lastError || null,
      updateAvailable: null,
    };
  }

  getManifest(pluginId: string): Record<string, unknown> | null {
    const p = this.loader.get(pluginId);
    return p?.manifest || null;
  }

  // -----------------------------------------------------------------------
  // Permissions
  // -----------------------------------------------------------------------

  validatePermissions(pluginId: string) {
    const manifest = this.getManifest(pluginId);
    if (!manifest) return null;
    const permissions = (manifest.permissions || []) as PluginPermission[];
    return this.permissionManager.validate(pluginId, permissions);
  }

  grantConsent(pluginId: string, permissions: PluginPermission[]): void {
    this.permissionManager.grantConsent(pluginId, permissions);
  }

  // -----------------------------------------------------------------------
  // Dependencies
  // -----------------------------------------------------------------------

  resolveDependencies(pluginIds: string[]) {
    return this.dependencyResolver.resolve(pluginIds);
  }

  getDependencyTree(pluginId: string): string {
    return this.dependencyResolver.getDependencyTree(pluginId);
  }

  // -----------------------------------------------------------------------
  // Marketplace access
  // -----------------------------------------------------------------------

  getMarketplace(): Marketplace {
    return this.marketplace;
  }

  async refreshMarketplace(): Promise<void> {
    await this.marketplace.refresh();
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  async getDiagnostics(): Promise<MarketplaceDiagnostics> {
    const allPlugins = this.list();
    const enabledCount = allPlugins.filter((p) => p.state === 'enabled').length;
    const disabledCount = allPlugins.filter((p) => p.state === 'disabled').length;
    const errorCount = allPlugins.filter((p) => p.state === 'error').length;
    const depSummary = this.dependencyResolver.getDiagnostics();
    const permSummary = this.permissionManager.getDiagnostics();
    const mpSummary = await this.marketplace.getDiagnostics();

    return {
      marketplaceSize: mpSummary.marketplaceSize,
      installedCount: allPlugins.length,
      enabledCount,
      disabledCount,
      errorCount,
      plugins: allPlugins,
      dependencySummary: depSummary,
      permissionSummary: permSummary,
      marketplaceSource: mpSummary.sources[0] || null,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private mapState(status: string, enabled: boolean): PluginState {
    if (status === 'loaded') return enabled ? 'enabled' : 'disabled';
    if (status === 'error') return 'error';
    return 'discovered';
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { PluginManager };
