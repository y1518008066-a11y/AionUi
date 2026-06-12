/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Adapter Layer 鈥?BrowserAdapter
 *
 * Defines the contract for all Browser backends.
 *
 * Jarvis must NEVER depend directly on Playwright, Puppeteer,
 * or any specific browser automation library.
 * All browser interaction goes through this adapter contract.
 *
 * Backend implementations may include:
 *   - Codex Browser (bundled plugin)
 *   - MCP Browser server
 *   - Playwright backend (existing browser plugin as fallback)
 *   - Chrome DevTools Protocol backend
 *
 * This is a CONTRACT ONLY 鈥?no implementation, no behavior.
 */

import type { IAdapter, AdapterId, AdapterBackend, AdapterHealth, AdapterDiagnostics } from './types';
import type { PluginPermission } from '../plugin-marketplace/types';

// ---------------------------------------------------------------------------
// Browser types
// ---------------------------------------------------------------------------

/** A browser tab/page. */
type BrowserTab = {
  id: string;
  url: string;
  title: string;
  isActive: boolean;
};

/** Result of navigating to a URL. */
type NavigationResult = {
  url: string;
  title: string;
  statusCode: number;
  loadTimeMs: number;
};

/** Options for element finding. */
type FindOptions = {
  /** CSS selector, XPath, or text selector. */
  selector: string;
  /** Selector type. */
  type?: 'css' | 'xpath' | 'text';
  /** Timeout in milliseconds. */
  timeoutMs?: number;
};

/** An element reference returned by find. */
type ElementRef = {
  id: string;
  tagName: string;
  text: string;
  attributes: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
};

/** Options for clicking. */
type ClickOptions = {
  /** Element to click (from find result). */
  elementId?: string;
  /** Or click by selector. */
  selector?: string;
  /** Or click at coordinates. */
  x?: number;
  y?: number;
  /** Click type. */
  button?: 'left' | 'right' | 'middle';
};

/** Options for typing. */
type TypeOptions = {
  /** Element to type into (from find result). */
  elementId?: string;
  /** Or target by selector. */
  selector?: string;
  /** Text to type. */
  text: string;
  /** Clear the field before typing. */
  clearFirst?: boolean;
};

/** Options for scrolling. */
type ScrollOptions = {
  /** Scroll by pixels (positive = down, negative = up). */
  deltaY?: number;
  /** Or scroll to a specific element. */
  elementId?: string;
  /** Or scroll to coordinates. */
  x?: number;
  y?: number;
};

/** Cookie representation. */
type BrowserCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number | null;
  httpOnly: boolean;
  secure: boolean;
};

/** Options for launching the browser. */
type BrowserLaunchOptions = {
  /** Run headless. */
  headless?: boolean;
  /** Starting URL. */
  url?: string;
  /** Viewport width. */
  width?: number;
  /** Viewport height. */
  height?: number;
  /** Launch timeout in ms. */
  timeoutMs?: number;
};

// ---------------------------------------------------------------------------
// BrowserAdapter contract
// ---------------------------------------------------------------------------

/**
 * Contract for all Browser backends.
 *
 * Every backend must implement this interface exactly.
 * Jarvis calls these methods and never cares which backend
 * is actually driving the browser.
 */
type IBrowserAdapter = IAdapter & {
  // -----------------------------------------------------------------------
  // Override adapter identity
  // -----------------------------------------------------------------------

  readonly backend: AdapterBackend;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Launch / open the browser. */
  open(options?: BrowserLaunchOptions): Promise<void>;

  /** Close the browser. */
  close(): Promise<void>;

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  /** Navigate to a URL. */
  navigate(url: string, timeoutMs?: number): Promise<NavigationResult>;

  /** Go back. */
  back(): Promise<void>;

  /** Go forward. */
  forward(): Promise<void>;

  /** Reload the current page. */
  reload(): Promise<void>;

  // -----------------------------------------------------------------------
  // Page state
  // -----------------------------------------------------------------------

  /** Get the current URL. */
  currentUrl(): string;

  /** Get the current page title. */
  currentTitle(): string;

  /** Get the full page HTML. */
  getHtml(): Promise<string>;

  /** Get the page content as Markdown (best-effort conversion). */
  getMarkdown(): Promise<string>;

  /** Get visible text content. */
  getText(): Promise<string>;

  // -----------------------------------------------------------------------
  // Screenshot
  // -----------------------------------------------------------------------

  /** Take a screenshot of the current page or element. */
  screenshot(options?: {
    /** Capture a specific element. */
    elementId?: string;
    /** Capture the full page (not just viewport). */
    fullPage?: boolean;
    /** Image format. */
    format?: 'png' | 'jpeg';
  }): Promise<{
    data: string;
    encoding: 'path' | 'base64';
    width: number;
    height: number;
    timestamp: number;
  }>;

  // -----------------------------------------------------------------------
  // Interaction
  // -----------------------------------------------------------------------

  /** Find elements matching a selector. */
  find(options: FindOptions): Promise<ElementRef[]>;

  /** Click an element or coordinate. */
  click(options: ClickOptions): Promise<void>;

  /** Type text into an element. */
  type(options: TypeOptions): Promise<void>;

  /** Scroll the page. */
  scroll(options: ScrollOptions): Promise<void>;

  /** Wait for a condition. */
  wait(ms: number): Promise<void>;

  // -----------------------------------------------------------------------
  // JavaScript & cookies
  // -----------------------------------------------------------------------

  /** Evaluate JavaScript in the page context. */
  evaluate<T = unknown>(expression: string): Promise<T>;

  /** Get all cookies for the current page. */
  getCookies(): Promise<BrowserCookie[]>;

  /** Set a cookie. */
  setCookie(cookie: Partial<BrowserCookie> & { name: string; value: string }): Promise<void>;

  // -----------------------------------------------------------------------
  // Tab management
  // -----------------------------------------------------------------------

  /** List all open tabs. */
  listTabs(): Promise<BrowserTab[]>;

  /** Open a new tab. */
  newTab(url?: string): Promise<BrowserTab>;

  /** Close a tab by id. */
  closeTab(tabId: string): Promise<void>;

  /** Switch to a tab by id. */
  switchToTab(tabId: string): Promise<void>;

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
  BrowserTab,
  NavigationResult,
  FindOptions,
  ElementRef,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  BrowserCookie,
  BrowserLaunchOptions,
  IBrowserAdapter,
};
