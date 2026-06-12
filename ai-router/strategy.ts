/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AI Router Layer 鈥?Routing Strategy Scaffold
 *
 * Defines the strategy interface and a default "first available" strategy.
 * Future strategies (mode-based, cost-based, speed-based) will implement
 * the same interface.
 */

import type { RoutingContext, RoutingDecision } from './types';
import { createDualRoutingStrategy } from './dual-strategy';

// ---------------------------------------------------------------------------
// Strategy interface
// ---------------------------------------------------------------------------

/**
 * A routing strategy selects which provider (and model) should handle a
 * given request.
 *
 * Implementations can be swapped at runtime to support different
 * priorities: cost optimisation, latency minimisation, mode-specific
 * routing, or load balancing.
 */
type IRoutingStrategy = {
  /** Human-readable name for diagnostics. */
  readonly name: string;

  /**
   * Select a provider and model for the given routing context.
   *
   * @returns A routing decision, or null if no suitable provider is found.
   */
  select(context: RoutingContext): RoutingDecision | null;
};

// ---------------------------------------------------------------------------
// Default strategy: "first available provider"
// ---------------------------------------------------------------------------

const createFirstAvailableStrategy = (): IRoutingStrategy => ({
  name: 'first-available',

  select(context: RoutingContext): RoutingDecision | null {
    const enabled = context.providers.filter((p) => p.enabled);
    if (enabled.length === 0) {
      return null;
    }

    const provider = enabled[0];
    const model = context.request.model || 'default';

    return {
      provider,
      model,
      reason: 'Selected first available provider: ' + provider.name,
    };
  },
});

// ---------------------------------------------------------------------------
// Future strategy placeholders (unimplemented)
// ---------------------------------------------------------------------------

/**
 * Placeholder: Mode-based routing strategy.
 *
 * Intended behaviour: reads the active mode from JarvisCore and selects
 * the provider specified in that mode's defaultProviderId field.
 */
// const createModeBasedStrategy = (core: IJarvisCore): IRoutingStrategy => ({ ... });

/**
 * Placeholder: Cost-based routing strategy.
 *
 * Intended behaviour: ranks providers by estimated cost per token,
 * selects the cheapest provider that meets the request's requirements.
 */
// const createCostBasedStrategy = (): IRoutingStrategy => ({ ... });

/**
 * Placeholder: Speed-based routing strategy.
 *
 * Intended behaviour: tracks historical latency per provider and selects
 * the fastest provider that meets the request's requirements.
 */
// const createLatencyBasedStrategy = (): IRoutingStrategy => ({ ... });

/**
 * Placeholder: Round-robin routing strategy.
 *
 * Intended behaviour: cycles through available providers to distribute
 * load evenly.
 */
// const createRoundRobinStrategy = (): IRoutingStrategy => ({ ... });

// ---------------------------------------------------------------------------
// Strategy factory
// ---------------------------------------------------------------------------

/** Known strategy names (extend as strategies are implemented). */
type StrategyName = 'first-available' | 'dual';

function createStrategy(name: StrategyName): IRoutingStrategy {
  switch (name) {
    case 'first-available':
    case 'dual':
      return createDualRoutingStrategy();
      return createFirstAvailableStrategy();
    default:
      console.warn('[AIRouter] Unknown strategy "' + name + '" 鈥?falling back to first-available.');
      return createFirstAvailableStrategy();
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { createStrategy, createFirstAvailableStrategy };
export type { IRoutingStrategy, StrategyName };
