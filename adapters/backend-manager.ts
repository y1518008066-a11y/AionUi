/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Adapter Backend Manager
 *
 * Central registry for adapter backends. Allows runtime selection
 * of which backend (Codex, MCP, Playwright, local, etc.) powers
 * each adapter type (Browser, ComputerUse, Vision).
 *
 * Architecture:
 *   Plugin → Adapter Contract (IBrowserAdapter / IComputerUseAdapter)
 *          → BackendManager → Selected Backend Implementation
 *
 * No backend is called directly — everything goes through the
 * adapter contract.
 */

import type { IAdapter, AdapterId, AdapterBackend, AdapterHealth, AdapterDiagnostics } from './types';
import type { IBrowserAdapter } from './browser';
import type { IComputerUseAdapter } from './computer-use';

// ---------------------------------------------------------------------------
// Backend Manager
// ---------------------------------------------------------------------------

/** Map of adapter type to its active backend. */
type BackendRegistry = {
  browser: IBrowserAdapter | null;
  computerUse: IComputerUseAdapter | null;
};

/** Configuration for backend selection. */
type BackendConfig = {
  /** Preferred backend for browser operations. */
  browser: AdapterBackend;
  /** Preferred backend for computer use operations. */
  computerUse: AdapterBackend;
};

const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  browser: 'codex',
  computerUse: 'codex',
};

class BackendManager {
  private readonly backends = new Map<string, IAdapter>();
  private readonly activeBackends: BackendRegistry = {
    browser: null,
    computerUse: null,
  };
  private config: BackendConfig = { ...DEFAULT_BACKEND_CONFIG };

  constructor() {
    console.log('[BackendManager] Initialized.');
  }

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /**
   * Register a backend implementation.
   */
  register(adapter: IAdapter): void {
    const key = `${adapter.backend}`;
    this.backends.set(key, adapter);
    console.log(`[BackendManager] Registered backend: ${key} (${adapter.name})`);
  }

  /**
   * Alias for register() — used by system-wiring initializer.
   * Registers a backend implementation under a given key.
   */
  registerBackend(key: string, adapter: IAdapter): void {
    this.backends.set(key, adapter);
    console.log(`[BackendManager] Registered backend: ${key} (${adapter.name})`);
  }

  /**
   * Unregister a backend.
   */
  unregister(backend: AdapterBackend): void {
    this.backends.delete(backend);
    // Clear active references to this backend
    if (this.activeBackends.browser?.backend === backend) {
      this.activeBackends.browser = null;
    }
    if (this.activeBackends.computerUse?.backend === backend) {
      this.activeBackends.computerUse = null;
    }
  }

  // -----------------------------------------------------------------------
  // Backend selection
  // -----------------------------------------------------------------------

  /**
   * Set the preferred backend type for an adapter.
   */
  setBackend(adapterType: 'browser', backend: AdapterBackend): void;
  setBackend(adapterType: 'computerUse', backend: AdapterBackend): void;
  setBackend(adapterType: 'browser' | 'computerUse', backend: AdapterBackend): void {
    if (adapterType === 'browser') {
      this.config.browser = backend;
    } else {
      this.config.computerUse = backend;
    }
    console.log(`[BackendManager] Preferred ${adapterType} backend: ${backend}`);
    // Re-resolve the active backend
    this.resolve(adapterType);
  }

  /**
   * Get the configured backend type for an adapter.
   */
  getBackend(adapterType: 'browser' | 'computerUse'): AdapterBackend {
    return adapterType === 'browser' ? this.config.browser : this.config.computerUse;
  }

  /**
   * Get the active browser adapter (resolves lazily).
   */
  getBrowserAdapter(): IBrowserAdapter | null {
    if (!this.activeBackends.browser) {
      this.resolve('browser');
    }
    return this.activeBackends.browser;
  }

  /**
   * Get the active computer use adapter (resolves lazily).
   */
  getComputerUseAdapter(): IComputerUseAdapter | null {
    if (!this.activeBackends.computerUse) {
      this.resolve('computerUse');
    }
    return this.activeBackends.computerUse;
  }

  // -----------------------------------------------------------------------
  // Health & diagnostics
  // -----------------------------------------------------------------------

  /**
   * Check health of the active browser backend.
   */
  async health(adapterType: 'browser' | 'computerUse'): Promise<AdapterHealth> {
    const adapter = adapterType === 'browser'
      ? this.getBrowserAdapter()
      : this.getComputerUseAdapter();

    if (!adapter) {
      return {
        available: false,
        status: 'disconnected',
        latencyMs: 0,
        lastError: 'No adapter available',
        lastCheckedAt: Date.now(),
      };
    }

    try {
      return await adapter.health();
    } catch (err) {
      return {
        available: false,
        status: 'error',
        latencyMs: 0,
        lastError: err instanceof Error ? err.message : String(err),
        lastCheckedAt: Date.now(),
      };
    }
  }

  /**
   * Get diagnostics for all registered backends.
   */
  getDiagnostics(): Record<string, unknown> {
    const backendDiags: Record<string, AdapterDiagnostics | null> = {};

    for (const [key, backend] of this.backends) {
      try {
        backendDiags[key] = backend.diagnostics();
      } catch {
        backendDiags[key] = null;
      }
    }

    return {
      config: {
        browser: this.config.browser,
        computerUse: this.config.computerUse,
      },
      activeBrowserBackend: this.activeBackends.browser?.backend || 'none',
      activeComputerUseBackend: this.activeBackends.computerUse?.backend || 'none',
      registeredBackends: [...this.backends.keys()],
      backends: backendDiags,
      browserHealth: this.activeBackends.browser
        ? {
            backend: this.activeBackends.browser.backend,
            name: this.activeBackends.browser.name,
            status: this.activeBackends.browser.status,
          }
        : null,
      computerUseHealth: this.activeBackends.computerUse
        ? {
            backend: this.activeBackends.computerUse.backend,
            name: this.activeBackends.computerUse.name,
            status: this.activeBackends.computerUse.status,
          }
        : null,
    };
  }

  // -----------------------------------------------------------------------
  // Internal resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve the active backend for an adapter type using fallback chain.
   *
   * Priority: configured backend → first available fallback
   * Fallback chain (browser): codex → mcp → playwright
   * Fallback chain (computerUse): codex → mcp → local
   */
  private resolve(adapterType: 'browser' | 'computerUse'): void {
    const preferred = adapterType === 'browser' ? this.config.browser : this.config.computerUse;
    const fallbackChain: AdapterBackend[] = adapterType === 'browser'
      ? [preferred, 'codex', 'mcp', 'playwright']
      : [preferred, 'codex', 'mcp', 'local'];

    for (const backend of fallbackChain) {
      const key = `${backend}`;
      const adapter = this.backends.get(key);

      if (adapter && adapter.status === 'connected') {
        if (adapterType === 'browser') {
          this.activeBackends.browser = adapter as IBrowserAdapter;
        } else {
          this.activeBackends.computerUse = adapter as IComputerUseAdapter;
        }
        console.log(`[BackendManager] Resolved ${adapterType} backend: ${backend} (${adapter.name})`);
        return;
      }
    }

    console.warn(`[BackendManager] No available backend for ${adapterType}.`);
  }

  /**
   * Re-resolve all active backends (call after registration changes).
   */
  refresh(): void {
    this.resolve('browser');
    this.resolve('computerUse');
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: BackendManager | null = null;

function getBackendManager(): BackendManager {
  if (!_instance) _instance = new BackendManager();
  return _instance;
}

function resetBackendManager(): void { _instance = null; }

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { BackendManager, getBackendManager, resetBackendManager };
export type { BackendRegistry, BackendConfig };
