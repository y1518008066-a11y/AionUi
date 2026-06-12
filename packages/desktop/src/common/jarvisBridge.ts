/**
 * Jarvis Systems — Renderer-Accessible Bridge
 *
 * Provides lazy access to Jarvis subsystems initialized in the main process.
 * All systems are accessed through window.__jarvisSystems which is set
 * by the preload script after the main process initializes the systems.
 *
 * Falls back gracefully when systems are not yet available.
 */

// ---------------------------------------------------------------------------
// Types (lightweight — no cross-tree imports)
// ---------------------------------------------------------------------------

type JarvisSystems = {
  modeManager?: {
    switchMode(modeId: string): Promise<void>;
    listModes(): Array<{ id: string; label: string; description: string; icon: string; rules: { activePlugins: string[]; permissionLevel: string } }>;
    activeModeId: string | null;
  };
  providerCenter?: {
    activateProvider(providerId: string): Promise<{ ok: boolean; error?: string }>;
    listProviders(): Array<{ providerId: string; name: string; type: string; enabled: boolean; active: boolean; health: Record<string, unknown>; modelCount: number }>;
    activeProviderId: string | null;
  };
  pluginManager?: {
    enable(pluginId: string): Promise<boolean>;
    disable(pluginId: string): Promise<boolean>;
    list(): Array<{ id: string; manifest: { name: string; version: string; author: string; description: string }; enabled: boolean; status: string; capabilities: string[]; permissions: string[]; loadTimeMs: number; lastError: string | null }>;
    listEnabled(): Array<{ manifest: { id: string } }>;
  };
  actionEngine?: {
    dispatch(input: { actionId: string; callerPluginId: string; params: Record<string, unknown> }): Promise<{ success: boolean; result: unknown }>;
  };
  backendManager?: {
    getComputerUseAdapter(): { captureScreenshot(): Promise<{ width: number; height: number; path: string }> } | null;
  };
};

// ---------------------------------------------------------------------------
// Lazy accessor
// ---------------------------------------------------------------------------

function getSystems(): JarvisSystems | null {
  return (window as unknown as { __jarvisSystems?: JarvisSystems }).__jarvisSystems ?? null;
}

function getModeManager() { return getSystems()?.modeManager ?? null; }
function getPluginManager() { return getSystems()?.pluginManager ?? null; }
function getProviderCenter() { return getSystems()?.providerCenter ?? null; }
function getActionEngine() { return getSystems()?.actionEngine ?? null; }
function getBackendManager() { return getSystems()?.backendManager ?? null; }

export { getSystems, getModeManager, getPluginManager, getProviderCenter, getActionEngine, getBackendManager };
export type { JarvisSystems };
