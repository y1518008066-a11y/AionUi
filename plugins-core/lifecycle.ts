/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin System Core — Lifecycle State Machine
 *
 * Defines valid state transitions and enforces them.
 *
 * State diagram:
 *
 *   uninstalled ──install──> installed ──load──> loaded ──enable──> enabled
 *                                                                    │
 *                               uninstalled <──destroy── disabled <──disable
 *                                 │
 *   Any state ──error──> error
 *
 * ALL transitions are validated — invalid transitions throw.
 * NO real behavior occurs during transitions (logging only).
 */

import type { PluginState, PluginId } from './types';

// ---------------------------------------------------------------------------
// Valid transitions map
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<PluginState, PluginState[]> = {
  uninstalled: ['installed'],
  installed: ['loaded', 'destroyed', 'error'],
  loaded: ['enabled', 'unloaded', 'error'],
  enabled: ['disabled', 'error'],
  disabled: ['enabled', 'unloaded', 'error'],
  error: ['unloaded', 'destroyed'],
};

// ---------------------------------------------------------------------------
// Lifecycle class
// ---------------------------------------------------------------------------

/**
 * Lifecycle state machine for a single plugin.
 *
 * Tracks the current state and validates transitions. Each transition
 * is logged for observability.
 */
class PluginLifecycle {
  readonly pluginId: PluginId;
  private _state: PluginState;

  constructor(pluginId: PluginId, initialState: PluginState = 'uninstalled') {
    this.pluginId = pluginId;
    this._state = initialState;
  }

  /** Get the current state. */
  get state(): PluginState {
    return this._state;
  }

  /**
   * Transition to a new state.
   *
   * @throws If the transition is not allowed from the current state.
   */
  transition(to: PluginState): void {
    const allowed = VALID_TRANSITIONS[this._state];
    if (!allowed || !allowed.includes(to)) {
      throw new Error('[PluginLifecycle] Invalid transition for "' + this.pluginId + '": ' + this._state + ' -> ' + to);
    }

    console.log('[PluginLifecycle] ' + this.pluginId + ': ' + this._state + ' -> ' + to);

    this._state = to;
  }

  /**
   * Check if a transition is allowed from the current state.
   */
  canTransition(to: PluginState): boolean {
    const allowed = VALID_TRANSITIONS[this._state];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Get a list of allowed transitions from the current state.
   */
  getAllowedTransitions(): PluginState[] {
    return VALID_TRANSITIONS[this._state] || [];
  }

  /**
   * Reset to the initial state (typically 'uninstalled').
   */
  reset(): void {
    console.log('[PluginLifecycle] ' + this.pluginId + ': reset to uninstalled');
    this._state = 'uninstalled';
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { PluginLifecycle };
