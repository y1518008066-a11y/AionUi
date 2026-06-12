/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provider Manager — Entry Point
 *
 * Provides the complete provider management infrastructure:
 * - ProviderManager: lifecycle, switching, health, failover
 * - Auto-discovery: probes local endpoints for running providers
 * - Model discovery: normalized model listing across providers
 *
 * Usage:
 *
 * `	s
 * import { ProviderManager } from './provider-manager';
 *
 * const pm = new ProviderManager(jarvisCore);
 * pm.bindRouter(aiRouter);
 * const results = await pm.discoverAndRegister();
 * await pm.activateProvider('lmstudio-127-0-0-1-1234');
 * `
 */

import { ProviderManager } from './manager';
import { discoverProviders, discoverReachableProviders, DEFAULT_TARGETS } from './discovery';

export { ProviderManager, discoverProviders, discoverReachableProviders, DEFAULT_TARGETS };

// Re-export types
export type {
  ProviderType,
  DiscoveryTarget,
  DiscoveryResult,
  ProviderHealth,
  NormalizedModel,
  ProviderStatus,
  FailoverConfig,
  ProviderManagerEvent,
} from './types';
