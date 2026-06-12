/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provider Manager 鈥?Core Orchestrator
 *
 * Manages the complete provider lifecycle:
 * - Auto-discovery of running providers
 * - Registration / unregistration
 * - Enable / disable
 * - Health checking
 * - Model discovery & normalization
 * - Active provider switching
 * - Failover architecture (disabled by default)
 * - Diagnostics
 *
 * Integrates with jarvis-core (EventBus), ai-router (AIRouter),
 * and mode-system (ModeManager).
 */

import type { IEventBus, IJarvisCore, IProvider } from '../jarvis-core/interfaces';
import type { AIRouter } from '../ai-router/router';
import type { ModeManager } from '../mode-system/manager';
import type {
  ProviderType,
  DiscoveryResult,
  ProviderHealth,
  NormalizedModel,
  ProviderStatus,
  FailoverConfig,
} from './types';
import { discoverProviders } from './discovery';
import { LMStudioProvider } from '../providers/lmstudio';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  enabled: false,
  failureThreshold: 3,
  retryIntervalMs: 30000,
  fallbackOrder: [],
  autoRecover: false,
};

// ---------------------------------------------------------------------------
// Provider Manager
// ---------------------------------------------------------------------------

class ProviderManager {
  private readonly eventBus: IEventBus;
  private readonly jarvisCore: IJarvisCore;
  private aiRouter: AIRouter | null = null;
  private modeManager: ModeManager | null = null;

  /** All registered providers. */
  private readonly providerInstances = new Map<string, IProvider>();

  /** Health state per provider. */
  private readonly healthStates = new Map<string, ProviderHealth>();

  /** Cached normalized models per provider. */
  private readonly modelCache = new Map<string, NormalizedModel[]>();

  /** Currently active provider id. */
  private activeProviderId: string | null = null;

  /** Request counters per provider. */
  private readonly requestCounters = new Map<string, number>();

  /** Registration timestamps. */
  private readonly registeredAt = new Map<string, number>();

  /** Failover configuration. */
  private failoverConfig: FailoverConfig = { ...DEFAULT_FAILOVER_CONFIG };

  constructor(jarvisCore: IJarvisCore) {
    this.jarvisCore = jarvisCore;
    this.eventBus = jarvisCore.events;
    console.log('[ProviderManager] Initialized.');
  }

  // -----------------------------------------------------------------------
  // Bindings
  // -----------------------------------------------------------------------

  /**
   * Bind to the AI Router for provider registration integration.
   */
  bindRouter(router: AIRouter): void {
    this.aiRouter = router;
    console.log('[ProviderManager] Bound to AIRouter.');
  }

  /**
   * Bind to the Mode Manager for mode-aware provider switching.
   */
  bindModeManager(manager: ModeManager): void {
    this.modeManager = manager;
    console.log('[ProviderManager] Bound to ModeManager.');
  }

  // -----------------------------------------------------------------------
  // Auto-discovery
  // -----------------------------------------------------------------------

  /**
   * Auto-discover running providers and register reachable ones.
   *
   * For LM Studio: creates an LMStudioProvider for each reachable
   * instance. Other provider types are logged as future targets.
   */
  async discoverAndRegister(): Promise<DiscoveryResult[]> {
    console.log('[ProviderManager] Starting auto-discovery...');
    const results = await discoverProviders();

    /* eslint-disable no-await-in-loop */
    for (const result of results) {
      if (!result.reachable) continue;

      switch (result.target.type) {
        case 'lmstudio': {
          const id = 'lmstudio-' + result.target.endpoint.replace(/[^a-zA-Z0-9]/g, '-');
          if (this.providerInstances.has(id)) {
            console.log('[ProviderManager] LM Studio already registered: ' + id);
            continue;
          }

          const provider = new LMStudioProvider({
            id,
            name: 'LM Studio (' + result.target.endpoint + ')',
            baseUrl: result.target.endpoint,
            timeoutMs: 10000,
            maxRetries: 2,
          });

          await this.registerProvider(provider);
          break;
        }
        case 'ollama':
        case 'vllm':
        case 'localai':
        case 'newapi':
          console.log(
            '[ProviderManager] ' +
              result.target.type +
              ' discovered at ' +
              result.target.endpoint +
              ' 鈥?provider implementation pending.'
          );
          break;
        default:
          break;
      }
    }
    /* eslint-enable no-await-in-loop */

    this.eventBus.emit({
      type: 'providers:discovered',
      count: results.filter((r) => r.reachable).length,
    });

    return results;
  }

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /**
   * Register a provider instance.
   */
  async registerProvider(provider: IProvider): Promise<void> {
    if (this.providerInstances.has(provider.id)) {
      console.warn('[ProviderManager] Provider already registered: ' + provider.id);
      return;
    }

    this.providerInstances.set(provider.id, provider);
    this.registeredAt.set(provider.id, Date.now());
    this.requestCounters.set(provider.id, 0);

    // Initialize health
    this.healthStates.set(provider.id, {
      reachable: false,
      connected: false,
      latencyMs: 0,
      endpoint: provider.baseUrl,
      protocol: provider.protocol,
      providerType: 'manual',
      modelCount: 0,
      lastChecked: null,
      lastError: null,
      consecutiveFailures: 0,
    });

    // Register with Jarvis Core
    try {
      await this.jarvisCore.registerProvider(provider);
    } catch {
      // Already registered 鈥?non-fatal
    }

    // Register with AI Router
    if (this.aiRouter) {
      await this.aiRouter.registerProvider(provider);
    }

    console.log('[ProviderManager] Registered: ' + provider.name + ' (' + provider.id + ', ' + provider.protocol + ')');

    this.eventBus.emit({ type: 'providers:registered', providerId: provider.id });

    // Auto-activate if this is the first provider
    if (!this.activeProviderId) {
      await this.activateProvider(provider.id);
    }
  }

  /**
   * Unregister a provider.
   */
  async unregisterProvider(providerId: string): Promise<void> {
    const provider = this.providerInstances.get(providerId);
    if (!provider) {
      console.warn('[ProviderManager] Provider not found: ' + providerId);
      return;
    }

    // Deactivate if active
    if (this.activeProviderId === providerId) {
      await this.deactivateProvider();
    }

    this.providerInstances.delete(providerId);
    this.healthStates.delete(providerId);
    this.modelCache.delete(providerId);
    this.requestCounters.delete(providerId);
    this.registeredAt.delete(providerId);

    console.log('[ProviderManager] Unregistered: ' + providerId);

    this.eventBus.emit({ type: 'providers:removed', providerId });
  }

  // -----------------------------------------------------------------------
  // Activation / switching
  // -----------------------------------------------------------------------

  /**
   * Activate a provider (make it the current active provider).
   *
   * Deactivates the previous active provider first.
   */
  async activateProvider(providerId: string): Promise<void> {
    const provider = this.providerInstances.get(providerId);
    if (!provider) {
      console.warn('[ProviderManager] Cannot activate unknown provider: ' + providerId);
      return;
    }

    if (this.activeProviderId === providerId) {
      return;
    }

    // Deactivate current
    if (this.activeProviderId) {
      this.eventBus.emit({
        type: 'providers:deactivated',
        providerId: this.activeProviderId,
      });
    }

    this.activeProviderId = providerId;

    // Notify router
    if (this.aiRouter) {
      this.aiRouter.setActiveProvider(providerId);
    }

    console.log('[ProviderManager] Activated: ' + provider.name + ' (' + providerId + ')');

    this.eventBus.emit({ type: 'providers:activated', providerId });
  }

  /**
   * Deactivate the current provider (no active provider).
   */
  async deactivateProvider(): Promise<void> {
    if (!this.activeProviderId) return;

    const previousId = this.activeProviderId;
    this.activeProviderId = null;

    console.log('[ProviderManager] Deactivated: ' + previousId);

    this.eventBus.emit({ type: 'providers:deactivated', providerId: previousId });
  }

  /**
   * Switch to a different provider at runtime.
   */
  async switchProvider(providerId: string): Promise<void> {
    await this.activateProvider(providerId);
  }

  /**
   * Get the currently active provider id.
   */
  get activeProvider(): string | null {
    return this.activeProviderId;
  }

  /**
   * Get the active provider instance.
   */
  getActiveProviderInstance(): IProvider | null {
    if (!this.activeProviderId) return null;
    return this.providerInstances.get(this.activeProviderId) || null;
  }

  // -----------------------------------------------------------------------
  // Enable / disable
  // -----------------------------------------------------------------------

  /**
   * Enable a provider.
   */
  async enableProvider(providerId: string): Promise<void> {
    const provider = this.providerInstances.get(providerId);
    if (!provider) {
      console.warn('[ProviderManager] Provider not found: ' + providerId);
      return;
    }

    // The IProvider interface doesn't have enable/disable natively.
    // LMStudioProvider tracks this internally.

    console.log('[ProviderManager] Enabled: ' + providerId);

    this.eventBus.emit({ type: 'provider:enabled', providerId });
  }

  /**
   * Disable a provider.
   */
  async disableProvider(providerId: string): Promise<void> {
    if (this.activeProviderId === providerId) {
      await this.deactivateProvider();
    }

    console.log('[ProviderManager] Disabled: ' + providerId);

    this.eventBus.emit({ type: 'provider:disabled', providerId });
  }

  // -----------------------------------------------------------------------
  // Health checking
  // -----------------------------------------------------------------------

  /**
   * Check health for all registered providers.
   */
  async checkAllHealth(): Promise<Map<string, ProviderHealth>> {
    console.log('[ProviderManager] Running health checks...');

    /* eslint-disable no-await-in-loop */
    for (const [providerId, provider] of this.providerInstances) {
      await this.checkProviderHealth(providerId, provider);
    }
    /* eslint-enable no-await-in-loop */

    return this.healthStates;
  }

  /**
   * Check health for a single provider.
   */
  async checkHealth(providerId: string): Promise<ProviderHealth> {
    const provider = this.providerInstances.get(providerId);
    if (!provider) {
          // Check if provider has its own health check
    let modelCount = 0;
    try {
      const providerHealth = await provider.checkHealth();
      if (providerHealth && providerHealth.modelCount !== undefined) {
        modelCount = providerHealth.modelCount;
      }
    } catch { /* use default */ }

    const result: ProviderHealth = {
      reachable: health.reachable,
      connected: health.reachable,
      latencyMs: health.latencyMs || 0,
      endpoint: provider.baseUrl,
      protocol: provider.protocol,
      providerType: type,
      modelCount: modelCount || health.modelCount || 0,
      lastChecked: Date.now(),
      lastError: health.error || null,
      consecutiveFailures: health.reachable ? 0 : (existing?.consecutiveFailures || 0) + 1,
    };
      this.healthStates.set(providerId, result);
      return result;
    }
    return this.checkProviderHealth(providerId, provider);
  }

  /**
   * Refresh models for a single provider.
   */
    async refreshModels(providerId: string): Promise<NormalizedModel[]> {
    const provider = this.providerInstances.get(providerId);
    if (!provider) return [];

    try {
      // Try listModels first (LMStudioProvider), fallback to discoverModels
      let rawModels: string[] = [];
      if (typeof (provider as Record<string, unknown>).listModels === 'function') {
        rawModels = await (provider as Record<string, unknown>).listModels as () => Promise<string[]>;
        if (!Array.isArray(rawModels)) rawModels = [];
      } else if (typeof (provider as Record<string, unknown>).discoverModels === 'function') {
        const result = await (provider as Record<string, unknown>).discoverModels as () => Promise<unknown>;
        if (Array.isArray(result)) {
          rawModels = result.map((m: unknown) => typeof m === 'string' ? m : (m as Record<string, unknown>).id as string || String(m));
        }
      }

      // Fallback: fetch /v1/models directly
      if (rawModels.length === 0 && provider.baseUrl) {
        try {
          const resp = await fetch(provider.baseUrl.replace(/\/+$/, '') + '/v1/models');
          if (resp.ok) {
            const data = await resp.json() as { data?: Array<{ id: string }> };
            rawModels = (data.data || []).map((m) => m.id);
          }
        } catch { /* keep empty */ }
      }

      const normalized: NormalizedModel[] = rawModels.map((m) => ({
        id: m,
        displayName: typeof m === 'string' ? m : String(m),
        providerId,
        providerType: 'lmstudio' as const,
        capabilities: provider.capabilities as Partial<import('../jarvis-core/interfaces').ProviderCapabilities>,
        supportsStreaming: provider.capabilities.streaming,
        contextLength: 0,
      }));

      this.modelCache.set(providerId, normalized);

      // Update health state with model count
      const health = this.healthStates.get(providerId);
      if (health) {
        health.modelCount = normalized.length;
      }

      console.log('[ProviderManager] Refreshed ' + normalized.length + ' models for ' + providerId);
      return normalized;
    } catch (err) {
      console.error('[ProviderManager] Failed to refresh models for ' + providerId + ':', err);
      return this.modelCache.get(providerId) || [];
    }
  }

  /**
   * Get the IProvider instance for a provider.
   */
  getProviderInstance(providerId: string): IProvider | undefined {
    return this.providerInstances.get(providerId);
  }

  /**
   * Check health for a specific provider.
   */
  private async checkProviderHealth(providerId: string, provider: IProvider): Promise<ProviderHealth> {
    const t0 = performance.now();
    let health = this.healthStates.get(providerId);

    if (!health) {
      health = {
        reachable: false,
        connected: false,
        latencyMs: 0,
        endpoint: provider.baseUrl,
        protocol: provider.protocol,
        providerType: 'manual',
        modelCount: 0,
        lastChecked: null,
        lastError: null,
        consecutiveFailures: 0,
      };
    }

    try {
      const connected = await provider.validate();
      const latencyMs = Math.round(performance.now() - t0);

      const newHealth: ProviderHealth = {
        ...health,
        reachable: true,
        connected,
        latencyMs,
        lastChecked: Date.now(),
        lastError: connected ? null : 'Validation failed',
        consecutiveFailures: connected ? 0 : health.consecutiveFailures + 1,
      };

      this.healthStates.set(providerId, newHealth);

      // Check failover
      if (
        this.failoverConfig.enabled &&
        this.activeProviderId === providerId &&
        !connected &&
        newHealth.consecutiveFailures >= this.failoverConfig.failureThreshold
      ) {
        await this.triggerFailover(providerId);
      }

      this.eventBus.emit({
        type: 'providers:health:changed',
        providerId,
        health: newHealth,
      });

      return newHealth;
    } catch (error) {
      const latencyMs = Math.round(performance.now() - t0);

      const newHealth: ProviderHealth = {
        ...health,
        reachable: false,
        connected: false,
        latencyMs,
        lastChecked: Date.now(),
        lastError: error instanceof Error ? error.message : String(error),
        consecutiveFailures: health.consecutiveFailures + 1,
      };

      this.healthStates.set(providerId, newHealth);

      this.eventBus.emit({
        type: 'providers:health:changed',
        providerId,
        health: newHealth,
      });

      return newHealth;
    }
  }

  /**
   * Get health for a specific provider.
   */
  getHealth(providerId: string): ProviderHealth | undefined {
    return this.healthStates.get(providerId);
  }

  // -----------------------------------------------------------------------
  // Model discovery
  // -----------------------------------------------------------------------

  /**
   * Refresh the model list for all providers.
   */
  async refreshAllModels(): Promise<Map<string, NormalizedModel[]>> {
    console.log('[ProviderManager] Refreshing models...');

    // eslint-disable-next-line no-await-in-loop -- sequential health checks
    /* eslint-disable no-await-in-loop */
    for (const [providerId, provider] of this.providerInstances) {
      try {
        const models = await provider.listModels();
        const normalized = models.map((modelId) => ({
          id: modelId,
          displayName: modelId,
          providerId,
          providerType: 'manual' as ProviderType,
          capabilities: provider.capabilities,
          supportsStreaming: provider.capabilities.streaming,
          contextLength: 0,
        }));

        this.modelCache.set(providerId, normalized);

        // Update health model count
        const health = this.healthStates.get(providerId);
        if (health) {
          health.modelCount = models.length;
          this.healthStates.set(providerId, health);
        }

        this.eventBus.emit({
          type: 'providers:models:refreshed',
          providerId,
          modelCount: models.length,
        });
      } catch (error) {
        console.warn('[ProviderManager] Failed to refresh models for ' + providerId + ':', error);
      }
    }
    /* eslint-enable no-await-in-loop */

    return this.modelCache;
  }

  /**
   * Get cached models for a provider.
   */
  getModels(providerId: string): NormalizedModel[] {
    return this.modelCache.get(providerId) || [];
  }

  /**
   * Get models for the active provider.
   */
  getActiveProviderModels(): NormalizedModel[] {
    if (!this.activeProviderId) return [];
    return this.getModels(this.activeProviderId);
  }

  // -----------------------------------------------------------------------
  // Failover
  // -----------------------------------------------------------------------

  /**
   * Configure failover behaviour.
   */
  configureFailover(config: Partial<FailoverConfig>): void {
    this.failoverConfig = { ...this.failoverConfig, ...config };
    console.log('[ProviderManager] Failover configured: ' + (this.failoverConfig.enabled ? 'enabled' : 'disabled'));
  }

  /**
   * Get current failover configuration.
   */
  getFailoverConfig(): FailoverConfig {
    return { ...this.failoverConfig };
  }

  /**
   * Trigger failover to the next available provider.
   *
   * Walks the fallback order and activates the first healthy provider.
   */
  private async triggerFailover(failedProviderId: string): Promise<void> {
    console.log('[ProviderManager] Failover triggered from: ' + failedProviderId);

    /* eslint-disable no-await-in-loop */
    for (const fallbackId of this.failoverConfig.fallbackOrder) {
      if (fallbackId === failedProviderId) continue;

      const provider = this.providerInstances.get(fallbackId);
      if (!provider) continue;

      const health = this.healthStates.get(fallbackId);
      if (health?.connected) {
        console.log('[ProviderManager] Failover 鈫?' + fallbackId);

        this.eventBus.emit({
          type: 'providers:failover:triggered',
          fromProviderId: failedProviderId,
          toProviderId: fallbackId,
        });

        await this.activateProvider(fallbackId);
        return;
      }
    }

    console.warn('[ProviderManager] No healthy fallback provider available.');
  }

  // -----------------------------------------------------------------------
  // Request tracking
  // -----------------------------------------------------------------------

  /**
   * Record a request routed to a provider.
   */
  recordRequest(providerId: string): void {
    const count = this.requestCounters.get(providerId) || 0;
    this.requestCounters.set(providerId, count + 1);
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /**
   * Get a provider instance by id.
   */
  getProvider(providerId: string): IProvider | undefined {
    return this.providerInstances.get(providerId);
  }

  /**
   * List all registered provider ids.
   */
  listProviderIds(): string[] {
    return [...this.providerInstances.keys()];
  }

  /**
   * List all registered providers with full status.
   */
  listProviders(): ProviderStatus[] {
    return [...this.providerInstances.entries()].map(([providerId, provider]) => {
      const health = this.healthStates.get(providerId);
      const models = this.modelCache.get(providerId) || [];

      return {
        providerId,
        name: provider.name,
        type: health?.providerType || 'manual',
        enabled: provider.enabled,
        active: this.activeProviderId === providerId,
        health: health || {
          reachable: false,
          connected: false,
          latencyMs: 0,
          endpoint: provider.baseUrl,
          protocol: provider.protocol,
          providerType: 'manual',
          modelCount: 0,
          lastChecked: null,
          lastError: null,
          consecutiveFailures: 0,
        },
        modelCount: models.length,
        registeredAt: this.registeredAt.get(providerId) || 0,
        lastRefreshed: health?.lastChecked || 0,
        requestCount: this.requestCounters.get(providerId) || 0,
      };
    });
  }

  /**
   * Get the total number of registered providers.
   */
  get providerCount(): number {
    return this.providerInstances.size;
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /**
   * Get a comprehensive diagnostic summary.
   */
  getDiagnostics(): Record<string, unknown> {
    const activeProvider = this.getActiveProviderInstance();

    return {
      providerCount: this.providerInstances.size,
      activeProviderId: this.activeProviderId,
      activeProviderName: activeProvider?.name || 'none',
      activeProviderProtocol: activeProvider?.protocol || 'none',
      providers: this.listProviders(),
      failover: {
        enabled: this.failoverConfig.enabled,
        threshold: this.failoverConfig.failureThreshold,
        fallbackOrder: this.failoverConfig.fallbackOrder,
      },
      totalRequests: [...this.requestCounters.values()].reduce((a, b) => a + b, 0),
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ProviderManager };



