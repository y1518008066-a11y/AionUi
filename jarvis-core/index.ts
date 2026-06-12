/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Jarvis Control Layer — Entry Point
 *
 * Wires together the event bus, registries, and provides the
 * {@link initializeJarvisCore} bootstrap function.
 *
 * This module is ADDITIVE ONLY — it does not replace or modify
 * any existing AionUi system.
 */

import type { IJarvisCore, IPlugin, IProvider, IMode, PluginId } from './interfaces';
import { createEventBus } from './eventBus';
import {
  registerPlugin,
  unregisterPlugin,
  getPlugin,
  listPlugins,
  registerProvider,
  unregisterProvider,
  getProvider,
  listProviders,
  registerMode,
  unregisterMode,
  getMode,
  listModes,
  getRegistryStats,
} from './registry';

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let _initialized = false;
let _activeModeId: string | null = null;

const events = createEventBus();

// ---------------------------------------------------------------------------
// Core implementation
// ---------------------------------------------------------------------------

const jarvisCore: IJarvisCore = {
  events,

  get initialized(): boolean {
    return _initialized;
  },

  async initialize(): Promise<void> {
    if (_initialized) {
      console.log('[Jarvis] Already initialized — skipping.');
      return;
    }

    console.log('[Jarvis] Initializing Jarvis Control Layer...');
    const t0 = performance.now();

    // Nothing to wire up yet — registries start empty.
    // Future: load persisted plugin/provider/mode data here.

    _initialized = true;

    const elapsed = Math.round(performance.now() - t0);
    const stats = getRegistryStats();
    console.log(
      `[Jarvis] Initialized in ${elapsed}ms. ` +
        `Plugins: ${stats.plugins}, Providers: ${stats.providers}, Modes: ${stats.modes}`
    );

    events.emit({ type: 'core:initialized' });
  },

  async registerPlugin(plugin: IPlugin): Promise<void> {
    registerPlugin(plugin);
    try {
      await plugin.onRegister();
    } catch (error) {
      console.error(`[Jarvis] Plugin "${plugin.id}" onRegister failed:`, error);
      throw error;
    }
    events.emit({ type: 'plugin:registered', pluginId: plugin.id });
  },

  async unregisterPlugin(pluginId: PluginId): Promise<void> {
    const plugin = getPlugin(pluginId);
    if (!plugin) return;
    try {
      await plugin.onStop();
    } catch (error) {
      console.error(`[Jarvis] Plugin "${pluginId}" onStop failed:`, error);
    }
    unregisterPlugin(pluginId);
    events.emit({ type: 'plugin:stopped', pluginId });
  },

  getPlugin,
  listPlugins,

  async registerProvider(provider: IProvider): Promise<void> {
    registerProvider(provider);
    events.emit({ type: 'provider:added', providerId: provider.id });
  },

  async unregisterProvider(providerId: string): Promise<void> {
    unregisterProvider(providerId);
    events.emit({ type: 'provider:removed', providerId });
  },

  getProvider,
  listProviders,

  async registerMode(mode: IMode): Promise<void> {
    registerMode(mode);
  },

  async unregisterMode(modeId: string): Promise<void> {
    const wasActive = _activeModeId === modeId;
    unregisterMode(modeId);
    if (wasActive) {
      _activeModeId = null;
    }
  },

  getMode,
  listModes,

  async switchMode(modeId: string): Promise<void> {
    const mode = getMode(modeId);
    if (!mode) {
      console.warn(`[Jarvis] Cannot switch to unknown mode "${modeId}".`);
      return;
    }
    _activeModeId = modeId;
    events.emit({ type: 'mode:switched', modeId });
  },

  get activeModeId(): string | null {
    return _activeModeId;
  },
};

// ---------------------------------------------------------------------------
// Bootstrap function
// ---------------------------------------------------------------------------

/**
 * Initialize the Jarvis Control Layer.
 *
 * Safe to call at any time — idempotent, zero side effects on existing
 * AionUi systems. Currently only logs initialization status.
 *
 * @returns The initialized {@link IJarvisCore} instance.
 */
async function initializeJarvisCore(): Promise<IJarvisCore> {
  await jarvisCore.initialize();
  return jarvisCore;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { initializeJarvisCore, jarvisCore };
export type { IJarvisCore };
