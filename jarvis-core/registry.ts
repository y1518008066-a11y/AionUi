/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Jarvis Control Layer — Registry Scaffolding
 *
 * Provides in-memory registries for plugins, providers, and modes.
 * All maps start empty. No data is persisted yet.
 */

import type { IPlugin, IProvider, IMode, PluginId } from './interfaces';

// ---------------------------------------------------------------------------
// Plugin Registry
// ---------------------------------------------------------------------------

/** Plugin registry — maps plugin id to plugin instance. */
const pluginRegistry = new Map<PluginId, IPlugin>();

function registerPlugin(plugin: IPlugin): void {
  if (pluginRegistry.has(plugin.id)) {
    console.warn(`[Jarvis] Plugin "${plugin.id}" is already registered — skipping.`);
    return;
  }
  pluginRegistry.set(plugin.id, plugin);
}

function unregisterPlugin(pluginId: PluginId): boolean {
  return pluginRegistry.delete(pluginId);
}

function getPlugin(pluginId: PluginId): IPlugin | undefined {
  return pluginRegistry.get(pluginId);
}

function listPlugins(): IPlugin[] {
  return [...pluginRegistry.values()];
}

function clearPlugins(): void {
  pluginRegistry.clear();
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

/** Provider registry — maps provider id to provider instance. */
const providerRegistry = new Map<string, IProvider>();

function registerProvider(provider: IProvider): void {
  if (providerRegistry.has(provider.id)) {
    console.warn(`[Jarvis] Provider "${provider.id}" is already registered — skipping.`);
    return;
  }
  providerRegistry.set(provider.id, provider);
}

function unregisterProvider(providerId: string): boolean {
  return providerRegistry.delete(providerId);
}

function getProvider(providerId: string): IProvider | undefined {
  return providerRegistry.get(providerId);
}

function listProviders(): IProvider[] {
  return [...providerRegistry.values()];
}

function clearProviders(): void {
  providerRegistry.clear();
}

// ---------------------------------------------------------------------------
// Mode Registry
// ---------------------------------------------------------------------------

/** Mode registry — maps mode id to mode definition. */
const modeRegistry = new Map<string, IMode>();

function registerMode(mode: IMode): void {
  if (modeRegistry.has(mode.id)) {
    console.warn(`[Jarvis] Mode "${mode.id}" is already registered — skipping.`);
    return;
  }
  modeRegistry.set(mode.id, mode);
}

function unregisterMode(modeId: string): boolean {
  return modeRegistry.delete(modeId);
}

function getMode(modeId: string): IMode | undefined {
  return modeRegistry.get(modeId);
}

function listModes(): IMode[] {
  return [...modeRegistry.values()];
}

function clearModes(): void {
  modeRegistry.clear();
}

// ---------------------------------------------------------------------------
// Registry stats (for diagnostics)
// ---------------------------------------------------------------------------

function getRegistryStats(): { plugins: number; providers: number; modes: number } {
  return {
    plugins: pluginRegistry.size,
    providers: providerRegistry.size,
    modes: modeRegistry.size,
  };
}

// ---------------------------------------------------------------------------
// Clear all registries
// ---------------------------------------------------------------------------

function clearAll(): void {
  clearPlugins();
  clearProviders();
  clearModes();
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  registerPlugin,
  unregisterPlugin,
  getPlugin,
  listPlugins,
  clearPlugins,
  registerProvider,
  unregisterProvider,
  getProvider,
  listProviders,
  clearProviders,
  registerMode,
  unregisterMode,
  getMode,
  listModes,
  clearModes,
  getRegistryStats,
  clearAll,
};
