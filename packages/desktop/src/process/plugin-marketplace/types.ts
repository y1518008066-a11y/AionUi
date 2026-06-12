/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Marketplace éˆ?Type Definitions
 *
 * Unified type system for the plugin marketplace, installer,
 * dependency resolver, and permission manager.
 */

// ---------------------------------------------------------------------------
// Plugin identity (extended from plugin-runtime manifest)
// ---------------------------------------------------------------------------

/** Plugin capability strings. */
/** Plugin capability strings. */
type PluginCapability =
  | 'browser' | 'computer-use' | 'clipboard' | 'memory' | 'voice'
  | 'ocr' | 'scheduler' | 'overlay' | 'screen' | 'notification'
  | 'filesystem' | 'network' | 'subprocess' | 'ui'
  | 'vision' | 'active-assistant';




/** Plugin permission strings. */
type PluginPermission =
  | 'filesystem:read' | 'filesystem:write'
  | 'network:outbound' | 'network:inbound'
  | 'clipboard:read' | 'clipboard:write'
  | 'process:spawn'
  | 'ui:overlay' | 'ui:notification'
  | 'audio:input' | 'audio:output'
  | 'screen:capture';

/** Full plugin manifest (plugin.json on disk). */
type PluginManifest = {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  entry: string;
  permissions: PluginPermission[];
  dependencies: string[];
  capabilities: PluginCapability[];
  minimumJarvisVersion: string;
  enabledByDefault: boolean;
  /** Optional: homepage URL. */
  homepage?: string;
  /** Optional: source repository URL. */
  repository?: string;
  /** Optional: SPDX license identifier. */
  license?: string;
  /** Optional: icon name or path. */
  icon?: string;
  /** Optional: modes this plugin is compatible with. */
  compatibleModes?: string[];
};

// ---------------------------------------------------------------------------
// Plugin state & lifecycle
// ---------------------------------------------------------------------------

/** Runtime state of a plugin. */
type PluginState =
  | 'discovered'   // found on disk but not installed
  | 'installed'    // registered in system
  | 'loaded'       // JS module loaded
  | 'enabled'      // activated and running
  | 'disabled'     // loaded but paused
  | 'error'        // failed to load/enable
  | 'uninstalled'; // removed from system

/** Origin of a plugin. */
type PluginOrigin = 'builtin' | 'marketplace' | 'local' | 'external';

// ---------------------------------------------------------------------------
// Plugin status (runtime diagnostics)
// ---------------------------------------------------------------------------

/** Full runtime status of an installed plugin. */
type PluginStatus = {
  id: string;
  name: string;
  version: string;
  state: PluginState;
  origin: PluginOrigin;
  enabled: boolean;
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  dependencies: string[];
  /** Path to the plugin directory. */
  path: string;
  /** Time the plugin was installed (epoch ms). */
  installedAt: number;
  /** Time the plugin was last updated (epoch ms). */
  updatedAt: number;
  /** Load time in milliseconds. */
  loadTimeMs: number;
  /** Number of times this plugin has been reloaded. */
  reloadCount: number;
  /** Last error message (null if no errors). */
  lastError: string | null;
  /** Version available for update (null if up to date). */
  updateAvailable: string | null;
};

// ---------------------------------------------------------------------------
// Marketplace types
// ---------------------------------------------------------------------------

/** A plugin listing in the marketplace. */
type MarketplaceEntry = {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  homepage?: string;
  repository?: string;
  license?: string;
  icon?: string;
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  dependencies: string[];
  minimumJarvisVersion: string;
  compatibleModes?: string[];
  /** Download URL or relative path to the plugin package. */
  downloadUrl: string;
  /** SHA-256 checksum of the plugin package. */
  checksum: string;
  /** Size in bytes. */
  sizeBytes: number;
  /** Publication date (ISO 8601). */
  publishedAt: string;
  /** Number of downloads. */
  downloads: number;
  /** Average rating (0-5). */
  rating?: number;
};

/** Source of marketplace data. */
type MarketplaceSource = {
  /** Source type. */
  type: 'local-json' | 'local-directory' | 'http' | 'github';
  /** Source URI. */
  uri: string;
  /** Display name. */
  name: string;
};

/** Search / filter criteria for marketplace queries. */
type MarketplaceQuery = {
  search?: string;
  capabilities?: PluginCapability[];
  author?: string;
  /** Minimum version required. */
  minVersion?: string;
  /** Sort by field. */
  sortBy?: 'name' | 'version' | 'downloads' | 'publishedAt' | 'rating';
  /** Sort direction. */
  sortDir?: 'asc' | 'desc';
  /** Maximum results. */
  limit?: number;
  /** Offset for pagination. */
  offset?: number;
};

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

/** A node in the dependency graph. */
type DependencyNode = {
  id: string;
  name: string;
  version: string;
  installed: boolean;
  /** Dependencies of this node. */
  dependencies: string[];
  /** Plugins that depend on this node. */
  dependents: string[];
};

/** Result of dependency resolution. */
type DependencyResolution = {
  /** Whether resolution succeeded. */
  ok: boolean;
  /** Ordered list of plugins to install (dependency order). */
  installOrder: string[];
  /** Missing dependencies that cannot be resolved. */
  missing: string[];
  /** Version conflicts detected. */
  conflicts: DependencyConflict[];
  /** Circular dependencies detected. */
  cycles: string[][];
  /** The full dependency graph. */
  graph: DependencyNode[];
};

/** A version conflict between two requirements. */
type DependencyConflict = {
  pluginId: string;
  requiredBy: string[];
  requiredVersion: string;
  installedVersion: string;
  message: string;
};

// ---------------------------------------------------------------------------
// Permission types
// ---------------------------------------------------------------------------

/** Result of permission validation for a plugin. */
type PermissionValidation = {
  ok: boolean;
  pluginId: string;
  /** Permissions the plugin requests. */
  requested: PluginPermission[];
  /** Permissions that have been granted. */
  granted: PluginPermission[];
  /** Permissions that have been denied. */
  denied: PluginPermission[];
  /** Reason for each denial. */
  denialReasons: Record<string, string>;
  /** Whether user consent is needed. */
  needsConsent: boolean;
};

/** Permission policy for the system. */
type PermissionPolicy = {
  /** Automatically grant these permissions. */
  autoGrant: PluginPermission[];
  /** Always deny these permissions. */
  alwaysDeny: PluginPermission[];
  /** Require user consent for these permissions. */
  requireConsent: PluginPermission[];
};

// ---------------------------------------------------------------------------
// Installer types
// ---------------------------------------------------------------------------

/** Source of a plugin to install. */
type InstallSource = {
  type: 'local-path' | 'local-json' | 'url' | 'marketplace';
  /** URL, path, or marketplace entry id. */
  uri: string;
  /** Optional version to install. */
  version?: string;
};

/** Result of an install operation. */
type InstallResult = {
  ok: boolean;
  pluginId: string;
  version: string;
  /** Path where the plugin was installed. */
  installPath: string;
  /** Warnings (non-fatal). */
  warnings: string[];
  /** Error (if ok is false). */
  error?: string;
};

/** Result of an uninstall operation. */
type UninstallResult = {
  ok: boolean;
  pluginId: string;
  /** Whether the plugin directory was removed. */
  removed: boolean;
  /** Affected dependents that may break. */
  affectedDependents: string[];
  /** Warnings. */
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Diagnotics
// ---------------------------------------------------------------------------

/** Full system diagnostics. */
type MarketplaceDiagnostics = {
  /** Total plugins in the marketplace index. */
  marketplaceSize: number;
  /** Number of installed plugins. */
  installedCount: number;
  /** Number of enabled plugins. */
  enabledCount: number;
  /** Number of disabled plugins. */
  disabledCount: number;
  /** Number of plugins with errors. */
  errorCount: number;
  /** Plugin statuses. */
  plugins: PluginStatus[];
  /** Dependency graph summary. */
  dependencySummary: {
    totalNodes: number;
    cyclesDetected: number;
  };
  /** Permission summary. */
  permissionSummary: {
    totalGrants: number;
    totalDenials: number;
  };
  /** Marketplace source. */
  marketplaceSource: MarketplaceSource | null;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

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
};
