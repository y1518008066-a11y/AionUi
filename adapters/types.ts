/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Adapter Layer — Core Types
 *
 * Defines the shared types used across all adapter contracts.
 * Adapters abstract mature external implementations (Codex, MCP, Playwright, etc.)
 * so Jarvis never depends directly on any single backend.
 */

import type { PluginPermission } from '../plugin-marketplace/types';

// ---------------------------------------------------------------------------
// Adapter identity
// ---------------------------------------------------------------------------

/** Unique adapter id. */
type AdapterId = string;

/** Backend implementation of an adapter. */
type AdapterBackend =
  | 'codex'
  | 'mcp'
  | 'playwright'
  | 'local'
  | 'remote'
  | 'custom';

/** Status of an adapter at runtime. */
type AdapterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ---------------------------------------------------------------------------
// Common adapter interface
// ---------------------------------------------------------------------------

/**
 * Base interface all adapters must implement.
 *
 * Adapters are stateless contracts — they define what capabilities
 * the backend provides. The actual backend selection happens at
 * configuration time, not at the adapter level.
 */
type IAdapter = {
  /** Unique adapter id. */
  readonly id: AdapterId;

  /** Human-readable name. */
  readonly name: string;

  /** Which backend this adapter wraps. */
  readonly backend: AdapterBackend;

  /** Current connection status. */
  readonly status: AdapterStatus;

  /** Permissions this adapter requires. */
  readonly requiredPermissions: PluginPermission[];

  /** Connect to the backend. */
  connect(): Promise<void>;

  /** Disconnect from the backend. */
  disconnect(): Promise<void>;

  /** Health check. */
  health(): Promise<AdapterHealth>;

  /** Diagnostics snapshot. */
  diagnostics(): AdapterDiagnostics;
};

// ---------------------------------------------------------------------------
// Health & diagnostics
// ---------------------------------------------------------------------------

/** Health check result for an adapter. */
type AdapterHealth = {
  available: boolean;
  status: AdapterStatus;
  latencyMs: number;
  lastError: string | null;
  lastCheckedAt: number;
};

/** Adapter diagnostics snapshot. */
type AdapterDiagnostics = {
  id: AdapterId;
  backend: AdapterBackend;
  status: AdapterStatus;
  connected: boolean;
  uptimeMs: number;
  lastAction: string | null;
  lastActionAt: number | null;
  totalActions: number;
  errors: number;
  avgLatencyMs: number;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  AdapterId,
  AdapterBackend,
  AdapterStatus,
  IAdapter,
  AdapterHealth,
  AdapterDiagnostics,
};
