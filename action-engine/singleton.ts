/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Action Engine — Singleton
 *
 * Provides a globally accessible ActionEngine instance so plugins
 * can register/unregister actions during their lifecycle without
 * needing to create their own engine.
 *
 * Usage from a plugin:
 *   const engine = require("../action-engine/singleton").getActionEngine();
 *   engine.registerAction(def, handler);
 */

import { ActionEngine } from './engine';

let _instance: ActionEngine | null = null;

/**
 * Get or create the singleton ActionEngine instance.
 */
function getActionEngine(): ActionEngine {
  if (!_instance) {
    _instance = new ActionEngine();
    console.log('[ActionEngine:Singleton] Created global instance.');
  }
  return _instance;
}

/**
 * Reset the singleton (for testing).
 */
function resetActionEngine(): void {
  _instance = null;
}

export { getActionEngine, resetActionEngine };