/**
 * Plugin Bridge — IPC handlers for plugin marketplace operations.
 * Wires the PluginInstaller into the Electron main process so the
 * renderer can install/uninstall plugins via IPC.
 */

import { ipcMain } from 'electron';
import { PluginInstaller } from '../plugin-marketplace/installer';
import { resolve, join } from 'path';

/** Get the project root, accounting for Electron packaging. */
/** Get the project root from the bundled __dirname. */
function getAppRoot(): string {
  // In electron-vite bundle, __dirname = out/
  // Go up 1 level to project root
  return resolve(__dirname, '..');
}
import { existsSync } from 'fs';

/**
 * Resolve plugin directory from pluginId.
 * Maps "com.jarvis.overlay" → "plugins/overlay"
 */
function resolvePluginDir(pluginId: string): string {
  // Strategy 1: strip "com.jarvis." prefix
  const shortName = pluginId.replace(/^com\.jarvis\./, '');
  const shortPath = resolve(getAppRoot(), 'plugins', shortName);
  if (existsSync(join(shortPath, 'plugin.json'))) return shortPath;

  // Strategy 2: try full id as directory name (legacy)
  const fullPath = resolve(getAppRoot(), 'plugins', pluginId);
  if (existsSync(join(fullPath, 'plugin.json'))) return fullPath;

  // Strategy 3: scan plugins dir for matching id in plugin.json
  const pluginsDir = resolve(process.cwd(), 'plugins');
  if (existsSync(pluginsDir)) {
    const { readdirSync } = require('fs');
    for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(pluginsDir, entry.name, 'plugin.json');
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(require('fs').readFileSync(manifestPath, 'utf8'));
          if (manifest.id === pluginId) return join(pluginsDir, entry.name);
        } catch { /* skip */ }
      }
    }
  }

  // Fallback: return short path (caller will report error if not found)
  return shortPath;
}

let installerInstance: any = null;

function getInstaller() {
  if (!installerInstance) {
    installerInstance = new PluginInstaller();
    console.log('[PluginBridge] PluginInstaller initialized');
  }
  return installerInstance;
}

export function initPluginBridge(): void {
  // install — copy plugin from source path to installed/
  ipcMain.handle('plugin:install', async (_event, params: { pluginId: string; sourcePath?: string }) => {
    try {
      const installer = getInstaller();
      const sourcePath = params.sourcePath || resolvePluginDir(params.pluginId); console.log('[PluginBridge] install sourcePath:', sourcePath, 'appRoot:', getAppRoot(), 'cwd:', process.cwd());
      
      const result = await installer.install({
        type: 'local-path',
        uri: sourcePath,
        version: '0.0.0',
      });

      if (result.ok) {
        console.log('[PluginBridge] Installed:', params.pluginId, '→', result.installPath);
      } else {
        console.error('[PluginBridge] Install failed:', params.pluginId, result.error);
      }
      
      return { success: result.ok, error: result.error || undefined, installPath: result.installPath, version: result.version };
    } catch (err) {
      console.error('[PluginBridge] Install exception:', err);
      return { success: false, error: String(err) };
    }
  });

  // uninstall — remove plugin from installed/ (move to disabled by default)
  ipcMain.handle('plugin:uninstall', async (_event, params: { pluginId: string; fullRemove?: boolean }) => {
    try {
      const installer = getInstaller();
      const result = installer.uninstall(params.pluginId, params.fullRemove ?? false);
      console.log('[PluginBridge] Uninstalled:', params.pluginId, 'removed:', result.removed);
      return { success: result.ok, removed: result.removed, error: undefined };
    } catch (err) {
      console.error('[PluginBridge] Uninstall exception:', err);
      return { success: false, error: String(err) };
    }
  });

  // get installed plugins
  ipcMain.handle('plugin:list-installed', async () => {
    try {
      const installer = getInstaller();
      return { success: true, plugins: installer.listInstalled() };
    } catch (err) {
      return { success: false, error: String(err), plugins: [] };
    }
  });

  // get installed version
  ipcMain.handle('plugin:get-version', async (_event, pluginId: string) => {
    try {
      const installer = getInstaller();
      return { success: true, version: installer.getInstalledVersion(pluginId) };
    } catch (err) {
      return { success: false, error: String(err), version: null };
    }
  });

  
  // enable plugin
  ipcMain.handle('plugin:enable', async (_event, pluginId: string) => {
    try {
      console.log('[PluginBridge] Enabling:', pluginId);
      // Currently enable just validates that the plugin exists in installed/
      const { existsSync } = require('fs');
      const installedPath = resolve(getAppRoot(), 'plugins', 'installed', pluginId);
      if (!existsSync(installedPath)) {
        return { success: false, error: 'Plugin not installed: ' + pluginId };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // disable plugin
  ipcMain.handle('plugin:disable', async (_event, pluginId: string) => {
    try {
      console.log('[PluginBridge] Disabling:', pluginId);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  console.log('[PluginBridge] IPC handlers registered');
}
