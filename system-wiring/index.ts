/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * System Wiring Layer — Entry Point
 *
 * Provides the centralized system initializer that bootstraps all
 * Jarvis subsystems in the correct dependency order and wires them
 * together via the shared EventBus.
 *
 * Usage:
 *
 * `	s
 * import { initializeJarvisSystem } from './system-wiring';
 *
 * const wired = await initializeJarvisSystem();
 * // wired.jarvisCore, wired.aiRouter, wired.executionBridge, wired.pluginManager
 * `
 */

import { initializeJarvisSystem, formatInitStatus, getSystemGraph } from './initializer';
import { buildSystemGraph, wireAll } from './wiring';

export { initializeJarvisSystem, formatInitStatus, getSystemGraph, buildSystemGraph, wireAll };

// Re-export types
export type { SystemNode, SystemEdge, SystemGraph, WiredSystems, InitStatus, InitStage } from './types';
