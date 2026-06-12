/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mode System — Entry Point
 *
 * Provides the complete mode/profile infrastructure:
 * - ModeManager: orchestrates mode switching + event emission
 * - ModeRegistry: in-memory storage with filtering
 * - Predefined modes: Default, Work, Game
 *
 * Usage:
 *
 * `	s
 * import { ModeManager } from './mode-system';
 *
 * const modeManager = new ModeManager(jarvisCore.events);
 * await modeManager.initialize();
 * await modeManager.switchMode('work');
 * `
 */

import { ModeManager } from './manager';
import { ModeRegistry } from './registry';
import { DefaultMode, WorkMode, GameMode, BUILTIN_MODES } from './mode';

export { ModeManager, ModeRegistry, DefaultMode, WorkMode, GameMode, BUILTIN_MODES };

// Re-export types
export type { ModeId, PermissionLevel, ModeRules, ModeProfile, ModeContext, ModeEvent } from './types';
