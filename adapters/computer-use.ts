/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Adapter Layer — ComputerUseAdapter
 *
 * Defines the contract for all Computer Use backends.
 *
 * Jarvis must NEVER call OS-level desktop automation APIs directly.
 * All desktop interaction goes through this adapter contract.
 *
 * Backend implementations may include:
 *   - Codex Computer Use (bundled plugin)
 *   - MCP Computer Use server
 *   - Remote machine control
 *   - Local custom backend (existing computer-use plugin as fallback)
 *
 * This is a CONTRACT ONLY — no implementation, no behavior.
 */

import type { IAdapter, AdapterId, AdapterBackend, AdapterHealth, AdapterDiagnostics } from './types';
import type { PluginPermission } from '../plugin-marketplace/types';

// ---------------------------------------------------------------------------
// Display information
// ---------------------------------------------------------------------------

/** A single display/monitor. */
type DisplayInfo = {
  id: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
};

// ---------------------------------------------------------------------------
// Window information
// ---------------------------------------------------------------------------

/** A single window on the desktop. */
type WindowInfo = {
  id: string;
  title: string;
  application: string;
  bounds: { x: number; y: number; width: number; height: number };
  visible: boolean;
  minimized: boolean;
  isForeground: boolean;
};

// ---------------------------------------------------------------------------
// Cursor information
// ---------------------------------------------------------------------------

/** Current cursor state. */
type CursorInfo = {
  x: number;
  y: number;
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Screenshot
// ---------------------------------------------------------------------------

/** A captured screenshot. */
type Screenshot = {
  /** Absolute path to the image file, or base64-encoded data. */
  data: string;
  /** Whether data is a file path or base64. */
  encoding: 'path' | 'base64';
  width: number;
  height: number;
  format: 'png' | 'jpeg';
  timestamp: number;
  /** Display this screenshot was captured from (null = all displays). */
  displayId: string | null;
};

/** Options for screenshot capture. */
type ScreenshotOptions = {
  /** Capture a specific display (null = all displays). */
  displayId?: string | null;
  /** Capture a specific window by id. */
  windowId?: string | null;
  /** Image format. */
  format?: 'png' | 'jpeg';
  /** JPEG quality (1-100). */
  quality?: number;
};

// ---------------------------------------------------------------------------
// Desktop info
// ---------------------------------------------------------------------------

/** Aggregated desktop state. */
type DesktopInfo = {
  platform: string;
  displays: DisplayInfo[];
  windows: WindowInfo[];
  cursor: CursorInfo;
  timestamp: number;
};

// ---------------------------------------------------------------------------
// ComputerUseAdapter contract
// ---------------------------------------------------------------------------

/**
 * Contract for all Computer Use backends.
 *
 * Every backend must implement this interface exactly.
 * Jarvis calls these methods and never cares which backend
 * is actually providing the data.
 */
type IComputerUseAdapter = IAdapter & {
  // -----------------------------------------------------------------------
  // Override adapter identity
  // -----------------------------------------------------------------------

  readonly backend: AdapterBackend;

  // -----------------------------------------------------------------------
  // Desktop state queries
  // -----------------------------------------------------------------------

  /** Get aggregated desktop state. */
  getDesktopInfo(): Promise<DesktopInfo>;

  /** Enumerate all displays. */
  getDisplays(): Promise<DisplayInfo[]>;

  /** Enumerate all visible windows. */
  listWindows(): Promise<WindowInfo[]>;

  /** Get current cursor position. */
  getCursorPosition(): Promise<CursorInfo>;

  // -----------------------------------------------------------------------
  // Screenshot
  // -----------------------------------------------------------------------

  /** Capture a screenshot. */
  captureScreenshot(options?: ScreenshotOptions): Promise<Screenshot>;

  // -----------------------------------------------------------------------
  // Health & diagnostics
  // -----------------------------------------------------------------------

  health(): Promise<AdapterHealth>;
  diagnostics(): AdapterDiagnostics;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  DisplayInfo,
  WindowInfo,
  CursorInfo,
  Screenshot,
  ScreenshotOptions,
  DesktopInfo,
  IComputerUseAdapter,
};
