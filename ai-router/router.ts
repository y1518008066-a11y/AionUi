/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AI Router Layer 鈥?AIRouter
 *
 * Unified entry point for all AI requests. Routes calls to registered
 * providers using a pluggable strategy. Emits events via the Jarvis
 * EventBus for observability.
 *
 * Currently this is STRUCTURAL ONLY 鈥?no real AI calls are executed.
 * The sendMessage and streamMessage methods log intent and return
 * placeholder responses.
 */

import type { IEventBus, IJarvisCore, IProvider } from '../jarvis-core/interfaces';
import type { RouterRequest, RouterResponse, StreamChunk, RoutingContext, RoutingDecision } from './types';
import type { IRoutingStrategy } from './strategy';
import { createStrategy } from './strategy';

// ---------------------------------------------------------------------------
// AIRouter
// ---------------------------------------------------------------------------

class AIRouter {
  private readonly providers = new Map<string, IProvider>();
  private readonly eventBus: IEventBus;
  private readonly jarvisCore: IJarvisCore;

  private activeProviderId: string | null = null;
  private strategy: IRoutingStrategy;

  private requestCounter = 0;

  constructor(jarvisCore: IJarvisCore, strategyName?: string) {
    this.jarvisCore = jarvisCore;
    this.eventBus = jarvisCore.events;
    this.strategy = createStrategy((strategyName as 'first-available') || 'first-available');

    // Listen for provider changes from the Jarvis core and keep local
    // provider map in sync.
    this.eventBus.on('provider:added', (event) => {
      const provider = this.jarvisCore.getProvider(event.providerId);
      if (provider) {
        this.providers.set(provider.id, provider);
      }
    });

    this.eventBus.on('provider:removed', (event) => {
      this.providers.delete(event.providerId);
      if (this.activeProviderId === event.providerId) {
        this.activeProviderId = null;
      }
    });

    this.eventBus.on('provider:enabled', (event) => {
      const provider = this.providers.get(event.providerId);
      if (provider) {
        this.providers.set(event.providerId, { ...provider, enabled: true });
      }
    });

    this.eventBus.on('provider:disabled', (event) => {
      const provider = this.providers.get(event.providerId);
      if (provider) {
        this.providers.set(event.providerId, { ...provider, enabled: false });
      }
    });

    console.log('[AIRouter] Initialized.');
  }

  // -----------------------------------------------------------------------
  // Provider management
  // -----------------------------------------------------------------------

  async registerProvider(provider: IProvider): Promise<void> {
    this.providers.set(provider.id, provider);

    try {
      await this.jarvisCore.registerProvider(provider);
    } catch {
      // Core may have it already 鈥?non-fatal.
    }

    console.log('[AIRouter] Provider registered: ' + provider.name + ' (' + provider.id + ')');
  }

  setActiveProvider(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      console.warn('[AIRouter] Cannot activate unknown provider: ' + providerId);
      return;
    }

    const previousId = this.activeProviderId;
    this.activeProviderId = providerId;

    if (previousId) {
      this.eventBus.emit({ type: 'router:provider:deactivated', providerId: previousId });
    }
    this.eventBus.emit({ type: 'router:provider:activated', providerId });
  }

  getActiveProvider(): IProvider | null {
    if (!this.activeProviderId) return null;
    return this.providers.get(this.activeProviderId) || null;
  }

  setStrategy(name: string): void {
    this.strategy = createStrategy(name as 'first-available');
    console.log('[AIRouter] Strategy switched to: ' + this.strategy.name);
  }

  getStrategyName(): string {
    return this.strategy.name;
  }

  // -----------------------------------------------------------------------
  // Routing
  // -----------------------------------------------------------------------

  private resolveProvider(request: RouterRequest): RoutingDecision | null {
    // Check for dual routing mode
    if (request.model === "__dual__" || request.metadata?.routing === "dual") {
      this.setStrategy("dual");
    } else {
      this.setStrategy("first-available");
    }
    const context: RoutingContext = {
      request,
      providers: [...this.providers.values()],
      activeProviderId: this.activeProviderId,
      activeModeId: this.jarvisCore.activeModeId,
      modeOverrides: {},
    };

    const decision = this.strategy.select(context);
    if (decision) {
      return decision;
    }

    const active = this.getActiveProvider();
    if (active && active.enabled) {
      return {
        provider: active,
        model: request.model || 'default',
        reason: 'Falling back to active provider',
      };
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Message sending (routing decisions + events)
  // -----------------------------------------------------------------------

  async sendMessage(request: RouterRequest): Promise<RouterResponse> {
    const requestId = 'req-' + String(++this.requestCounter);
    const t0 = performance.now();

    const decision = this.resolveProvider(request);

    if (!decision) {
      const error = 'No available provider to handle the request.';
      this.eventBus.emit({
        type: 'router:error',
        requestId,
        providerId: 'none',
        error,
      });
      throw new Error('[AIRouter] ' + error);
    }

    this.eventBus.emit({
      type: 'router:request',
      requestId,
      providerId: decision.provider.id,
      model: decision.model,
      messageCount: request.messages.length,
    });

    console.log(
      '[AIRouter] sendMessage -> ' +
        decision.provider.name +
        ' / ' +
        decision.model +
        ' (reason: ' +
        decision.reason +
        ') [' +
        request.messages.length +
        ' messages]'
    );

    const latencyMs = Math.round(performance.now() - t0);

    const response: RouterResponse = {
      id: requestId,
      providerId: decision.provider.id,
      model: decision.model,
      content:
        '[Routed via ' + decision.provider.name + '] Use AgentRuntime.run() for actual execution.',
      toolCalls: undefined,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: 'stop',
      timestamp: Date.now(),
      latencyMs,
    };

    this.eventBus.emit({
      type: 'router:response',
      requestId,
      providerId: decision.provider.id,
      model: decision.model,
      latencyMs,
      contentLength: response.content.length,
    });

    return response;
  }

  async *streamMessage(request: RouterRequest): AsyncGenerator<StreamChunk> {
    const requestId = 'req-' + String(++this.requestCounter);
    const t0 = performance.now();

    const decision = this.resolveProvider(request);

    if (!decision) {
      const error = 'No available provider to handle the request.';
      this.eventBus.emit({
        type: 'router:error',
        requestId,
        providerId: 'none',
        error,
      });
      throw new Error('[AIRouter] ' + error);
    }

    this.eventBus.emit({
      type: 'router:request',
      requestId,
      providerId: decision.provider.id,
      model: decision.model,
      messageCount: request.messages.length,
    });

    console.log(
      '[AIRouter] streamMessage -> ' +
        decision.provider.name +
        ' / ' +
        decision.model +
        ' (reason: ' +
        decision.reason +
        ')'
    );

    const placeholderText =
      '[Routed via ' + decision.provider.name + '] Use AgentRuntime for streaming execution.';

    yield {
      content: placeholderText,
      done: false,
    };

    const latencyMs = Math.round(performance.now() - t0);

    yield {
      content: '',
      done: true,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: 'stop',
    };

    this.eventBus.emit({
      type: 'router:response',
      requestId,
      providerId: decision.provider.id,
      model: decision.model,
      latencyMs,
      contentLength: placeholderText.length,
    });
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  get providerCount(): number {
    return this.providers.size;
  }

  getDiagnostics(): Record<string, unknown> {
    return {
      providerCount: this.providers.size,
      activeProviderId: this.activeProviderId,
      strategy: this.strategy.name,
      requestCount: this.requestCounter,
      providers: [...this.providers.keys()],
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { AIRouter };
