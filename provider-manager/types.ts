/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provider Manager — Type Definitions
 *
 * Defines the provider management model: discovery, health, models,
 * status tracking, and failover configuration.
 */

import type { ProviderProtocol, ProviderCapabilities } from '../jarvis-core/interfaces';

// ---------------------------------------------------------------------------
// Provider identity & discovery
// ---------------------------------------------------------------------------

/** Known provider types that the system can auto-discover. */
type ProviderType = 'lmstudio' | 'ollama' | 'vllm' | 'localai' | 'newapi' | 'openai-compatible' | 'manual';

/** Configuration for auto-discovering a provider type. */
type DiscoveryTarget = {
  /** Human-readable label for this target. */
  label: string;

  /** Provider type hint. */
  type: ProviderType;

  /** Endpoint URL to probe. */
  endpoint: string;

  /** Timeout for discovery probe (ms). */
  timeoutMs: number;
};

/** Result of a discovery probe. */
type DiscoveryResult = {
  /** The target that was probed. */
  target: DiscoveryTarget;

  /** Whether the endpoint responded. */
  reachable: boolean;

  /** HTTP status code (0 if unreachable). */
  statusCode: number;

  /** Latency of the probe (ms). */
  latencyMs: number;

  /** Detected protocol (null if unreachable). */
  protocol: ProviderProtocol | null;

  /** Number of detected models (0 if unreachable). */
  modelCount: number;

  /** Error message if probe failed. */
  error?: string;

  /** Timestamp of the probe. */
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Provider health
// ---------------------------------------------------------------------------

/** Health status of a registered provider. */
type ProviderHealth = {
  /** Whether the provider endpoint is reachable. */
  reachable: boolean;

  /** Whether the provider passed validation. */
  connected: boolean;

  /** Last measured latency (ms). */
  latencyMs: number;

  /** Endpoint URL. */
  endpoint: string;

  /** Detected or configured protocol. */
  protocol: ProviderProtocol | null;

  /** Provider type. */
  providerType: ProviderType;

  /** Number of available models. */
  modelCount: number;

  /** When the health check was last performed. */
  lastChecked: number | null;

  /** Last error message (if any). */
  lastError: string | null;

  /** Consecutive failure count for failover detection. */
  consecutiveFailures: number;
};

// ---------------------------------------------------------------------------
// Normalized model
// ---------------------------------------------------------------------------

/**
 * A normalized model representation across all providers.
 *
 * Provider-specific model names are mapped to this common format
 * so the system can reason about models uniformly.
 */
type NormalizedModel = {
  /** Provider-specific model id (e.g. "qwen3.5-4b"). */
  id: string;

  /** Human-readable display name. */
  displayName: string;

  /** The provider this model belongs to. */
  providerId: string;

  /** Provider type (for capability inference). */
  providerType: ProviderType;

  /** Known capabilities (may be partial — inferred from provider). */
  capabilities: Partial<ProviderCapabilities>;

  /** Whether this model supports streaming. */
  supportsStreaming: boolean;

  /** Estimated context length (0 if unknown). */
  contextLength: number;
};

// ---------------------------------------------------------------------------
// Provider status
// ---------------------------------------------------------------------------

/** Runtime status of a registered provider. */
type ProviderStatus = {
  /** The provider instance id. */
  providerId: string;

  /** Display name. */
  name: string;

  /** Provider type. */
  type: ProviderType;

  /** Whether the provider is enabled. */
  enabled: boolean;

  /** Whether this is the currently active provider. */
  active: boolean;

  /** Current health. */
  health: ProviderHealth;

  /** Number of registered models. */
  modelCount: number;

  /** When the provider was registered. */
  registeredAt: number;

  /** When the status was last refreshed. */
  lastRefreshed: number;

  /** Number of requests routed to this provider. */
  requestCount: number;
};

// ---------------------------------------------------------------------------
// Failover configuration
// ---------------------------------------------------------------------------

/**
 * Failover configuration for automatic provider switching.
 *
 * Currently architectural — automatic failover is not enabled.
 */
type FailoverConfig = {
  /** Whether automatic failover is enabled. */
  enabled: boolean;

  /** How many consecutive failures before triggering failover. */
  failureThreshold: number;

  /** How long to wait before retrying a failed provider (ms). */
  retryIntervalMs: number;

  /** Ordered list of fallback provider ids. */
  fallbackOrder: string[];

  /** Whether to auto-recover when a failed provider becomes healthy again. */
  autoRecover: boolean;
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Events emitted by the provider manager via EventBus. */
type ProviderManagerEvent =
  | { type: 'providers:discovered'; count: number }
  | { type: 'providers:registered'; providerId: string }
  | { type: 'providers:removed'; providerId: string }
  | { type: 'providers:activated'; providerId: string }
  | { type: 'providers:deactivated'; providerId: string }
  | { type: 'providers:health:changed'; providerId: string; health: ProviderHealth }
  | { type: 'providers:models:refreshed'; providerId: string; modelCount: number }
  | { type: 'providers:failover:triggered'; fromProviderId: string; toProviderId: string }
  | { type: 'providers:error'; providerId: string; error: string };

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  ProviderType,
  DiscoveryTarget,
  DiscoveryResult,
  ProviderHealth,
  NormalizedModel,
  ProviderStatus,
  FailoverConfig,
  ProviderManagerEvent,
};
