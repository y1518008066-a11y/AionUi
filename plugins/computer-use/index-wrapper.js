/**
 * Computer Use Plugin — Adapter Wrapper (v2.0.0)
 *
 * Thin wrapper around IComputerUseAdapter.
 * No direct OS calls — everything delegates to the adapter layer.
 *
 * Architecture:
 *   ActionEngine → Computer Use Plugin → BackendManager → IComputerUseAdapter → Backend
 *
 * Backend priority: Codex → MCP → Local fallback
 */

const { getActionEngine } = require("../../action-engine/singleton");
const { join } = require("path");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let activateTime = 0;
let lastError = null;

/** @type {import("../../adapters/computer-use").IComputerUseAdapter | null} */
let adapter = null;

// ---------------------------------------------------------------------------
// Adapter resolution (lazy)
// ---------------------------------------------------------------------------

async function resolveAdapter() {
  if (adapter) return adapter;

  try {
    // Try BackendManager first (Codex → MCP → Local)
    const { getBackendManager } = require("../../adapters/backend-manager");
    const bm = getBackendManager();

    // Register the local backend as fallback
    try {
      const { LocalComputerUseBackend } = require("../../adapters/local-computer-use-backend");
      const local = new LocalComputerUseBackend(pluginContext?.dataDir);
      await local.connect();
      bm.register(local);
    } catch {
      console.log("[CU] Local backend not available. Will try MCP/Codex.");
    }

    adapter = bm.getComputerUseAdapter();
    if (adapter) {
      console.log("[CU] Using backend:", adapter.backend, adapter.name);
      return adapter;
    }
  } catch (err) {
    console.warn("[CU] BackendManager not available:", err.message);
  }

  // Direct fallback: instantiate Local
  try {
    const { LocalComputerUseBackend } = require("../../adapters/local-computer-use-backend");
    const local = new LocalComputerUseBackend(pluginContext?.dataDir);
    await local.connect();
    adapter = local;
    console.log("[CU] Using direct fallback: Local");
    return adapter;
  } catch {
    console.error("[CU] No Computer Use backend available.");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function activate(context) {
  pluginContext = context;
  enabled = true;
  activateTime = Date.now();

  try {
    actionEngine = getActionEngine();
  } catch (err) {
    console.warn("[CU] ActionEngine not available:", err.message);
  }

  await resolveAdapter();

  if (actionEngine) {
    registerActions();
  }

  console.log("[CU] Activated. Backend:", adapter?.backend || "none", "| Actions:", registeredActionIds.length);
  return { ok: true };
}

async function deactivate() {
  enabled = false;

  if (actionEngine) {
    for (const actionId of registeredActionIds) {
      try { actionEngine.unregisterAction(actionId); } catch {}
    }
  }

  if (adapter) {
    try { await adapter.disconnect(); } catch {}
    adapter = null;
  }

  registeredActionIds = [];
  console.log("[CU] Deactivated.");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Action registration
// ---------------------------------------------------------------------------

function registerActions() {
  const actions = [
    { id: "computer.desktopInfo", desc: "Get desktop state", perms: [], handler: () => adapter?.getDesktopInfo() },
    { id: "computer.displays", desc: "List displays", perms: [], handler: () => adapter?.getDisplays() },
    { id: "computer.listWindows", desc: "List windows", perms: [], handler: () => adapter?.listWindows() },
    { id: "computer.cursorPosition", desc: "Get cursor position", perms: [], handler: () => adapter?.getCursorPosition() },
    { id: "computer.screenshot", desc: "Capture screenshot", perms: ["screen:capture", "filesystem:write"], handler: () => adapter?.captureScreenshot() },
  ];

  for (const action of actions) {
    try {
      actionEngine.registerAction(
        {
          id: action.id,
          pluginId: "com.jarvis.computer-use",
          description: action.desc,
          permissions: action.perms,
          parameters: [],
          returnType: { type: "object", description: "Result" },
        },
        async () => {
          try {
            return await action.handler();
          } catch (err) {
            lastError = err.message;
            throw err;
          }
        }
      );
      registeredActionIds.push(action.id);
    } catch (err) {
      console.warn("[CU] Failed to register action:", action.id, err.message);
    }
  }

  console.log("[CU] Registered", registeredActionIds.length, "actions with ActionEngine.");
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

function getDiagnostics() {
  return {
    pluginVersion: "2.0.0",
    enabled,
    backend: adapter?.backend || "none",
    backendName: adapter?.name || "none",
    backendStatus: adapter?.status || "disconnected",
    registeredActions: registeredActionIds.length,
    actionIds: registeredActionIds,
    lastError: lastError,
    uptimeMs: activateTime ? Date.now() - activateTime : 0,
  };
}

// ---------------------------------------------------------------------------
// Exports (plugin API)
// ---------------------------------------------------------------------------

module.exports = {
  activate,
  deactivate,
  getDiagnostics,
};
