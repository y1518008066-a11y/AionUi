/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AI Router Layer — Entry Point
 *
 * Exports the AIRouter class and all associated types.
 * Depends on jarvis-core for the IProvider and IEventBus contracts.
 *
 * Usage:
 *
 * ```ts
 * import { createAIRouter } from './ai-router';
 *
 * const router = createAIRouter(jarvisCore);
 * await router.registerProvider(myProvider);
 * const response = await router.sendMessage({ messages: [...] });
 * ```
 */

import { AIRouter } from './router';
import type { IJarvisCore } from '../jarvis-core/interfaces';

/**
 * Factory function to create a new AIRouter instance wired to a
 * JarvisCore instance.
 *
 * @param jarvisCore — The Jarvis control layer instance (provides event bus + provider registry).
 * @param strategyName — Optional routing strategy name (defaults to "first-available").
 */
function createAIRouter(jarvisCore: IJarvisCore, strategyName?: string): AIRouter {
  return new AIRouter(jarvisCore, strategyName);
}

export { AIRouter, createAIRouter };

// Re-export types for convenience
export type {
  RouterRequest,
  RouterResponse,
  StreamChunk,
  ChatMessage,
  ToolCall,
  ToolResult,
  ToolDefinition,
  TokenUsage,
  RoutingContext,
  RoutingDecision,
  RouterEvent,
} from './types';

export type { IRoutingStrategy, StrategyName } from './strategy';
