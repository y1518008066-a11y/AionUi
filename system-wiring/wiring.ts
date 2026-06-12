/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * System Wiring Layer — Wiring
 *
 * Connects the four Jarvis subsystems:
 * - AI Router → Execution Bridge (response events → execution)
 * - Plugin System → Execution Hooks (before/after hooks)
 * - Execution Bridge → JarvisCore EventBus (execution events)
 *
 * All connections are EVENT-BASED only — no direct method coupling.
 * The wiring is additive; no existing module is modified.
 */

import type { IJarvisCore, IEventBus } from '../jarvis-core/interfaces';
import type { AIRouter } from '../ai-router/router';
import type { ExecutionBridge } from '../execution-bridge/bridge';
import type { PluginManager } from '../plugins-core/manager';
import type { SystemGraph, SystemNode, SystemEdge } from './types';

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

function buildSystemGraph(
  jarvisCore: IJarvisCore,
  aiRouter: AIRouter | null,
  executionBridge: ExecutionBridge | null,
  pluginManager: PluginManager | null
): SystemGraph {
  const nodes: SystemNode[] = [
    {
      id: 'jarvis-core',
      label: 'Jarvis Control Layer',
      module: 'jarvis-core',
      active: jarvisCore.initialized,
      status: jarvisCore.initialized ? 'active' : 'inactive',
      metadata: {
        providerCount: jarvisCore.listProviders().length,
        pluginCount: jarvisCore.listPlugins().length,
        modeCount: jarvisCore.listModes().length,
        subscriberCount: jarvisCore.events.subscriberCount,
      },
    },
    {
      id: 'ai-router',
      label: 'AI Router',
      module: 'ai-router',
      active: aiRouter !== null,
      status: aiRouter ? 'active' : 'inactive',
      metadata: aiRouter ? { providerCount: aiRouter.providerCount, ...aiRouter.getDiagnostics() } : {},
    },
    {
      id: 'execution-bridge',
      label: 'Execution Bridge',
      module: 'execution-bridge',
      active: executionBridge !== null,
      status: executionBridge ? 'active' : 'inactive',
      metadata: executionBridge ? executionBridge.getDiagnostics() : {},
    },
    {
      id: 'plugins-core',
      label: 'Plugin System',
      module: 'plugins-core',
      active: pluginManager !== null,
      status: pluginManager ? 'active' : 'inactive',
      metadata: pluginManager ? pluginManager.getDiagnostics() : {},
    },
  ];

  const edges: SystemEdge[] = [
    {
      from: 'jarvis-core',
      to: 'ai-router',
      label: 'provides IEventBus + IProvider registry',
      active: aiRouter !== null && jarvisCore.initialized,
    },
    {
      from: 'jarvis-core',
      to: 'execution-bridge',
      label: 'provides IEventBus for execution events',
      active: executionBridge !== null && jarvisCore.initialized,
    },
    {
      from: 'jarvis-core',
      to: 'plugins-core',
      label: 'provides IEventBus for plugin events',
      active: pluginManager !== null && jarvisCore.initialized,
    },
    {
      from: 'ai-router',
      to: 'execution-bridge',
      label: 'router:response → execution pipeline',
      active: aiRouter !== null && executionBridge !== null && executionBridge.isBound,
    },
    {
      from: 'plugins-core',
      to: 'execution-bridge',
      label: 'before/after hooks → execution pipeline',
      active: pluginManager !== null && executionBridge !== null,
    },
    {
      from: 'execution-bridge',
      to: 'jarvis-core',
      label: 'execution:* events → EventBus',
      active: executionBridge !== null && jarvisCore.initialized,
    },
  ];

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

/**
 * Wire AI Router response events to the Execution Bridge.
 *
 * Listens for 'router:response' events on the JarvisCore EventBus and
 * logs that they could be routed to the execution bridge. In future,
 * this will automatically parse actions from responses and execute them.
 *
 * @returns An unsubscribe function.
 */
function wireRouterToBridge(eventBus: IEventBus, _executionBridge: ExecutionBridge): () => void {
  console.log('[SystemWiring] Wiring AI Router → Execution Bridge (event listener).');

  const unsubscribe = eventBus.on('router:response', (event) => {
    // Structural: log the connection — no real execution yet.
    console.log(
      '[SystemWiring] Router response received — would route to execution bridge.' +
        ' (provider: ' +
        event.providerId +
        ', latency: ' +
        event.latencyMs +
        'ms)'
    );
  });

  return unsubscribe;
}

/**
 * Wire Plugin Manager hooks to the Execution Bridge.
 *
 * In future, the execution bridge will call runBeforeHooks and
 * runAfterHooks on the plugin manager before/after each action.
 * Currently, this just confirms the wiring is in place.
 *
 * @returns An unsubscribe function.
 */
function wirePluginsToExecution(
  eventBus: IEventBus,
  pluginManager: PluginManager,
  _executionBridge: ExecutionBridge
): () => void {
  console.log('[SystemWiring] Wiring Plugin System → Execution Bridge (hook integration).');

  // Listen for execution stage events to inform plugin hooks
  const unsubscribe = eventBus.on('execution:stage', (event) => {
    console.log(
      '[SystemWiring] Execution stage "' +
        event.stage +
        '" — plugin hooks would run here.' +
        ' (execution: ' +
        event.executionId +
        ')'
    );
  });

  void pluginManager;

  return unsubscribe;
}

/**
 * Wire Execution Bridge events back to JarvisCore.
 *
 * The execution bridge already emits events via the shared EventBus,
 * so this connection is implicitly wired. This function documents
 * the event flow for diagnostics.
 */
function wireExecutionToCore(eventBus: IEventBus): void {
  console.log('[SystemWiring] Wiring Execution Bridge → JarvisCore EventBus (implicit).');

  // Document the event flow — execution bridge events are already
  // emitted on the shared EventBus, so no additional wiring needed.
  const executionEvents = [
    'execution:start',
    'execution:stage',
    'execution:complete',
    'execution:error',
    'execution:cancelled',
  ];

  for (const eventType of executionEvents) {
    eventBus.on(eventType as 'execution:start', (_event) => {
      // Events are already flowing — this is just for observability.
    });
  }

  console.log('[SystemWiring] Execution events monitored: ' + executionEvents.join(', '));
}

// ---------------------------------------------------------------------------
// Main wiring function
// ---------------------------------------------------------------------------

/**
 * Wire all four subsystems together.
 *
 * @returns A cleanup function that unwires all connections.
 */
function wireAll(
  jarvisCore: IJarvisCore,
  aiRouter: AIRouter,
  executionBridge: ExecutionBridge,
  pluginManager: PluginManager
): () => void {
  console.log('[SystemWiring] Wiring all subsystems...');

  const unsubscribers: (() => void)[] = [];

  // 1. Bind AI Router to Execution Bridge
  executionBridge.bindRouter(aiRouter);
  unsubscribers.push(wireRouterToBridge(jarvisCore.events, executionBridge));

  // 2. Wire Plugin hooks to Execution pipeline
  unsubscribers.push(wirePluginsToExecution(jarvisCore.events, pluginManager, executionBridge));

  // 3. Wire Execution events to Core EventBus (implicit — document only)
  wireExecutionToCore(jarvisCore.events);

  console.log('[SystemWiring] All subsystems wired.');

  return () => {
    console.log('[SystemWiring] Unwiring all subsystems...');
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
    console.log('[SystemWiring] All subsystems unwired.');
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { buildSystemGraph, wireAll, wireRouterToBridge, wirePluginsToExecution, wireExecutionToCore };
