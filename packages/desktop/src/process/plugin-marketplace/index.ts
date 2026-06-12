/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Marketplace â€?Module Entry
 *
 * Public API for the complete plugin marketplace infrastructure.
 */

// Core manager
export { PluginManager } from './manager';

// Subsystems
export { Marketplace, createLocalMarketplace, LocalJsonBackend, LocalDirectoryBackend } from './marketplace';
export { PluginInstaller }
export { HttpMarketplaceBackend } from './http-backend'; from './installer';
export { DependencyResolver, DependencyGraph } from './dependency';
export { PermissionManager, DEFAULT_POLICY } from './permissions';

// Types
export type {
  PluginCapability,
  PluginPermission,
  PluginManifest,
  PluginState,
  PluginOrigin,
  PluginStatus,
  MarketplaceEntry,
  MarketplaceSource,
  MarketplaceQuery,
  DependencyNode,
  DependencyResolution,
  DependencyConflict,
  PermissionValidation,
  PermissionPolicy,
  InstallSource,
  InstallResult,
  UninstallResult,
  MarketplaceDiagnostics,
} from './types';

// Re-export from plugin-runtime for convenience
export type {
  PluginManifest as RuntimeManifest,
  PluginCapability as RuntimeCapability,
  PluginPermission as RuntimePermission,
} from '../plugin-runtime/manifest';