/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tests for Provider Auto-Discovery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { probeTarget, discoverProviders, DEFAULT_TARGETS } from '../../../provider-manager/discovery';
import type { DiscoveryTarget } from '../../../provider-manager/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
    body: null,
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockFetchResponse(body, status),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    bytes: async () => new Uint8Array(),
  } as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Provider Discovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('probeTarget', () => {
    it('detects LM Studio as reachable', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ data: [{ id: 'model-a' }, { id: 'model-b' }] })
      );

      const target: DiscoveryTarget = {
        label: 'LM Studio',
        type: 'lmstudio',
        endpoint: 'http://127.0.0.1:1234',
        timeoutMs: 5000,
      };

      const result = await probeTarget(target);

      expect(result.reachable).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.protocol).toBe('openai');
      expect(result.modelCount).toBe(2);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('marks unreachable endpoints', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const target: DiscoveryTarget = {
        label: 'Offline',
        type: 'lmstudio',
        endpoint: 'http://127.0.0.1:9999',
        timeoutMs: 1000,
      };

      const result = await probeTarget(target);

      expect(result.reachable).toBe(false);
      expect(result.statusCode).toBe(0);
      expect(result.error).toContain('Connection refused');
    });

    it('handles timeout correctly', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
        return new Promise((_resolve, reject) => {
          const error = new DOMException('Aborted', 'AbortError');
          reject(error);
        });
      });

      const target: DiscoveryTarget = {
        label: 'Timeout',
        type: 'lmstudio',
        endpoint: 'http://127.0.0.1:1234',
        timeoutMs: 100,
      };

      const result = await probeTarget(target);

      expect(result.reachable).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('handles non-JSON response gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => 'not json',
        body: null,
        headers: new Headers(),
        redirected: false,
        type: 'basic' as ResponseType,
        url: '',
        clone: () => ({} as Response),
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        formData: async () => new FormData(),
        bytes: async () => new Uint8Array(),
      } as Response);

      const target: DiscoveryTarget = {
        label: 'Bad JSON',
        type: 'lmstudio',
        endpoint: 'http://127.0.0.1:1234',
        timeoutMs: 5000,
      };

      const result = await probeTarget(target);

      expect(result.reachable).toBe(true);
      expect(result.modelCount).toBe(0);
    });

    it('detects Ollama protocol as custom', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ models: [{ name: 'llama3' }] })
      );

      const target: DiscoveryTarget = {
        label: 'Ollama',
        type: 'ollama',
        endpoint: 'http://127.0.0.1:11434',
        timeoutMs: 5000,
      };

      const result = await probeTarget(target);

      expect(result.reachable).toBe(true);
      expect(result.protocol).toBe('custom');
    });
  });

  describe('discoverProviders', () => {
    it('probes all configured targets', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({ data: [] })
      );

      const results = await discoverProviders(DEFAULT_TARGETS.slice(0, 3));

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.reachable).toBe(true);
      }
    });

    it('mixes reachable and unreachable results', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ data: [] }));
      fetchSpy.mockRejectedValueOnce(new Error('offline'));
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ data: [{ id: 'x' }] }));

      const targets = DEFAULT_TARGETS.slice(0, 3);
      const results = await discoverProviders(targets);

      expect(results[0].reachable).toBe(true);
      expect(results[1].reachable).toBe(false);
      expect(results[2].reachable).toBe(true);
    });
  });
});