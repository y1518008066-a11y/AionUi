/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Runtime — Entry Point
 *
 * Provides the real plugin runtime:
 * - PluginLoader: discovers, loads, enables, disables, reloads plugins
 * - Manifest system: plugin.json validation and loading
 *
 * Usage:
 *
 * `	s
 * import { PluginLoader } from './plugin-runtime';
 *
 * const loader = new PluginLoader('./plugins');
 * loader.discover();
 * await loader.loadAll();
 * await loader.enable('com.jarvis.hello');
 * `
 */

import { PluginLoader } from './loader';
import { loadManifest, validateManifest } from './manifest';

export { PluginLoader, loadManifest, validateManifest };

export type { LoadedPlugin, PluginStatus, DiscoveryResult } from './loader';
export type { PluginManifest, PluginCapability, PluginPermission, ManifestValidationResult } from './manifest';
