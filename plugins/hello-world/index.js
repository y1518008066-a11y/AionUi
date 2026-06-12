/**
 * Hello World Plugin
 *
 * Demonstrates the Jarvis plugin runtime. Exports activate and deactivate
 * lifecycle hooks that the plugin loader calls.
 */

/** Called when the plugin is activated. */
export async function activate(context) {
  console.log('[HelloWorld] Activated! Plugin ID:', context.pluginId);
  console.log('[HelloWorld] Data directory:', context.dataDir);
  return { initialized: true };
}

/** Called when the plugin is deactivated. */
export async function deactivate(context) {
  console.log('[HelloWorld] Deactivated! Plugin ID:', context.pluginId);
  return { cleaned: true };
}

/** Optional: plugin metadata for diagnostics. */
export const diagnostics = {
  name: 'Hello World Plugin',
  version: '1.0.0',
  health: 'ok',
};