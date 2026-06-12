/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mode System — Registry
 *
 * In-memory registry for mode profiles. Supports registration,
 * lookup, and filtering.
 */

import type { ModeId, ModeProfile } from './types';

// ---------------------------------------------------------------------------
// Mode Registry
// ---------------------------------------------------------------------------

class ModeRegistry {
  private readonly modes = new Map<ModeId, ModeProfile>();

  /**
   * Register a mode profile.
   *
   * @throws If a mode with the same id already exists.
   */
  register(mode: ModeProfile): void {
    if (this.modes.has(mode.id)) {
      throw new Error('[ModeRegistry] Mode "' + mode.id + '" is already registered.');
    }
    this.modes.set(mode.id, mode);
    console.log('[ModeRegistry] Registered: ' + mode.label + ' (' + mode.id + ', ' + mode.rules.permissionLevel + ')');
  }

  /**
   * Remove a mode from the registry.
   */
  unregister(modeId: ModeId): boolean {
    const existed = this.modes.has(modeId);
    if (existed) {
      this.modes.delete(modeId);
      console.log('[ModeRegistry] Unregistered: ' + modeId);
    }
    return existed;
  }

  /**
   * Get a mode by id.
   */
  get(modeId: ModeId): ModeProfile | undefined {
    return this.modes.get(modeId);
  }

  /**
   * Check if a mode exists.
   */
  has(modeId: ModeId): boolean {
    return this.modes.has(modeId);
  }

  /**
   * List all registered modes, sorted by displayOrder.
   */
  list(): ModeProfile[] {
    return [...this.modes.values()].toSorted((a, b) => a.displayOrder - b.displayOrder);
  }

  /**
   * List only built-in modes.
   */
  listBuiltin(): ModeProfile[] {
    return this.list().filter((m) => m.builtin);
  }

  /**
   * List only user/custom modes.
   */
  listCustom(): ModeProfile[] {
    return this.list().filter((m) => !m.builtin);
  }

  /**
   * Get the default mode (always present).
   */
  getDefault(): ModeProfile | undefined {
    return this.modes.get('default');
  }

  /**
   * Number of registered modes.
   */
  get size(): number {
    return this.modes.size;
  }

  /**
   * Remove all modes.
   */
  clear(): void {
    const count = this.modes.size;
    this.modes.clear();
    console.log('[ModeRegistry] Cleared ' + count + ' modes.');
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ModeRegistry };
