/**
 * Plugin Bridge — IPC handlers for plugin marketplace operations.
 * Wires the PluginInstaller into the Electron main process so the
 * renderer can install/uninstall plugins via IPC.
 */

import { ipcMain } from 'electron';
import { resolve } from 'path';

let installerInstance: any = null;

function getInstaller() {
  if (!installerInstance) {
    // Static import — electron-vite bundles plugin-marketplace via alias
    const { PluginInstaller } = require('@plugin-marketplace/installer');
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
      const sourcePath = params.sourcePath || resolve(process.cwd(), 'plugins', params.pluginId);
      
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

  console.log('[PluginBridge] IPC handlers registered');
}
