/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Providers — Entry Point
 *
 * Exports all provider implementations and a registration helper
 * that wires them into the AIRouter.
 */

import type { AIRouter } from '../ai-router/router';
import { LMStudioProvider, createLMStudioProvider } from './lmstudio';
import type { LMStudioConfig, HealthStatus } from './lmstudio';

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

/**
 * Register all available providers with the AIRouter.
 *
 * Currently only LM Studio. Future providers (OpenAI, Anthropic, etc.)
 * will be added here.
 */
async function registerAllProviders(
  router: AIRouter,
  configs: { lmstudio?: Partial<LMStudioConfig> } = {}
): Promise<void> {
  console.log('[Providers] Registering providers with AI Router...');

  // LM Studio
  try {
    const lmstudio = createLMStudioProvider(configs.lmstudio);
    await router.registerProvider(lmstudio);
    console.log('[Providers] LM Studio registered.');
  } catch (error) {
    console.warn('[Providers] Failed to register LM Studio:', error);
  }

  console.log('[Providers] Provider registration complete.');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { LMStudioProvider, createLMStudioProvider, registerAllProviders };
export type { LMStudioConfig, HealthStatus };
