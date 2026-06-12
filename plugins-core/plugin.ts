/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin System Core — Base Plugin
 *
 * Provides an abstract base class that plugins can extend. Implements
 * the IPlugin interface with no-op defaults for all lifecycle hooks.
 *
 * Plugin authors extend this class and override the hooks they need.
 */

import type { IPlugin, PluginManifest, PluginCapabilities, PluginContext, PluginState, HookResult } from './types';
import { PluginLifecycle } from './lifecycle';

// ---------------------------------------------------------------------------
// Default no-op capabilities
// ---------------------------------------------------------------------------

const DEFAULT_CAPABILITIES: PluginCapabilities = {
  providers: false,
  modes: false,
  actions: [],
  mcpServers: false,
  filesystem: false,
  network: false,
  userData: false,
  subprocess: false,
  ui: false,
};

// ---------------------------------------------------------------------------
// BasePlugin
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all plugins.
 *
 * Provides:
 * - Lifecycle state tracking via PluginLifecycle
 * - No-op defaults for all lifecycle hooks
 * - No-op defaults for execution hooks
 *
 * Plugin authors should:
 * 1. Extend this class
 * 2. Set manifest and capabilities in the constructor
 * 3. Override lifecycle hooks as needed
 */
abstract class BasePlugin implements IPlugin {
  readonly manifest: PluginManifest;
  readonly capabilities: PluginCapabilities;

  private readonly lifecycle: PluginLifecycle;

  constructor(manifest: PluginManifest, capabilities?: Partial<PluginCapabilities>) {
    this.manifest = manifest;
    this.capabilities = { ...DEFAULT_CAPABILITIES, ...capabilities };
    this.lifecycle = new PluginLifecycle(manifest.id);
  }

  // -----------------------------------------------------------------------
  // State (delegated to lifecycle)
  // -----------------------------------------------------------------------

  get state(): PluginState {
    return this.lifecycle.state;
  }

  /** @internal Used by PluginManager to advance state. */
  _transition(to: PluginState): void {
    this.lifecycle.transition(to);
  }

  /** @internal Used by PluginManager to check valid transitions. */
  _canTransition(to: PluginState): boolean {
    return this.lifecycle.canTransition(to);
  }

  // -----------------------------------------------------------------------
  // Lifecycle hooks (no-op defaults)
  // -----------------------------------------------------------------------

  async onInstall(_context: PluginContext): Promise<void> {
    // No-op: override in subclass to add one-time setup logic.
  }

  async onLoad(_context: PluginContext): Promise<void> {
    // No-op: override in subclass to initialize runtime resources.
  }

  async onEnable(_context: PluginContext): Promise<void> {
    // No-op: override in subclass to register providers / hooks.
  }

  async onDisable(_context: PluginContext): Promise<void> {
    // No-op: override in subclass to unregister providers / hooks.
  }

  async onUnload(_context: PluginContext): Promise<void> {
    // No-op: override in subclass to release runtime resources.
  }

  async onDestroy(_context: PluginContext): Promise<void> {
    // No-op: override in subclass to clean up persistent data.
  }

  // -----------------------------------------------------------------------
  // Execution hooks (no-op defaults)
  // -----------------------------------------------------------------------

  async onBeforeExecute(
    _context: PluginContext,
    _actionType: string,
    _params: Record<string, unknown>
  ): Promise<HookResult> {
    // No-op: allow all actions by default.
    return { decision: 'allow' };
  }

  async onAfterExecute(
    _context: PluginContext,
    _actionType: string,
    _params: Record<string, unknown>,
    _result: unknown
  ): Promise<void> {
    // No-op: override to inspect or augment results.
  }

  async onError(_context: PluginContext, _error: Error, _actionType?: string): Promise<void> {
    // No-op: override to handle errors.
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { BasePlugin };
