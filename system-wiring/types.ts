/**
 * System Wiring Layer — Type Definitions
 *
 * Defines the system graph model for diagnostics and the initialization
 * status type. All types are structural only.
 */

import type { IJarvisCore } from '../jarvis-core/interfaces';
import type { AIRouter } from '../ai-router/router';
import type { ExecutionBridge } from '../execution-bridge/bridge';
import type { PluginManager } from '../plugins-core/manager';
import type { ActionEngine } from '../action-engine/engine';
import type { ProviderManager } from '../provider-manager/manager';
import type { ProviderCenter } from '../provider-center/center';
import type { ModeManager } from '../mode-system/manager';
import type { BackendManager } from '../adapters/backend-manager';

// ---------------------------------------------------------------------------
// System graph
// ---------------------------------------------------------------------------

type SystemNode = {
  id: string;
  label: string;
  module: string;
  active: boolean;
  status: 'inactive' | 'initializing' | 'active' | 'error';
  metadata: Record<string, unknown>;
};

type SystemEdge = {
  from: string;
  to: string;
  label: string;
  active: boolean;
};

type SystemGraph = {
  nodes: SystemNode[];
  edges: SystemEdge[];
};

// ---------------------------------------------------------------------------
// Wired systems
// ---------------------------------------------------------------------------

type WiredSystems = {
  jarvisCore: IJarvisCore;
  aiRouter: AIRouter;
  executionBridge: ExecutionBridge;
  pluginManager: PluginManager;
  graph: SystemGraph;
  // Extended subsystems
  actionEngine?: ActionEngine;
  providerManager?: ProviderManager;
  providerCenter?: ProviderCenter;
  modeManager?: ModeManager;
  backendManager?: BackendManager;
  stages?: InitStage[];
};

// ---------------------------------------------------------------------------
// Initialization status
// ---------------------------------------------------------------------------

type InitStatus = {
  complete: boolean;
  elapsedMs: number;
  stages: InitStage[];
};

type InitStage = {
  name: string;
  success: boolean;
  durationMs: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { SystemNode, SystemEdge, SystemGraph, WiredSystems, InitStatus, InitStage };
