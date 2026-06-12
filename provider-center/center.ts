/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provider Center — Unified Provider Management
 *
 * Bridges the ProviderManager (runtime) with JarvisConfigService (persistence)
 * and exposes a clean API for the UI layer.
 *
 * Responsibilities:
 * - Load persisted providers on startup
 * - Sync runtime provider state with config
 * - Health checking + model discovery
 * - Provider activation (runtime switching)
 * - Auto-discovery orchestration
 * - Diagnostics
 */

import { ProviderManager } from '../provider-manager/manager';
import { getJarvisConfig } from '../config/jarvis-config';
import type { JarvisConfigService, ProviderConfigEntry } from '../config/jarvis-config';
import type {
  ProviderStatus,
  ProviderHealth,
  NormalizedModel,
  DiscoveryResult,
  ProviderType,
} from '../provider-manager/types';
import type { IProvider, ProviderCapabilities } from '../jarvis-core/interfaces';

// ---------------------------------------------------------------------------
// Provider Center
// ---------------------------------------------------------------------------

class ProviderCenter {
  private readonly manager: ProviderManager;
  private readonly config: JarvisConfigService;

  /** Map from provider id to its config entry. */
  private providerConfigs = new Map<string, ProviderConfigEntry>();

  constructor(manager: ProviderManager, config?: JarvisConfigService) {
    this.manager = manager;
    this.config = config || getJarvisConfig();
    console.log('[ProviderCenter] Initialized.');
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /**
   * Load persisted providers and run auto-discovery.
   * Call once during system startup.
   */
  async initialize(): Promise<void> {
    console.log('[ProviderCenter] Loading persisted providers...');

    // Load from config
    const persisted = this.config.getProviders();
    for (const entry of persisted) {
      this.providerConfigs.set(entry.id, entry);
    }

    // Auto-discover (finds LM Studio + other local providers)
    const results = await this.manager.discoverAndRegister();

    // Sync config for discovered providers
    for (const result of results) {
      if (!result.reachable) continue;
      const existing = this.providerConfigs.get('lmstudio');
      if (existing && existing.autoDiscover) {
        existing.lastChecked = Date.now();
        this.config.setProvider(existing);
      }
    }

    // Activate the persisted active provider (or default)
    const activeId = this.config.getActiveProviderId()
      || this.config.getDefaultProviderId()
      || 'lmstudio';

    if (this.manager.listProviderIds().includes(activeId)) {
      await this.manager.activateProvider(activeId);
      console.log('[ProviderCenter] Activated persisted provider: ' + activeId);
    }

    console.log(
      '[ProviderCenter] Ready. ' +
      this.manager.providerCount + ' providers, ' +
      this.providerConfigs.size + ' configs.'
    );
  }

  // -----------------------------------------------------------------------
  // Provider CRUD
  // -----------------------------------------------------------------------

  /**
   * Add a new provider (manual configuration).
   */
  async addProvider(config: ProviderConfigEntry): Promise<{ ok: boolean; error?: string }> {
    // Persist config
    this.config.setProvider(config);
    this.providerConfigs.set(config.id, config);

    // For now, manual providers need to be registered via ProviderManager
    // Real provider instances (LMStudioProvider, etc.) require specific implementations
    console.log('[ProviderCenter] Added provider config: ' + config.id + ' (' + config.type + ')');

    return { ok: true };
  }

  /**
   * Remove a provider.
   */
  async removeProvider(providerId: string): Promise<{ ok: boolean; error?: string }> {
    await this.manager.removeProvider(providerId);
    this.config.removeProvider(providerId);
    this.providerConfigs.delete(providerId);
    return { ok: true };
  }

  /**
   * Update a provider's configuration.
   */
  updateProviderConfig(providerId: string, updates: Partial<ProviderConfigEntry>): void {
    const existing = this.providerConfigs.get(providerId);
    if (!existing) return;

    const updated = { ...existing, ...updates };
    this.config.setProvider(updated);
    this.providerConfigs.set(providerId, updated);
  }

  // -----------------------------------------------------------------------
  // Provider activation
  // -----------------------------------------------------------------------

  /**
   * Activate a provider (switch runtime).
   */
  async activateProvider(providerId: string): Promise<{ ok: boolean; error?: string }> {
    const ok = await this.manager.activateProvider(providerId);
    if (ok) {
      this.config.setActiveProviderId(providerId);
    }
    return { ok, error: ok ? undefined : 'Failed to activate provider' };
  }

  /**
   * Get the currently active provider id.
   */
  get activeProviderId(): string | null {
    return this.config.getActiveProviderId() || this.manager.listProviderIds()[0] || null;
  }

  // -----------------------------------------------------------------------
  // Health & models
  // -----------------------------------------------------------------------

  /**
   * Run a health check on a provider.
   */
  async checkHealth(providerId: string): Promise<ProviderHealth> {
    return this.manager.checkHealth(providerId);
  }

  /**
   * Run health checks on all registered providers.
   */
  async checkAllHealth(): Promise<Map<string, ProviderHealth>> {
    const results = new Map<string, ProviderHealth>();
    for (const id of this.manager.listProviderIds()) {
      results.set(id, await this.manager.checkHealth(id));
    }
    return results;
  }

  /**
   * Refresh model list for a provider.
   */
  async refreshModels(providerId: string): Promise<NormalizedModel[]> {
    return this.manager.refreshModels(providerId);
  }

  /**
   * Get cached models for a provider.
   */
  getModels(providerId: string): NormalizedModel[] {
    return this.manager.getModels(providerId);
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * List all providers with full status.
   */
  listProviders(): ProviderStatus[] {
    return this.manager.listProviders();
  }

  /**
   * Get a specific provider's status.
   */
  getProviderStatus(providerId: string): ProviderStatus | undefined {
    return this.manager.listProviders().find((p) => p.providerId === providerId);
  }

  /**
   * Get a provider's config entry.
   */
  getProviderConfig(providerId: string): ProviderConfigEntry | undefined {
    return this.providerConfigs.get(providerId);
  }

  /**
   * Get all provider configs.
   */
  getAllConfigs(): ProviderConfigEntry[] {
    return [...this.providerConfigs.values()];
  }

  /**
   * Get the provider count.
   */
  get providerCount(): number {
    return this.manager.providerCount;
  }

  // -----------------------------------------------------------------------
  // Auto-discovery
  // -----------------------------------------------------------------------

  /**
   * Run auto-discovery and register any new providers found.
   */
  async runDiscovery(): Promise<DiscoveryResult[]> {
    return this.manager.discoverAndRegister();
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  getDiagnostics(): Record<string, unknown> {
    const managerDiag = this.manager.getDiagnostics() as Record<string, unknown>;
    return {
      ...managerDiag,
      configSource: this.config.getSource(),
      configuredProviders: this.getAllConfigs().map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        endpoint: c.endpoint,
        enabled: c.enabled,
        autoDiscover: c.autoDiscover,
      })),
      activeProviderId: this.activeProviderId,
      defaultProviderId: this.config.getDefaultProviderId(),
      defaultModelId: this.config.getDefaultModelId(),
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ProviderCenter };
