/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provider Manager — Auto Discovery
 *
 * Probes known endpoints to detect running AI providers.
 * Extensible: new targets can be added without modifying core logic.
 */

import type { ProviderType, DiscoveryTarget, DiscoveryResult, ProviderProtocol } from './types';

// ---------------------------------------------------------------------------
// Built-in discovery targets
// ---------------------------------------------------------------------------

/**
 * Default discovery targets.
 *
 * Each target is probed sequentially. The first reachable endpoint
 * for each provider type wins.
 */
const DEFAULT_TARGETS: DiscoveryTarget[] = [
  {
    label: 'LM Studio (localhost:1234)',
    type: 'lmstudio',
    endpoint: 'http://127.0.0.1:1234',
    timeoutMs: 3000,
  },
  {
    label: 'LM Studio (localhost:1235)',
    type: 'lmstudio',
    endpoint: 'http://127.0.0.1:1235',
    timeoutMs: 3000,
  },
  {
    label: 'Ollama (localhost:11434)',
    type: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    timeoutMs: 3000,
  },
  {
    label: 'vLLM (localhost:8000)',
    type: 'vllm',
    endpoint: 'http://127.0.0.1:8000',
    timeoutMs: 3000,
  },
  {
    label: 'LocalAI (localhost:8080)',
    type: 'localai',
    endpoint: 'http://127.0.0.1:8080',
    timeoutMs: 3000,
  },
];

// ---------------------------------------------------------------------------
// Protocol detection
// ---------------------------------------------------------------------------

/**
 * Paths to probe for each provider type to verify the API.
 */
const PROBE_PATHS: Record<ProviderType, string> = {
  lmstudio: '/v1/models',
  ollama: '/api/tags',
  vllm: '/v1/models',
  localai: '/v1/models',
  newapi: '/v1/models',
  'openai-compatible': '/v1/models',
  manual: '/v1/models',
};

/**
 * Detect the protocol based on the provider type.
 */
function detectProtocol(type: ProviderType): ProviderProtocol | null {
  switch (type) {
    case 'lmstudio':
    case 'vllm':
    case 'localai':
    case 'newapi':
    case 'openai-compatible':
    case 'manual':
      return 'openai';
    case 'ollama':
      return 'custom';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Discovery engine
// ---------------------------------------------------------------------------

/**
 * Probe a single discovery target.
 *
 * Performs a GET request to the probe path and parses the response
 * to extract model count and protocol information.
 */
async function probeTarget(target: DiscoveryTarget): Promise<DiscoveryResult> {
  const t0 = performance.now();
  const probePath = PROBE_PATHS[target.type] || '/v1/models';
  const url = target.endpoint.replace(/\/+$/, '') + probePath;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), target.timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timer);

    const latencyMs = Math.round(performance.now() - t0);
    let modelCount = 0;

    if (response.ok) {
      try {
        const data = (await response.json()) as { data?: Array<{ id: string }>; models?: Array<{ name: string }> };
        // LM Studio / OpenAI format: { data: [{id: ...}] }
        // Ollama format: { models: [{name: ...}] }
        modelCount = (data.data || data.models || []).length;
      } catch {
        // Response is not JSON — still reachable but no model info
      }
    }

    return {
      target,
      reachable: true,
      statusCode: response.status,
      latencyMs,
      protocol: detectProtocol(target.type),
      modelCount,
      timestamp: Date.now(),
    };
  } catch (error) {
    clearTimeout(0); // No-op, just satisfying the linter
    const latencyMs = Math.round(performance.now() - t0);

    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Connection timed out after ' + target.timeoutMs + 'ms'
        : error instanceof Error
          ? error.message
          : String(error);

    return {
      target,
      reachable: false,
      statusCode: 0,
      latencyMs,
      protocol: null,
      modelCount: 0,
      error: message,
      timestamp: Date.now(),
    };
  }
}

// ---------------------------------------------------------------------------
// Discovery orchestration
// ---------------------------------------------------------------------------

/**
 * Discover all providers by probing configured targets.
 *
 * Probes run sequentially to avoid overwhelming local services.
 * Results are returned for ALL targets (reachable and unreachable).
 *
 * @param targets — Optional custom targets (defaults to built-in list).
 * @returns Array of discovery results, one per target.
 */
async function discoverProviders(targets: DiscoveryTarget[] = DEFAULT_TARGETS): Promise<DiscoveryResult[]> {
  console.log('[ProviderDiscovery] Probing ' + targets.length + ' targets...');

  const results: DiscoveryResult[] = [];

  /* eslint-disable no-await-in-loop */
  for (const target of targets) {
    const result = await probeTarget(target);

    if (result.reachable) {
      console.log(
        '[ProviderDiscovery] FOUND ' +
          target.label +
          ' (HTTP ' +
          result.statusCode +
          ', ' +
          result.latencyMs +
          'ms, ' +
          result.modelCount +
          ' models)'
      );
    } else {
      console.log('[ProviderDiscovery] ' + target.label + ': unreachable (' + result.error + ')');
    }

    results.push(result);
  }
  /* eslint-enable no-await-in-loop */

  const reachableCount = results.filter((r) => r.reachable).length;
  console.log('[ProviderDiscovery] Done. ' + reachableCount + '/' + results.length + ' targets reachable.');

  return results;
}

/**
 * Discover only reachable providers (filters out failed probes).
 */
async function discoverReachableProviders(targets?: DiscoveryTarget[]): Promise<DiscoveryResult[]> {
  const results = await discoverProviders(targets);
  return results.filter((r) => r.reachable);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { DEFAULT_TARGETS, PROBE_PATHS, probeTarget, discoverProviders, discoverReachableProviders, detectProtocol };
