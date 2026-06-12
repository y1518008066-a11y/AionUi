/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Local Computer Use Backend — IComputerUseAdapter Implementation
 *
 * Implements IComputerUseAdapter using OS-level APIs (PowerShell on Windows).
 * This is the local fallback backend when Codex or MCP is unavailable.
 *
 * Maintains backwards compatibility with the existing Computer Use Plugin
 * by extracting the core desktop state logic into a clean adapter.
 */

import type {
  IComputerUseAdapter,
  DisplayInfo,
  WindowInfo,
  CursorInfo,
  Screenshot,
  ScreenshotOptions,
  DesktopInfo,
} from './computer-use';
import type { IAdapter, AdapterId, AdapterBackend, AdapterHealth, AdapterDiagnostics } from './types';
import type { PluginPermission } from '../plugin-marketplace/types';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Local Computer Use Backend
// ---------------------------------------------------------------------------

class LocalComputerUseBackend implements IComputerUseAdapter {
  readonly id: AdapterId = 'local-computer-use';
  readonly name = 'Local Computer Use (PowerShell)';
  readonly backend: AdapterBackend = 'local';
  readonly requiredPermissions: PluginPermission[] = [
    'screen:capture',
    'filesystem:write',
    'network:outbound',
  ];

  private _status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private lastError: string | null = null;
  private screenshotCount = 0;
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || join(process.cwd(), 'adapters', 'data');
    if (!existsSync(this.dataDir)) {
      try { mkdirSync(this.dataDir, { recursive: true }); } catch { /* ignore */ }
    }
  }

  get status() { return this._status; }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async connect(): Promise<void> {
    this._status = 'connected';
    console.log('[LocalCU] Connected. Platform:', os.platform());
  }

  async disconnect(): Promise<void> {
    this._status = 'disconnected';
  }

  // -----------------------------------------------------------------------
  // Desktop state
  // -----------------------------------------------------------------------

  async getDesktopInfo(): Promise<DesktopInfo> {
    const [displays, windows, cursor] = await Promise.all([
      this.getDisplays(),
      this.listWindows(),
      this.getCursorPosition(),
    ]);

    return {
      platform: os.platform(),
      displays,
      windows,
      cursor,
      timestamp: Date.now(),
    };
  }

  async getDisplays(): Promise<DisplayInfo[]> {
    if (os.platform() !== 'win32') {
      return [{
        id: 'primary',
        name: 'Primary Display',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        isPrimary: true,
      }];
    }

    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
          @{
            id = $_.DeviceName
            name = $_.DeviceName
            bounds = @{ x = $_.Bounds.X; y = $_.Bounds.Y; width = $_.Bounds.Width; height = $_.Bounds.Height }
            scaleFactor = 1
            isPrimary = $_.Primary
          }
        } | ConvertTo-Json -Compress
      `;
      const result = this.runPS(script);
      if (result && Array.isArray(result)) {
        return result.map((d: Record<string, unknown>) => ({
          id: String(d.id || 'display'),
          name: String(d.name || 'Display'),
          bounds: d.bounds as DisplayInfo['bounds'] || { x: 0, y: 0, width: 1920, height: 1080 },
          scaleFactor: Number(d.scaleFactor) || 1,
          isPrimary: Boolean(d.isPrimary),
        }));
      }
    } catch { /* fall through */ }

    return [{
      id: 'primary',
      name: 'Primary Display',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      isPrimary: true,
    }];
  }

  async listWindows(): Promise<WindowInfo[]> {
    if (os.platform() !== 'win32') {
      return [];
    }

    try {
      const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          using System.Text;
          public class WinAPI {
            [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
            [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
            [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
            [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
            [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
          }
          public struct RECT { public int Left, Top, Right, Bottom; }
"@

        $foreground = [WinAPI]::GetForegroundWindow()

        Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -First 30 | ForEach-Object {
          $hwnd = $_.MainWindowHandle
          $rect = New-Object RECT
          [WinAPI]::GetWindowRect($hwnd, [ref]$rect)
          @{
            id = $_.Id.ToString()
            title = $_.MainWindowTitle
            application = $_.ProcessName
            bounds = @{ x = $rect.Left; y = $rect.Top; width = $rect.Right - $rect.Left; height = $rect.Bottom - $rect.Top }
            visible = [WinAPI]::IsWindowVisible($hwnd)
            minimized = [WinAPI]::IsIconic($hwnd)
            isForeground = ($hwnd -eq $foreground)
          }
        } | ConvertTo-Json -Compress
      `;
      const result = this.runPS(script);
      if (result && Array.isArray(result)) {
        return result.map((w: Record<string, unknown>) => ({
          id: String(w.id || ''),
          title: String(w.title || ''),
          application: String(w.application || ''),
          bounds: w.bounds as WindowInfo['bounds'] || { x: 0, y: 0, width: 0, height: 0 },
          visible: Boolean(w.visible),
          minimized: Boolean(w.minimized),
          isForeground: Boolean(w.isForeground),
        }));
      }
    } catch { /* fall through */ }

    return [];
  }

  async getCursorPosition(): Promise<CursorInfo> {
    if (os.platform() !== 'win32') {
      return { x: 0, y: 0, timestamp: Date.now() };
    }

    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $pos = [System.Windows.Forms.Cursor]::Position
        @{ x = $pos.X; y = $pos.Y } | ConvertTo-Json -Compress
      `;
      const result = this.runPS(script);
      if (result) {
        return { x: Number(result.x) || 0, y: Number(result.y) || 0, timestamp: Date.now() };
      }
    } catch { /* fall through */ }

    return { x: 0, y: 0, timestamp: Date.now() };
  }

  // -----------------------------------------------------------------------
  // Screenshot
  // -----------------------------------------------------------------------

  async captureScreenshot(options?: ScreenshotOptions): Promise<Screenshot> {
    this.screenshotCount++;

    // For Windows, use PowerShell to capture
    if (os.platform() === 'win32') {
      try {
        const filename = `screenshot_${Date.now()}.png`;
        const filepath = join(this.dataDir, filename);

        const script = `
          Add-Type -AssemblyName System.Windows.Forms
          Add-Type -AssemblyName System.Drawing

          $screen = [System.Windows.Forms.Screen]::PrimaryScreen
          $bounds = $screen.Bounds
          $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
          $bitmap.Save('${filepath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
          $graphics.Dispose()
          $bitmap.Dispose()

          @{ width = $bounds.Width; height = $bounds.Height } | ConvertTo-Json -Compress
        `;
        const info = this.runPS(script);

        if (existsSync(filepath)) {
          return {
            data: filepath,
            encoding: 'path',
            width: info?.width || 1920,
            height: info?.height || 1080,
            format: 'png',
            timestamp: Date.now(),
            displayId: options?.displayId || null,
          };
        }
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
      }
    }

    // Fallback: return stub
    return {
      data: '',
      encoding: 'path',
      width: 1920,
      height: 1080,
      format: 'png',
      timestamp: Date.now(),
      displayId: null,
    };
  }

  // -----------------------------------------------------------------------
  // Health & diagnostics
  // -----------------------------------------------------------------------

  async health(): Promise<AdapterHealth> {
    return {
      available: true,
      status: this._status as AdapterHealth['status'],
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
      connected: this._status === 'connected',
      uptimeMs: 0,
      lastAction: 'screenshot x' + this.screenshotCount,
      lastActionAt: Date.now(),
      totalActions: this.screenshotCount,
      errors: this.lastError ? 1 : 0,
      avgLatencyMs: 0,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private runPS(script: string): Record<string, unknown> | null {
    const psFile = join(this.dataDir, `_tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}.ps1`);
    try {
      writeFileSync(psFile, script, 'utf-8');
      const result = execSync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psFile}"`,
        { timeout: 15000, encoding: 'utf-8', windowsHide: true }
      );
      const trimmed = result.trim();
      if (!trimmed) return null;
      try { return JSON.parse(trimmed); } catch { return null; }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return null;
    } finally {
      try { if (existsSync(psFile)) unlinkSync(psFile); } catch { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { LocalComputerUseBackend };
