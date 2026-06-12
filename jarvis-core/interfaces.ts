/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Jarvis Control Layer — Core Interfaces
 *
 * This module defines the foundational contracts for the Jarvis system,
 * which provides plugin lifecycle management, mode/profile switching,
 * AI provider routing, and event dispatch on top of AionUi.
 *
 * These are INTERFACES ONLY — no runtime implementation exists yet.
 */

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/** Unique identifier for a plugin instance. */
type PluginId = string;

/** Lifecycle state of a plugin. */
type PluginStatus = 'registered' | 'active' | 'paused' | 'stopped' | 'error';

/** Minimal metadata every plugin must expose. */
type PluginManifest = {
  /** Human-readable name. */
  name: string;
  /** Semver version. */
  version: string;
  /** Short description of what the plugin does. */
  description: string;
  /** Author / maintainer. */
  author: string;
};

/**
 * Base plugin interface.
 *
 * Plugins hook into the Jarvis event bus and may register providers,
 * modes, or custom behaviour. The lifecycle methods are called by the
 * Jarvis core in order: register → activate → pause / resume → stop.
 */
type IPlugin = {
  /** Unique identifier assigned by the registry. */
  readonly id: PluginId;

  /** Immutable manifest describing the plugin. */
  readonly manifest: PluginManifest;

  /** Current lifecycle status. */
  readonly status: PluginStatus;

  /** Called once when the plugin is first registered. */
  onRegister(): void | Promise<void>;

  /** Called when the plugin becomes active (after register). */
  onActivate(): void | Promise<void>;

  /** Called when the plugin is temporarily paused. */
  onPause(): void | Promise<void>;

  /** Called when a paused plugin is resumed. */
  onResume(): void | Promise<void>;

  /** Called when the plugin is permanently stopped / unloaded. */
  onStop(): void | Promise<void>;
};

// ---------------------------------------------------------------------------
// Provider (AI Provider abstraction)
// ---------------------------------------------------------------------------

/** Supported AI provider protocols. */
type ProviderProtocol = 'openai' | 'anthropic' | 'gemini' | 'custom';

/** Capability flags a provider advertises. */
type ProviderCapabilities = {
  /** Supports chat completions. */
  chat: boolean;
  /** Supports image generation. */
  imageGeneration: boolean;
  /** Supports text-to-speech. */
  tts: boolean;
  /** Supports speech-to-text. */
  stt: boolean;
  /** Supports tool/function calling. */
  toolUse: boolean;
  /** Supports streaming responses. */
  streaming: boolean;
};

/**
 * AI provider abstracton.
 *
 * Represents a single AI backend (e.g. OpenAI, Anthropic, a local LLM).
 * The Jarvis core routes requests to the appropriate provider based on
 * the active mode and user preferences.
 */
type IProvider = {
  /** Unique provider id (e.g. "openai-gpt-4o"). */
  readonly id: string;

  /** Display name. */
  readonly name: string;

  /** Protocol this provider speaks. */
  readonly protocol: ProviderProtocol;

  /** Capabilities the provider advertises. */
  readonly capabilities: ProviderCapabilities;

  /** Base URL for API requests. */
  readonly baseUrl: string;

  /** Whether this provider is currently enabled. */
  readonly enabled: boolean;

  /** Validate the provider configuration (API key, connectivity). */
  validate(): Promise<boolean>;

  /** List models available on this provider. */
  listModels(): Promise<string[]>;
};

// ---------------------------------------------------------------------------
// Mode / Profile
// ---------------------------------------------------------------------------

/**
 * A mode (profile) bundles configuration for a specific use-case.
 *
 * Examples: "coding", "writing", "analysis", "casual".
 * Each mode can specify a preferred provider, system prompt, and
 * behavioural overrides.
 */
type IMode = {
  /** Unique mode id. */
  readonly id: string;

  /** Human-readable label. */
  readonly label: string;

  /** Short description shown in the mode picker. */
  readonly description: string;

  /** Icon identifier (references an @icon-park/react icon name). */
  readonly icon: string;

  /** Preferred provider id for this mode. */
  readonly defaultProviderId: string;

  /** Default model for this mode (provider-specific). */
  readonly defaultModel: string;

  /** System prompt template for this mode. */
  readonly systemPrompt: string;

  /** Arbitrary overrides the mode applies. */
  readonly overrides: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Event Bus
// ---------------------------------------------------------------------------

/**
 * Events the Jarvis core can emit.
 *
 * Consumers (plugins, UI) subscribe to these events to react to
 * system state changes without tight coupling.
 */
type JarvisEvent =
  | { type: 'core:initialized' }
  | { type: 'plugin:registered'; pluginId: PluginId }
  | { type: 'plugin:activated'; pluginId: PluginId }
  | { type: 'plugin:paused'; pluginId: PluginId }
  | { type: 'plugin:resumed'; pluginId: PluginId }
  | { type: 'plugin:stopped'; pluginId: PluginId }
  | { type: 'mode:switched'; modeId: string }
  | { type: 'provider:added'; providerId: string }
  | { type: 'provider:removed'; providerId: string }
  | { type: 'provider:enabled'; providerId: string }
  | { type: 'provider:disabled'; providerId: string };

/** Event handler callback. */
type EventHandler<T extends JarvisEvent = JarvisEvent> = (event: T) => void;

/**
 * Lightweight event bus wrapper.
 *
 * Provides pub/sub for the Jarvis system. Does not replace
 * the existing Electron IPC bridge or WebSocket broadcast —
 * it operates within a single process context.
 */
type IEventBus = {
  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  on<T extends JarvisEvent>(eventType: T['type'], handler: EventHandler<T>): () => void;

  /** Subscribe to ALL events (wildcard). Returns an unsubscribe function. */
  onAny(handler: EventHandler): () => void;

  /** Emit an event to all subscribers. */
  emit(event: JarvisEvent): void;

  /** Remove all subscribers. */
  clear(): void;

  /** Number of active subscriptions. */
  readonly subscriberCount: number;
};

// ---------------------------------------------------------------------------
// Jarvis Core
// ---------------------------------------------------------------------------

/**
 * Top-level Jarvis system interface.
 *
 * This is the main entry point that wires together plugins,
 * providers, modes, and the event bus into a cohesive control layer.
 */
type IJarvisCore = {
  /** The event bus for system-wide pub/sub. */
  readonly events: IEventBus;

  /** Whether the core has been initialized. */
  readonly initialized: boolean;

  /** Initialize the Jarvis system. Idempotent — safe to call multiple times. */
  initialize(): Promise<void>;

  /** Register a plugin. */
  registerPlugin(plugin: IPlugin): Promise<void>;

  /** Unregister a plugin by id. */
  unregisterPlugin(pluginId: PluginId): Promise<void>;

  /** Get a plugin by id. */
  getPlugin(pluginId: PluginId): IPlugin | undefined;

  /** List all registered plugins. */
  listPlugins(): IPlugin[];

  /** Register an AI provider. */
  registerProvider(provider: IProvider): Promise<void>;

  /** Unregister a provider by id. */
  unregisterProvider(providerId: string): Promise<void>;

  /** Get a provider by id. */
  getProvider(providerId: string): IProvider | undefined;

  /** List all registered providers. */
  listProviders(): IProvider[];

  /** Register a mode/profile. */
  registerMode(mode: IMode): Promise<void>;

  /** Unregister a mode by id. */
  unregisterMode(modeId: string): Promise<void>;

  /** Get a mode by id. */
  getMode(modeId: string): IMode | undefined;

  /** List all registered modes. */
  listModes(): IMode[];

  /** Switch to a different mode/profile. */
  switchMode(modeId: string): Promise<void>;

  /** Get the currently active mode id. */
  readonly activeModeId: string | null;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  PluginId,
  PluginStatus,
  PluginManifest,
  IPlugin,
  ProviderProtocol,
  ProviderCapabilities,
  IProvider,
  IMode,
  JarvisEvent,
  EventHandler,
  IEventBus,
  IJarvisCore,
};
