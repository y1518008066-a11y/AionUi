/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tests for LMStudioProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LMStudioProvider, createLMStudioProvider } from '../../../providers/lmstudio';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    text: async () => JSON.stringify(body),
    body: null,
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(body, status, statusText),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    bytes: async () => new Uint8Array(),
  } as Response;
}

function mockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  const readable = new ReadableStream({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(encoder.encode(chunks[chunkIndex]));
        chunkIndex++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: readable,
    json: async () => ({}),
    text: async () => chunks.join(''),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockStreamResponse(chunks),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    bytes: async () => new Uint8Array(),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LMStudioProvider', () => {
  let provider: LMStudioProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    provider = createLMStudioProvider({
      id: 'lmstudio-test',
      name: 'LM Studio Test',
      baseUrl: 'http://127.0.0.1:1234',
      timeoutMs: 5000,
      maxRetries: 1,
    });
  });

  describe('configuration', () => {
    it('uses the provided id and name', () => {
      expect(provider.id).toBe('lmstudio-test');
      expect(provider.name).toBe('LM Studio Test');
    });

    it('uses the provided base URL', () => {
      expect(provider.baseUrl).toBe('http://127.0.0.1:1234');
    });

    it('defaults to http://127.0.0.1:1234 when no config given', () => {
      const p = createLMStudioProvider();
      expect(p.baseUrl).toBe('http://127.0.0.1:1234');
    });

    it('reports correct capabilities', () => {
      expect(provider.capabilities.chat).toBe(true);
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.toolUse).toBe(true);
      expect(provider.capabilities.imageGeneration).toBe(false);
      expect(provider.capabilities.tts).toBe(false);
      expect(provider.capabilities.stt).toBe(false);
    });

    it('is enabled by default', () => {
      expect(provider.enabled).toBe(true);
    });

    it('uses the openai protocol', () => {
      expect(provider.protocol).toBe('openai');
    });
  });

  describe('validate', () => {
    it('returns true when LM Studio responds with models', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse({
          data: [
            { id: 'llama-3-8b', object: 'model' },
            { id: 'mistral-7b', object: 'model' },
          ],
        })
      );

      const result = await provider.validate();
      expect(result).toBe(true);

      const health = provider.getHealth();
      expect(health.connected).toBe(true);
      expect(health.modelCount).toBe(2);
    });

    it('returns false when the server returns an error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse({ error: 'not found' }, 500, 'Internal Server Error')
      );

      const result = await provider.validate();
      expect(result).toBe(false);

      const health = provider.getHealth();
      expect(health.connected).toBe(false);
      expect(health.error).toContain('500');
    });

    it('returns false when the server is unreachable', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const result = await provider.validate();
      expect(result).toBe(false);

      const health = provider.getHealth();
      expect(health.connected).toBe(false);
      expect(health.error).toBe('Connection refused');
    });

    it('handles timeout gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
        return new Promise((_resolve, reject) => {
          const error = new DOMException('The operation was aborted', 'AbortError');
          reject(error);
        });
      });

      const result = await provider.validate();
      expect(result).toBe(false);

      const health = provider.getHealth();
      expect(health.error).toContain('The operation was aborted');
    });
  });

  describe('listModels', () => {
    it('returns cached models after validate', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse({
          data: [{ id: 'model-a' }, { id: 'model-b' }],
        })
      );

      await provider.validate();
      const models = await provider.listModels();

      expect(models).toEqual(['model-a', 'model-b']);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('fetches models if cache is empty', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse({
          data: [{ id: 'fresh-model' }],
        })
      );

      const models = await provider.listModels();
      expect(models).toEqual(['fresh-model']);
    });
  });

  describe('chatCompletion', () => {
    it('sends a valid chat completion request', async () => {
      // Pre-populate model cache
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse({ data: [{ id: 'llama-3' }] })
      );
      await provider.validate();
      vi.restoreAllMocks();

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          mockResponse({ choices: [{ message: { content: 'Hello!' } }] })
        );

      await provider.chatCompletion({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama-3',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/v1/chat/completions');

      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('llama-3');
      expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
      expect(body.stream).toBe(false);
    });

    it('uses the first cached model if none specified', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse({ data: [{ id: 'default-model' }] })
      );
      await provider.validate();
      vi.restoreAllMocks();

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockResponse({ choices: [] }));

      await provider.chatCompletion({
        messages: [{ role: 'user', content: 'Test' }],
      });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.model).toBe('default-model');
    });
  });

  describe('streamChatCompletion', () => {
    it('yields content chunks from an SSE stream', async () => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockStreamResponse(sseChunks)
      );

      const chunks: Array<{ content: string; done: boolean }> = [];
      for await (const chunk of provider.streamChatCompletion({
        messages: [{ role: 'user', content: 'Say hello' }],
        model: 'test-model',
      })) {
        chunks.push({ content: chunk.content, done: chunk.done });
      }

      const fullContent = chunks.map((c) => c.content).join('');
      expect(fullContent).toBe('Hello world!');
      expect(chunks[chunks.length - 1].done).toBe(true);
    });
  });

  describe('retry on transient errors', () => {
    it('retries on 5xx errors', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(mockResponse({}, 503));
      fetchSpy.mockResolvedValueOnce(mockResponse({ choices: [] }));

      await provider.chatCompletion({
        messages: [{ role: 'user', content: 'Retry test' }],
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 4xx errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse({ error: 'bad request' }, 400)
      );

      const response = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'Bad' }],
      });
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});