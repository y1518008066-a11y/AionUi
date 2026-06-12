/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Providers — LM Studio
 *
 * Real LM Studio provider implementation.
 *
 * Communicates with a local LM Studio server via its OpenAI-compatible
 * API (default: http://127.0.0.1:1234/v1).
 *
 * Capabilities:
 * - Health check (GET /v1/models)
 * - Model listing (GET /v1/models)
 * - Chat completions (POST /v1/chat/completions)
 * - Streaming (POST /v1/chat/completions with stream: true)
 * - Connection timeout handling
 * - Retry on transient errors
 */

import type { IProvider, ProviderProtocol, ProviderCapabilities } from '../jarvis-core/interfaces';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for an LM Studio provider instance. */
type LMStudioConfig = {
  /** Unique provider id. */
  id: string;

  /** Display name. */
  name: string;

  /** Base URL (default: http://127.0.0.1:1234). */
  baseUrl: string;

  /** Request timeout in milliseconds (default: 10000). */
  timeoutMs: number;

  /** Maximum retries on transient errors (default: 2). */
  maxRetries: number;
};

/** Raw model object from LM Studio's /v1/models response. */
type LMStudioModel = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

/** Internal health status. */
type HealthStatus = {
  connected: boolean;
  latencyMs: number;
  modelCount: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Omit<LMStudioConfig, 'id' | 'name'> = {
  baseUrl: 'http://127.0.0.1:1234',
  timeoutMs: 10000,
  maxRetries: 2,
};

const LMSTUDIO_CAPABILITIES: ProviderCapabilities = {
  chat: true,
  imageGeneration: false,
  tts: false,
  stt: false,
  toolUse: true,
  streaming: true,
};

// ---------------------------------------------------------------------------
// LM Studio Provider
// ---------------------------------------------------------------------------

class LMStudioProvider implements IProvider {
  readonly id: string;
  readonly name: string;
  readonly protocol: ProviderProtocol = 'openai';
  readonly capabilities: ProviderCapabilities;
  readonly baseUrl: string;

  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private _enabled = true;
  private _health: HealthStatus = { connected: false, latencyMs: 0, modelCount: 0 };
  private cachedModels: string[] = [];

  constructor(config: LMStudioConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs;
    this.maxRetries = config.maxRetries;
    this.capabilities = { ...LMSTUDIO_CAPABILITIES };
  }

  get enabled(): boolean {
    return this._enabled;
  }

  // -----------------------------------------------------------------------
  // Health & validation
  // -----------------------------------------------------------------------

  /**
   * Test connectivity to the LM Studio server.
   *
   * Performs a GET /v1/models request with timeout. On success,
   * updates the internal health status and cached model list.
   */
  async validate(): Promise<boolean> {
    const t0 = performance.now();

    try {
      const response = await this.fetchWithTimeout(this.baseUrl + '/v1/models', { method: 'GET' }, this.timeoutMs);

      if (!response.ok) {
        this._health = {
          connected: false,
          latencyMs: Math.round(performance.now() - t0),
          modelCount: 0,
          error: 'HTTP ' + response.status + ': ' + response.statusText,
        };
        return false;
      }

      const data = (await response.json()) as { data?: LMStudioModel[] };
      const models = (data.data || []).map((m) => m.id);

      this.cachedModels = models;
      this._health = {
        connected: true,
        latencyMs: Math.round(performance.now() - t0),
        modelCount: models.length,
      };

      console.log(
        '[LMStudio] Connected. ' + models.length + ' models available. Latency: ' + this._health.latencyMs + 'ms.'
      );

      return true;
    } catch (error) {
      this._health = {
        connected: false,
        latencyMs: Math.round(performance.now() - t0),
        modelCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };

      console.warn('[LMStudio] Connection failed: ' + this._health.error);
      return false;
    }
  }

  /**
   * Get the current health status.
   */
  getHealth(): HealthStatus {
    return { ...this._health };
  }

  // -----------------------------------------------------------------------
  // Model listing
  // -----------------------------------------------------------------------

  /**
   * List available models from LM Studio.
   *
   * Returns cached models if available; otherwise fetches from the server.
   */
  async listModels(): Promise<string[]> {
    if (this.cachedModels.length > 0) {
      return [...this.cachedModels];
    }

    await this.validate();
    return [...this.cachedModels];
  }

  // -----------------------------------------------------------------------
  // Chat completion
  // -----------------------------------------------------------------------

  /**
   * Send a chat completion request to LM Studio.
   *
   * Uses the OpenAI-compatible POST /v1/chat/completions endpoint.
   * Supports streaming via the stream: true parameter.
   */
  async chatCompletion(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
  }): Promise<Response> {
    const model = params.model || this.cachedModels[0] || 'local-model';

    const body: Record<string, unknown> = {
      model,
      messages: params.messages,
      max_tokens: params.maxTokens || 2048,
      temperature: params.temperature ?? 0.7,
      stream: params.stream || false,
    };

    return this.fetchWithRetry(
      this.baseUrl + '/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      this.timeoutMs,
      this.maxRetries
    );
  }

  // -----------------------------------------------------------------------
  // Streaming helpers
  // -----------------------------------------------------------------------

  /**
   * Parse an SSE (Server-Sent Events) stream from LM Studio.
   *
   * Yields parsed delta chunks. LM Studio uses standard OpenAI
   * streaming format: data: {"choices":[{"delta":{"content":"..."}}]}
   */
  async *streamChatCompletion(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }): AsyncGenerator<{ content: string; done: boolean; finishReason?: string }> {
    const response = await this.chatCompletion({ ...params, stream: true });

    if (!response.ok || !response.body) {
      throw new Error('[LMStudio] Streaming request failed: HTTP ' + response.status + ' ' + response.statusText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed || trimmed === 'data: [DONE]') {
            continue;
          }

          if (!trimmed.startsWith('data: ')) {
            continue;
          }

          try {
            const json = JSON.parse(trimmed.slice(6));
            const choice = json.choices?.[0];

            if (!choice) continue;

            const content = choice.delta?.content || '';
            const finishReason = choice.finish_reason || undefined;

            yield {
              content,
              done: !!finishReason,
              finishReason,
            };
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Fetch with a configurable timeout.
   */
  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch with retry on transient errors.
   *
   * Retries on network errors, timeouts, and 5xx responses.
   * Does NOT retry on 4xx errors.
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    maxRetries: number
  ): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options, timeoutMs);

        // Retry on server errors
        if (response.status >= 500 && attempt < maxRetries) {
          console.warn(
            '[LMStudio] Server error ' + response.status + ', retrying (' + (attempt + 1) + '/' + maxRetries + ')...'
          );
          await this.delay(500 * (attempt + 1));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;

        if (error instanceof DOMException && error.name === 'AbortError') {
          const msg = 'Request timed out after ' + timeoutMs + 'ms';
          if (attempt < maxRetries) {
            console.warn('[LMStudio] ' + msg + ', retrying (' + (attempt + 1) + '/' + maxRetries + ')...');
            await this.delay(500 * (attempt + 1));
            continue;
          }
          throw new Error(msg);
        }

        if (attempt < maxRetries) {
          console.warn('[LMStudio] Network error, retrying (' + (attempt + 1) + '/' + maxRetries + '):', error);
          await this.delay(500 * (attempt + 1));
          continue;
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error('[LMStudio] Request failed after ' + maxRetries + ' retries.');
  }

  /**
   * Promise-based delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an LM Studio provider instance with default configuration.
 */
function createLMStudioProvider(options: Partial<LMStudioConfig> = {}): LMStudioProvider {
  return new LMStudioProvider({
    id: options.id || 'lmstudio',
    name: options.name || 'LM Studio',
    baseUrl: options.baseUrl || DEFAULT_CONFIG.baseUrl,
    timeoutMs: options.timeoutMs || DEFAULT_CONFIG.timeoutMs,
    maxRetries: options.maxRetries || DEFAULT_CONFIG.maxRetries,
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { LMStudioProvider, createLMStudioProvider };
export type { LMStudioConfig, LMStudioModel, HealthStatus };
