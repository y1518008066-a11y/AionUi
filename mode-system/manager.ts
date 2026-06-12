/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mode System 鈥?Manager
 *
 * Orchestrates mode registration, switching, and event emission.
 * Wires into JarvisCore EventBus for mode lifecycle events.
 *
 * Mode switching is STRUCTURAL ONLY 鈥?no real system changes occur.
 * The manager tracks state and emits events, but actual behavior
 * changes (plugin activation, provider switching) will be implemented
 * in a future task.
 */

import type { IEventBus } from '../jarvis-core/interfaces';
import type { JarvisConfigService } from '../config/jarvis-config';


/** Minimal interface for PluginManager — avoids circular dependency. */
interface IPluginManagerForMode {
  enable(pluginId: string): Promise<boolean>;
  disable(pluginId: string): Promise<boolean>;
  isEnabled(pluginId: string): boolean;
  listEnabled(): string[];
}
import type { ModeId, ModeProfile, ModeContext } from './types';
import { ModeRegistry } from './registry';
import { BUILTIN_MODES } from './mode';

// ---------------------------------------------------------------------------
// Mode Manager
// ---------------------------------------------------------------------------

class ModeManager {
  private readonly registry: ModeRegistry;
    private readonly eventBus: IEventBus;

  /** Optional PluginManager for orchestration. */
    private pluginManager: IPluginManagerForMode | null = null;

  /** Optional config service for persistent mode plugin lists. */
  private configService: JarvisConfigService | null = null;

  /** Currently active mode id. */
    private activeModeId: ModeId | null = null;

  /**
   * Set the PluginManager reference for orchestration.
   * Called during system initialization to wire mode switching
   * to plugin lifecycle management.
   */
    setPluginManager(pm: IPluginManagerForMode): void {
    this.pluginManager = pm;
    console.log('[ModeManager] PluginManager wired for orchestration.');
  }

  /**
   * Set the JarvisConfigService for persistent mode configuration.
   */
  setConfigService(config: JarvisConfigService): void {
    this.configService = config;
    console.log('[ModeManager] ConfigService wired for persistence.');
  }

  constructor(eventBus: IEventBus) {
    this.registry = new ModeRegistry();
    this.eventBus = eventBus;
    console.log('[ModeManager] Initialized.');
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /**
   * Register all built-in modes.
   *
   * Called once during system initialization. After built-in modes
   * are registered, the default mode is activated.
   */
  async initialize(): Promise<void> {
    console.log('[ModeManager] Registering built-in modes...');

    for (const mode of BUILTIN_MODES) {
      this.registry.register(mode);
      this.eventBus.emit({ type: 'mode:registered', modeId: mode.id });
    }

    // Activate the default mode
    await this.switchMode('default');

    console.log('[ModeManager] Initialized with ' + this.registry.size + ' modes. Active: ' + this.activeModeId);
  }

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /**
   * Register a custom mode.
   */
  async registerMode(mode: ModeProfile): Promise<void> {
    this.registry.register(mode);
    this.eventBus.emit({ type: 'mode:registered', modeId: mode.id });
  }

  /**
   * Unregister a custom mode.
   *
   * Cannot unregister built-in modes or the active mode.
   */
  async unregisterMode(modeId: ModeId): Promise<void> {
    const mode = this.registry.get(modeId);
    if (!mode) {
      console.warn('[ModeManager] Cannot unregister unknown mode: ' + modeId);
      return;
    }

    if (mode.builtin) {
      console.warn('[ModeManager] Cannot unregister built-in mode: ' + modeId);
      return;
    }

    if (modeId === this.activeModeId) {
      console.warn('[ModeManager] Cannot unregister the active mode. Switch first.');
      return;
    }

    this.registry.unregister(modeId);
  }

  // -----------------------------------------------------------------------
  // Mode switching
  // -----------------------------------------------------------------------

    /**
   * Switch to a different mode.
   *
   * Orchestrates plugin activation/deactivation based on the mode's
   * activePlugins list. Plugins in the target mode that are not yet
   * enabled will be enabled; plugins no longer in the target mode
   * will be disabled.
   *
   * Idempotent: switching to the current mode is a no-op.
   */
  async switchMode(modeId: ModeId): Promise<void> {
    const mode = this.registry.get(modeId);
    if (!mode) {
      console.warn('[ModeManager] Cannot switch to unknown mode: ' + modeId);
      this.eventBus.emit({
        type: 'mode:error',
        modeId,
        error: 'Unknown mode: ' + modeId,
      });
      return;
    }

    if (modeId === this.activeModeId) {
      console.log('[ModeManager] Already in mode: ' + modeId);
      return;
    }

    const previousModeId = this.activeModeId;
    const t0 = Date.now();

    console.log(
      '[ModeManager] Switching mode: ' + (previousModeId || 'none') + ' -> ' + modeId + ' (' + mode.label + ')'
    );

    // Update state first
    this.activeModeId = modeId;

    // --- Plugin orchestration ---
    if (this.pluginManager) {
          // Use persistent config if available, fall back to built-in rules
    const activePlugins = this.configService
      ? this.configService.getModePlugins(modeId)
      : mode.rules.activePlugins;
    const targetPlugins = new Set(activePlugins);
      const currentPlugins = new Set(this.pluginManager.listEnabled());
      const previousMode = previousModeId ? this.registry.get(previousModeId) : null;
      const previousPlugins = new Set(previousMode?.rules.activePlugins || []);

      // Plugins to enable: in target but not currently enabled
      const toEnable = [...targetPlugins].filter((id) => !currentPlugins.has(id));
      // Plugins to disable: currently enabled, in previous mode but not in target
      const toDisable = [...currentPlugins].filter(
        (id) => previousPlugins.has(id) && !targetPlugins.has(id)
      );

      console.log(
        '[ModeManager] Plugin orchestration | Enable: ' + (toEnable.length || 'none') +
        ' | Disable: ' + (toDisable.length || 'none')
      );

      // Disable first (release resources), then enable
      for (const pluginId of toDisable) {
        try {
          const ok = await this.pluginManager.disable(pluginId);
          console.log('[ModeManager]   Disabled plugin: ' + pluginId + ' (' + (ok ? 'ok' : 'failed') + ')');
        } catch (err) {
          console.error('[ModeManager]   Failed to disable ' + pluginId + ':', err);
        }
      }

      for (const pluginId of toEnable) {
        try {
          const ok = await this.pluginManager.enable(pluginId);
          console.log('[ModeManager]   Enabled plugin: ' + pluginId + ' (' + (ok ? 'ok' : 'failed') + ')');
        } catch (err) {
          console.error('[ModeManager]   Failed to enable ' + pluginId + ':', err);
        }
      }
    } else {
      console.log('[ModeManager]   (No PluginManager wired — plugin orchestration skipped)');
    }

    // Log mode details
    console.log('[ModeManager]   Permission: ' + mode.rules.permissionLevel);
    console.log('[ModeManager]   Provider:   ' + (mode.rules.preferredProviderId || 'any'));
    console.log('[ModeManager]   Model:      ' + (mode.rules.preferredModel || 'any'));
    console.log('[ModeManager]   Active plugins: ' + mode.rules.activePlugins.join(', '));

    const switchMs = Date.now() - t0;

    // Build context
    const context: ModeContext = {
      previousModeId,
      nextModeId: modeId,
      nextMode: mode,
      timestamp: Date.now(),
    };

    // Emit event
    this.eventBus.emit({
      type: 'mode:changed',
      previousModeId,
      nextModeId: modeId,
    });

    console.log('[ModeManager] Mode switch complete in ' + switchMs + 'ms.');
    void context;
  }

  /**
   * Get the currently active mode id.
   */
  get activeMode(): ModeId | null {
    return this.activeModeId;
  }

  /**
   * Get the full profile of the active mode.
   */
  getActiveProfile(): ModeProfile | null {
    if (!this.activeModeId) return null;
    return this.registry.get(this.activeModeId) || null;
  }

  // -----------------------------------------------------------------------
  // Registry accessors
  // -----------------------------------------------------------------------

  /**
   * Get a mode by id.
   */
  getMode(modeId: ModeId): ModeProfile | undefined {
    return this.registry.get(modeId);
  }

  /**
   * List all registered modes.
   */
  listModes(): ModeProfile[] {
    return this.registry.list();
  }

  /**
   * Get the number of registered modes.
   */
  get modeCount(): number {
    return this.registry.size;
  }

  // -----------------------------------------------------------------------
  // Context builders (for future integration)
  // -----------------------------------------------------------------------

  /**
   * Build a ModeContext from the current state.
   *
   * Used by the AI Router and Execution Bridge to access the
   * current mode's rules.
   */
  getModeContext(): ModeContext | null {
    if (!this.activeModeId) return null;

    const mode = this.registry.get(this.activeModeId);
    if (!mode) return null;

    return {
      previousModeId: this.activeModeId,
      nextModeId: this.activeModeId,
      nextMode: mode,
      timestamp: Date.now(),
    };
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /**
   * Get a diagnostic summary of the mode system.
   */
  getDiagnostics(): Record<string, unknown> {
    const active = this.getActiveProfile();
    return {
      modeCount: this.registry.size,
      activeModeId: this.activeModeId,
      activeModeLabel: active?.label || 'none',
      activePermission: active?.rules.permissionLevel || 'none',
      modes: this.listModes().map((m) => ({
        id: m.id,
        label: m.label,
        builtin: m.builtin,
        permission: m.rules.permissionLevel,
        activePlugins: m.rules.allowedPlugins.length,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ModeManager };


