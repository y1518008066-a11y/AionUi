/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Jarvis Configuration Service
 *
 * Persistent configuration for Jarvis runtime settings.
 * Stores mode plugin lists, provider configurations, active provider/model,
 * and other Jarvis-specific configuration that survives restarts.
 *
 * Storage: JSON file at config/jarvis-settings.json
 * Fallback: built-in defaults from mode-system/mode.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { BUILTIN_MODES } from '../mode-system/mode';
import type { ModeId, ModeProfile } from '../mode-system/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Provider configuration stored in Jarvis settings. */
type ProviderConfigEntry = {
  /** Unique provider id. */
  id: string;
  /** Provider type. */
  type: 'lmstudio' | 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'openai-compatible' | 'manual';
  /** Display name. */
  name: string;
  /** API endpoint URL. */
  endpoint: string;
  /** API key (empty for local providers). */
  apiKey: string;
  /** Whether this provider is enabled. */
  enabled: boolean;
  /** Whether this provider should be auto-discovered. */
  autoDiscover: boolean;
  /** When this provider was last checked (epoch ms). */
  lastChecked: number | null;
  /** When this provider was added (epoch ms). */
  createdAt: number;
};

/** Per-mode plugin configuration. */
type ModePluginConfig = {
  /** Plugin ids to activate when this mode is entered. */
  activePlugins: string[];
};

/** Full Jarvis configuration. */
type JarvisSettings = {
  /** Version of the config schema (for migrations). */
  version: 1;

  /** Per-mode plugin configuration. */
  modes: Record<ModeId, ModePluginConfig>;

  /** Currently active mode id (persisted across restarts). */
  activeModeId: string | null;

  /** Last updated timestamp. */
  updatedAt: number | null;

  /** Active provider id. */
  activeProviderId: string | null;

  /** Active model. */
  activeModel: string | null;

  /** Configured providers. */
  providers: ProviderConfigEntry[];

  /** Default provider id (fallback when no mode preference). */
  defaultProviderId: string | null;

  /** Default model id. */
  defaultModelId: string | null;
};

/** Result of loading settings. */
type LoadSettingsResult = {
  /** The loaded settings (or built-in defaults). */
  settings: JarvisSettings;

  /** Whether settings were loaded from disk or created from defaults. */
  source: 'disk' | 'defaults';

  /** Path to the settings file. */
  path: string;
};

// ---------------------------------------------------------------------------
// Default settings (from built-in mode profiles)
// ---------------------------------------------------------------------------

function buildDefaultSettings(): JarvisSettings {
  const modes: Record<string, ModePluginConfig> = {};

  for (const mode of BUILTIN_MODES) {
    modes[mode.id] = {
      activePlugins: [...mode.rules.activePlugins],
    };
  }

  const defaultProviders: ProviderConfigEntry[] = [
    {
      id: 'lmstudio',
      type: 'lmstudio',
      name: 'LM Studio (Local)',
      endpoint: 'http://127.0.0.1:1234',
      apiKey: '',
      enabled: true,
      autoDiscover: true,
      lastChecked: null,
      createdAt: Date.now(),
    },
  ];

  return {
    version: 1,
    modes,
    activeModeId: 'default',
    updatedAt: Date.now(),
    activeProviderId: 'lmstudio',
    activeModel: null,
    providers: defaultProviders,
    defaultProviderId: 'lmstudio',
    defaultModelId: null,
  };
}

// ---------------------------------------------------------------------------
// Config Service
// ---------------------------------------------------------------------------

class JarvisConfigService {
  private settings: JarvisSettings;
  private filePath: string;
  private source: 'disk' | 'defaults';

  /**
   * @param configDir - Directory for config files (default: 'config').
   */
  constructor(configDir = 'config') {
    // Ensure directory exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    this.filePath = join(configDir, 'jarvis-settings.json');
    const loaded = this.loadFromDisk();
    this.settings = loaded.settings;
    this.source = loaded.source;

    console.log(
      '[JarvisConfig] Loaded from ' + this.source +
      ' | Path: ' + this.filePath +
      ' | Modes: ' + Object.keys(this.settings.modes).join(', ')
    );
  }

  // -----------------------------------------------------------------------
  // Mode plugin configuration
  // -----------------------------------------------------------------------

  /** Get the configured active plugins for a mode. Falls back to built-in defaults. */
  getModePlugins(modeId: ModeId): string[] {
    const modeConfig = this.settings.modes[modeId];
    if (modeConfig && modeConfig.activePlugins.length > 0) {
      return [...modeConfig.activePlugins];
    }
    const builtinMode = BUILTIN_MODES.find((m) => m.id === modeId);
    if (builtinMode) {
      return [...builtinMode.rules.activePlugins];
    }
    return [];
  }

  /** Set the active plugins for a mode. Persists immediately. */
  setModePlugins(modeId: ModeId, plugins: string[]): void {
    this.settings.modes[modeId] = { activePlugins: [...plugins] };
    this.settings.updatedAt = Date.now();
    this.save();
  }

  /** Add a plugin to a mode's active list. */
  addPluginToMode(modeId: ModeId, pluginId: string): void {
    const current = this.getModePlugins(modeId);
    if (!current.includes(pluginId)) {
      this.setModePlugins(modeId, [...current, pluginId]);
    }
  }

  /** Remove a plugin from a mode's active list. */
  removePluginFromMode(modeId: ModeId, pluginId: string): void {
    const current = this.getModePlugins(modeId);
    this.setModePlugins(modeId, current.filter((id) => id !== pluginId));
  }

  /** Get all mode configurations. */
  getAllModeConfigs(): Record<ModeId, ModePluginConfig> {
    return { ...this.settings.modes };
  }

  // -----------------------------------------------------------------------
  // Active mode
  // -----------------------------------------------------------------------

  getActiveModeId(): string | null { return this.settings.activeModeId; }
  setActiveModeId(modeId: string): void {
    this.settings.activeModeId = modeId;
    this.settings.updatedAt = Date.now();
    this.save();
  }

  // -----------------------------------------------------------------------
  // Provider / model
  // -----------------------------------------------------------------------

  getActiveProviderId(): string | null { return this.settings.activeProviderId; }
  setActiveProviderId(providerId: string): void {
    this.settings.activeProviderId = providerId;
    this.settings.updatedAt = Date.now();
    this.save();
  }

  getActiveModel(): string | null { return this.settings.activeModel; }
  setActiveModel(model: string): void {
    this.settings.activeModel = model;
    this.settings.updatedAt = Date.now();
    this.save();
  }

  // -----------------------------------------------------------------------
  // Provider configuration
  // -----------------------------------------------------------------------

  getProviders(): ProviderConfigEntry[] { return [...this.settings.providers]; }
  getProvider(providerId: string): ProviderConfigEntry | undefined {
    return this.settings.providers.find((p) => p.id === providerId);
  }

  setProvider(config: ProviderConfigEntry): void {
    const idx = this.settings.providers.findIndex((p) => p.id === config.id);
    if (idx >= 0) {
      this.settings.providers[idx] = config;
    } else {
      this.settings.providers.push(config);
    }
    this.settings.updatedAt = Date.now();
    this.save();
  }

  removeProvider(providerId: string): void {
    this.settings.providers = this.settings.providers.filter((p) => p.id !== providerId);
    if (this.settings.activeProviderId === providerId) this.settings.activeProviderId = null;
    if (this.settings.defaultProviderId === providerId) this.settings.defaultProviderId = null;
    this.settings.updatedAt = Date.now();
    this.save();
  }

  getDefaultProviderId(): string | null { return this.settings.defaultProviderId; }
  setDefaultProviderId(providerId: string): void {
    this.settings.defaultProviderId = providerId;
    this.settings.updatedAt = Date.now();
    this.save();
  }

  getDefaultModelId(): string | null { return this.settings.defaultModelId; }
  setDefaultModelId(modelId: string): void {
    this.settings.defaultModelId = modelId;
    this.settings.updatedAt = Date.now();
    this.save();
  }

  // -----------------------------------------------------------------------
  // Full settings
  // -----------------------------------------------------------------------

  getSettings(): Readonly<JarvisSettings> { return this.settings; }

  replaceSettings(settings: JarvisSettings): void {
    this.settings = settings;
    this.settings.updatedAt = Date.now();
    this.save();
  }

  resetToDefaults(): void {
    this.settings = buildDefaultSettings();
    this.source = 'defaults';
    this.save();
    console.log('[JarvisConfig] Reset to built-in defaults.');
  }

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getSource(): 'disk' | 'defaults' { return this.source; }
  getFilePath(): string { return this.filePath; }
  getUpdatedAt(): number | null { return this.settings.updatedAt; }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  getDiagnostics(): Record<string, unknown> {
    return {
      source: this.source,
      path: this.filePath,
      version: this.settings.version,
      updatedAt: this.settings.updatedAt,
      activeModeId: this.settings.activeModeId,
      activeProviderId: this.settings.activeProviderId,
      activeModel: this.settings.activeModel,
      modes: Object.entries(this.settings.modes).map(([id, config]) => ({
        id, plugins: config.activePlugins, pluginCount: config.activePlugins.length,
      })),
      providers: this.settings.providers.map((p) => ({
        id: p.id, type: p.type, name: p.name, endpoint: p.endpoint, enabled: p.enabled,
      })),
      defaultProviderId: this.settings.defaultProviderId,
      defaultModelId: this.settings.defaultModelId,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private loadFromDisk(): LoadSettingsResult {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as JarvisSettings;
        if (parsed && typeof parsed === 'object' && parsed.modes) {
          return { settings: parsed, source: 'disk', path: this.filePath };
        }
      }
    } catch (err) {
      console.warn('[JarvisConfig] Failed to load from disk, using defaults:', err);
    }
    return { settings: buildDefaultSettings(), source: 'defaults', path: this.filePath };
  }

  private save(): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
      this.source = 'disk';
    } catch (err) {
      console.error('[JarvisConfig] Failed to save settings:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: JarvisConfigService | null = null;

function getJarvisConfig(): JarvisConfigService {
  if (!_instance) _instance = new JarvisConfigService();
  return _instance;
}

function resetJarvisConfig(): void { _instance = null; }

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { JarvisConfigService, getJarvisConfig, resetJarvisConfig, buildDefaultSettings };
export type { ModePluginConfig, ProviderConfigEntry, JarvisSettings, LoadSettingsResult };
