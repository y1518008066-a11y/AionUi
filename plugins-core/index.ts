/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin System Core — Entry Point
 *
 * Provides the complete plugin infrastructure:
 * - PluginManager: orchestrates lifecycle (install/load/enable/disable/unload/destroy)
 * - PluginRegistry: in-memory plugin storage with filtering
 * - BasePlugin: abstract base class for plugin authors
 * - PluginLifecycle: validated state machine for transitions
 * - Types: all plugin-related type definitions
 *
 * Usage:
 *
 * `	s
 * import { PluginManager } from './plugins-core';
 *
 * const manager = new PluginManager(jarvisCore.events);
 * await manager.installPlugin(myPlugin);
 * await manager.loadPlugin(myPlugin.manifest.id);
 * await manager.enablePlugin(myPlugin.manifest.id);
 * `
 */

import { PluginManager } from './manager';
import { PluginRegistry } from './registry';
import { BasePlugin } from './plugin';
import { PluginLifecycle } from './lifecycle';

export { PluginManager, PluginRegistry, BasePlugin, PluginLifecycle };

// Re-export types
export type {
  PluginId,
  PluginState,
  PluginOrigin,
  PluginManifest,
  PluginCapabilities,
  PluginContext,
  PluginStorage,
  PluginLogger,
  IPlugin,
  HookResult,
  HookRegistration,
  PluginEvent,
} from './types';
