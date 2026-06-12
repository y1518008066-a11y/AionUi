/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Playwright Backend — Browser Adapter Implementation
 *
 * Implements IBrowserAdapter using Playwright + Chromium.
 * This is the local fallback backend when Codex or MCP is unavailable.
 *
 * Maintains backwards compatibility with the existing Browser Plugin
 * by extracting the core Playwright logic into a clean adapter.
 */

import type {
  IBrowserAdapter,
  BrowserTab,
  NavigationResult,
  FindOptions,
  ElementRef,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  BrowserCookie,
  BrowserLaunchOptions,
} from './browser';
import type { IAdapter, AdapterId, AdapterBackend, AdapterHealth, AdapterDiagnostics } from './types';
import type { PluginPermission } from '../plugin-marketplace/types';

// Dynamic Playwright import (only loaded when this backend is used)
let chromium: typeof import('playwright').chromium | null = null;

async function getChromium() {
  if (!chromium) {
    const pw = await import('playwright');
    chromium = pw.chromium;
  }
  return chromium;
}

// ---------------------------------------------------------------------------
// Playwright Backend
// ---------------------------------------------------------------------------

class PlaywrightBrowserBackend implements IBrowserAdapter {
  readonly id: AdapterId = 'playwright-browser';
  readonly name = 'Playwright (Chromium)';
  readonly backend: AdapterBackend = 'playwright';
  readonly requiredPermissions: PluginPermission[] = [
    'network:outbound',
    'process:spawn',
    'screen:capture',
  ];

  private _status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private browser: Awaited<ReturnType<NonNullable<typeof chromium>['launch']>> | null = null;
  private context: ReturnType<NonNullable<typeof chromium>['launch']> extends Promise<infer T>
    ? T extends { newContext(...args: unknown[]): infer C } ? C : never
    : never = null as never;
  private page: ReturnType<NonNullable<typeof chromium>['launch']> extends Promise<infer T>
    ? T extends { newContext(...args: unknown[]): infer C } ? C extends { newPage(...args: unknown[]): infer P } ? P : never : never
    : never = null as never;

  private launchTimeMs = 0;
  private actionCount = 0;
  private lastAction: string | null = null;
  private lastError: string | null = null;

  get status() { return this._status; }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async connect(): Promise<void> {
    this._status = 'connecting';
    // Connection is deferred to open()
    this._status = 'connected';
  }

  async disconnect(): Promise<void> {
    await this.close();
    this._status = 'disconnected';
  }

  // -----------------------------------------------------------------------
  // Browser lifecycle
  // -----------------------------------------------------------------------

  async open(options: BrowserLaunchOptions = {}): Promise<void> {
    const t0 = Date.now();
    const headless = options.headless !== false;
    const url = options.url || 'about:blank';
    const timeoutMs = options.timeoutMs || 30000;

    try {
      const cr = await getChromium();
      this.browser = await cr.launch({
        headless,
        args: ['--no-sandbox', '--disable-gpu', '--disable-setuid-sandbox'],
        timeout: timeoutMs,
      });
      this.context = await (this.browser as NonNullable<typeof this.browser>).newContext({
        viewport: { width: options.width || 1280, height: options.height || 720 },
      });
      this.page = await (this.context as NonNullable<typeof this.context>).newPage();
      await (this.page as NonNullable<typeof this.page>).goto(url, { timeout: timeoutMs });

      this._status = 'connected';
      this.launchTimeMs = Date.now() - t0;
    } catch (err) {
      this._status = 'error';
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch { /* ignore */ }
    this.browser = null;
    this.context = null as never;
    this.page = null as never;
    this._status = 'disconnected';
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  async navigate(url: string, timeoutMs?: number): Promise<NavigationResult> {
    this.ensureReady();
    const t0 = Date.now();
    const resp = await this.page!.goto(url, { timeout: timeoutMs || 30000 });
    return {
      url: this.page!.url(),
      title: await this.page!.title(),
      statusCode: resp?.status() || 200,
      loadTimeMs: Date.now() - t0,
    };
  }

  async back(): Promise<void> {
    this.ensureReady();
    await this.page!.goBack();
  }

  async forward(): Promise<void> {
    this.ensureReady();
    await this.page!.goForward();
  }

  async reload(): Promise<void> {
    this.ensureReady();
    await this.page!.reload();
  }

  // -----------------------------------------------------------------------
  // Page state
  // -----------------------------------------------------------------------

  currentUrl(): string { return this.page?.url() || ''; }
  currentTitle(): string { this.ensureReady(); return this.page!.url(); }

  async getHtml(): Promise<string> {
    this.ensureReady();
    return this.page!.content();
  }

  async getMarkdown(): Promise<string> {
    this.ensureReady();
    // Best-effort: return text content as pseudo-markdown
    return this.page!.evaluate(() => document.body?.innerText || '');
  }

  async getText(): Promise<string> {
    this.ensureReady();
    return this.page!.evaluate(() => document.body?.innerText || '');
  }

  // -----------------------------------------------------------------------
  // Screenshot
  // -----------------------------------------------------------------------

  async screenshot(opts?: { elementId?: string; fullPage?: boolean; format?: 'png' | 'jpeg' }): Promise<{
    data: string; encoding: 'path' | 'base64'; width: number; height: number; timestamp: number;
  }> {
    this.ensureReady();
    const buf = await this.page!.screenshot({
      fullPage: opts?.fullPage || false,
      type: opts?.format || 'png',
    });
    this.recordAction('browser.screenshot');
    return {
      data: buf.toString('base64'),
      encoding: 'base64',
      width: 1280,
      height: 720,
      timestamp: Date.now(),
    };
  }

  // -----------------------------------------------------------------------
  // Interaction
  // -----------------------------------------------------------------------

  async find(options: FindOptions): Promise<ElementRef[]> {
    this.ensureReady();
    const locator = this.page!.locator(options.selector);
    const count = await locator.count();
    const refs: ElementRef[] = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      const el = locator.nth(i);
      const box = await el.boundingBox().catch(() => null);
      refs.push({
        id: `el-${i}-${Date.now()}`,
        tagName: await el.evaluate((e) => e.tagName.toLowerCase()).catch(() => 'unknown'),
        text: await el.textContent().catch(() => '') || '',
        attributes: {},
        boundingBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null,
      });
    }
    this.recordAction('browser.find');
    return refs;
  }

  async click(options: ClickOptions): Promise<void> {
    this.ensureReady();
    if (options.selector) {
      await this.page!.click(options.selector);
    } else if (options.x !== undefined && options.y !== undefined) {
      await this.page!.mouse.click(options.x, options.y);
    }
    this.recordAction('browser.click');
  }

  async type(options: TypeOptions): Promise<void> {
    this.ensureReady();
    if (options.selector) {
      if (options.clearFirst) {
        await this.page!.fill(options.selector, '');
      }
      await this.page!.type(options.selector, options.text);
    }
    this.recordAction('browser.type');
  }

  async scroll(options: ScrollOptions): Promise<void> {
    this.ensureReady();
    if (options.deltaY !== undefined) {
      await this.page!.evaluate((dy) => window.scrollBy(0, dy), options.deltaY);
    } else if (options.x !== undefined && options.y !== undefined) {
      await this.page!.evaluate(({ x, y }) => window.scrollTo(x, y), options);
    }
    this.recordAction('browser.scroll');
  }

  async wait(ms: number): Promise<void> {
    this.ensureReady();
    await this.page!.waitForTimeout(ms);
  }

  // -----------------------------------------------------------------------
  // JavaScript & cookies
  // -----------------------------------------------------------------------

  async evaluate<T = unknown>(expression: string): Promise<T> {
    this.ensureReady();
    const result = await this.page!.evaluate(expression);
    this.recordAction('browser.evaluate');
    return result as T;
  }

  async getCookies(): Promise<BrowserCookie[]> {
    this.ensureReady();
    const cookies = await (this.context as NonNullable<typeof this.context>).cookies();
    return cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
    }));
  }

  async setCookie(cookie: Partial<BrowserCookie> & { name: string; value: string }): Promise<void> {
    this.ensureReady();
    await (this.context as NonNullable<typeof this.context>).addCookies([{
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '',
      path: cookie.path || '/',
      expires: cookie.expires || -1,
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure || false,
    }]);
  }

  // -----------------------------------------------------------------------
  // Tab management
  // -----------------------------------------------------------------------

  async listTabs(): Promise<BrowserTab[]> {
    this.ensureReady();
    const pages = (this.context as NonNullable<typeof this.context>).pages();
    return await Promise.all(pages.map(async (p, i) => ({
      id: `tab-${i}`,
      url: p.url(),
      title: await p.title(),
      isActive: p === this.page,
    })));
  }

  async newTab(url?: string): Promise<BrowserTab> {
    this.ensureReady();
    const newPage = await (this.context as NonNullable<typeof this.context>).newPage();
    if (url) await newPage.goto(url);
    return { id: `tab-${Date.now()}`, url: newPage.url(), title: await newPage.title(), isActive: false };
  }

  async closeTab(tabId: string): Promise<void> {
    this.ensureReady();
    const pages = (this.context as NonNullable<typeof this.context>).pages();
    const idx = parseInt(tabId.replace('tab-', ''), 10);
    if (idx >= 0 && idx < pages.length) {
      await pages[idx].close();
    }
  }

  async switchToTab(tabId: string): Promise<void> {
    this.ensureReady();
    const pages = (this.context as NonNullable<typeof this.context>).pages();
    const idx = parseInt(tabId.replace('tab-', ''), 10);
    if (idx >= 0 && idx < pages.length) {
      this.page = pages[idx];
      await this.page!.bringToFront();
    }
  }

  // -----------------------------------------------------------------------
  // Health & diagnostics
  // -----------------------------------------------------------------------

  async health(): Promise<AdapterHealth> {
    const connected = this._status === 'connected' && this.browser?.isConnected() === true;
    return {
      available: connected,
      status: connected ? 'connected' : 'disconnected',
      latencyMs: 0,
      lastError: this.lastError,
      lastCheckedAt: Date.now(),
    };
  }

  diagnostics(): AdapterDiagnostics {
    return {
      id: this.id,
      backend: this.backend,
      status: this._status,
      connected: this.browser?.isConnected() || false,
      uptimeMs: this.launchTimeMs,
      lastAction: this.lastAction,
      lastActionAt: Date.now(),
      totalActions: this.actionCount,
      errors: this.lastError ? 1 : 0,
      avgLatencyMs: 0,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private ensureReady(): void {
    if (!this.browser || !this.browser.isConnected()) {
      throw new Error('Browser is not running. Call browser.open first.');
    }
    if (!this.page) {
      throw new Error('No active page.');
    }
  }

  private recordAction(name: string): void {
    this.actionCount++;
    this.lastAction = name;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { PlaywrightBrowserBackend };
