/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin System Core — Type Definitions
 *
 * Defines the complete plugin model: identity, manifest, capabilities,
 * lifecycle state, context, and hook signatures.
 *
 * These are TYPE DEFINITIONS ONLY — no runtime behavior is implemented.
 */

import type { IEventBus } from '../jarvis-core/interfaces';

// ---------------------------------------------------------------------------
// Plugin identity
// ---------------------------------------------------------------------------

/** Unique identifier for a plugin instance. */
type PluginId = string;

/** Plugin lifecycle state. */
type PluginState = 'uninstalled' | 'installed' | 'loaded' | 'enabled' | 'disabled' | 'error';

/** Plugin origin: where the plugin came from. */
type PluginOrigin = 'builtin' | 'user' | 'marketplace' | 'external';

// ---------------------------------------------------------------------------
// Plugin manifest (metadata)
// ---------------------------------------------------------------------------

/**
 * Immutable metadata describing a plugin.
 *
 * This is the "identity card" — it never changes after registration.
 */
type PluginManifest = {
  /** Unique plugin id (e.g. "com.aionui.imagegen"). */
  id: PluginId;

  /** Human-readable display name. */
  name: string;

  /** Semver version string. */
  version: string;

  /** Minimum AionUi version required. */
  minAppVersion: string;

  /** Short description (one line). */
  description: string;

  /** Author or maintainer name. */
  author: string;

  /** Where the plugin originated. */
  origin: PluginOrigin;

  /** List of plugin ids this plugin depends on. */
  dependencies: PluginId[];

  /** Tags for categorization and search. */
  tags: string[];
};

// ---------------------------------------------------------------------------
// Plugin capabilities
// ---------------------------------------------------------------------------

/**
 * Declared capabilities of a plugin.
 *
 * Plugins declare what they CAN do — the system decides what they
 * ARE ALLOWED to do based on permissions and context.
 */
type PluginCapabilities = {
  /** Plugin can register AI providers. */
  providers: boolean;

  /** Plugin can register execution modes. */
  modes: boolean;

  /** Plugin can handle execution actions. */
  actions: string[];

  /** Plugin can register MCP servers. */
  mcpServers: boolean;

  /** Plugin can access the filesystem. */
  filesystem: boolean;

  /** Plugin can make network requests. */
  network: boolean;

  /** Plugin needs access to user data. */
  userData: boolean;

  /** Plugin can spawn subprocesses. */
  subprocess: boolean;

  /** Plugin can create UI components. */
  ui: boolean;
};

// ---------------------------------------------------------------------------
// Plugin context (runtime sandbox)
// ---------------------------------------------------------------------------

/**
 * Context injected into a plugin at runtime.
 *
 * Provides controlled access to system services. The plugin receives
 * this context during its lifecycle hooks and can use it to interact
 * with the host application.
 */
type PluginContext = {
  /** Unique id of this plugin instance. */
  pluginId: PluginId;

  /** Reference to the Jarvis event bus (scoped to plugin events). */
  events: IEventBus;

  /** Plugin-private key-value store. */
  storage: PluginStorage;

  /** Logger bound to this plugin. */
  logger: PluginLogger;

  /** Path to the plugin's own data directory. */
  dataDir: string;
};

/**
 * Plugin-private persistent storage.
 *
 * A simple key-value interface that persists across sessions.
 * Each plugin gets its own isolated namespace.
 */
type PluginStorage = {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
};

/**
 * Plugin-scoped logger.
 *
 * All messages are prefixed with the plugin id for filtering.
 */
type PluginLogger = {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
};

// ---------------------------------------------------------------------------
// Plugin interface
// ---------------------------------------------------------------------------

/**
 * Core plugin interface.
 *
 * Every plugin must implement this interface. The manager calls these
 * hooks in a defined lifecycle order.
 */
type IPlugin = {
  /** Immutable manifest. */
  readonly manifest: PluginManifest;

  /** Declared capabilities. */
  readonly capabilities: PluginCapabilities;

  /** Current lifecycle state. */
  readonly state: PluginState;

  /**
   * Called when the plugin is first installed.
   * Use for one-time setup (create directories, download assets, etc.).
   */
  onInstall(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is loaded into memory.
   * Use for initializing runtime resources (connections, caches, etc.).
   */
  onLoad(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is enabled (activated).
   * Use for registering providers, hooks, event listeners.
   */
  onEnable(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is disabled (paused).
   * Use for unregistering providers, removing listeners.
   */
  onDisable(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is unloaded from memory.
   * Use for releasing runtime resources.
   */
  onUnload(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is permanently removed.
   * Use for cleaning up persistent data, removing directories.
   */
  onDestroy(context: PluginContext): Promise<void>;

  /**
   * Called when an execution hook fires before an action.
   * Plugins can modify or reject the action.
   */
  onBeforeExecute?(context: PluginContext, actionType: string, params: Record<string, unknown>): Promise<HookResult>;

  /**
   * Called when an execution hook fires after an action.
   * Plugins can inspect or augment the result.
   */
  onAfterExecute?(
    context: PluginContext,
    actionType: string,
    params: Record<string, unknown>,
    result: unknown
  ): Promise<void>;

  /**
   * Called when an error occurs during execution.
   * Plugins can handle or log errors.
   */
  onError?(context: PluginContext, error: Error, actionType?: string): Promise<void>;
};

// ---------------------------------------------------------------------------
// Hook system types
// ---------------------------------------------------------------------------

/**
 * Result of a beforeExecute hook.
 *
 * - 'allow' — action proceeds normally.
 * - 'deny' — action is rejected with a reason.
 * - 'modify' — action proceeds with modified parameters.
 */
type HookResult =
  | { decision: 'allow' }
  | { decision: 'deny'; reason: string }
  | { decision: 'modify'; params: Record<string, unknown> };

/**
 * Registered hook handler for a specific action type.
 */
type HookRegistration = {
  /** The plugin that registered this hook. */
  pluginId: PluginId;

  /** Which action type this hook listens for. */
  actionType: string;

  /** Priority (lower = runs first). */
  priority: number;

  /** The handler function. */
  handler: (context: PluginContext, params: Record<string, unknown>) => Promise<HookResult>;
};

// ---------------------------------------------------------------------------
// Plugin events
// ---------------------------------------------------------------------------

/** Events emitted by the plugin system via JarvisCore EventBus. */
type PluginEvent =
  | { type: 'plugin:installed'; pluginId: PluginId }
  | { type: 'plugin:loaded'; pluginId: PluginId }
  | { type: 'plugin:enabled'; pluginId: PluginId }
  | { type: 'plugin:disabled'; pluginId: PluginId }
  | { type: 'plugin:unloaded'; pluginId: PluginId }
  | { type: 'plugin:destroyed'; pluginId: PluginId }
  | { type: 'plugin:error'; pluginId: PluginId; error: string };

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

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
};
