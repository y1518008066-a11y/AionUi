/**
 * Browser Plugin — Adapter Wrapper (v2.0.0)
 *
 * Thin wrapper around IBrowserAdapter.
 * No direct Playwright calls — everything delegates to the adapter layer.
 *
 * Architecture:
 *   ActionEngine → Browser Plugin → BackendManager → IBrowserAdapter → Backend
 *
 * Backend priority: Codex → MCP → Playwright fallback
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

/** @type {import("../../adapters/browser").IBrowserAdapter | null} */
let adapter = null;

// ---------------------------------------------------------------------------
// Adapter resolution (lazy)
// ---------------------------------------------------------------------------

async function resolveAdapter() {
  if (adapter) return adapter;

  try {
    // Try BackendManager first (Codex → MCP → Playwright)
    const { getBackendManager } = require("../../adapters/backend-manager");
    const bm = getBackendManager();

    // Register the Playwright backend as fallback
    try {
      const { PlaywrightBrowserBackend } = require("../../adapters/playwright-backend");
      const pw = new PlaywrightBrowserBackend();
      await pw.connect();
      bm.register(pw);
    } catch {
      console.log("[Browser] Playwright backend not available. Will try MCP/Codex.");
    }

    adapter = bm.getBrowserAdapter();
    if (adapter) {
      console.log("[Browser] Using backend:", adapter.backend, adapter.name);
      return adapter;
    }
  } catch (err) {
    console.warn("[Browser] BackendManager not available:", err.message);
  }

  // Direct fallback: instantiate Playwright
  try {
    const { PlaywrightBrowserBackend } = require("../../adapters/playwright-backend");
    const pw = new PlaywrightBrowserBackend();
    await pw.connect();
    adapter = pw;
    console.log("[Browser] Using direct fallback: Playwright");
    return adapter;
  } catch {
    console.error("[Browser] No browser backend available.");
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

  // Get ActionEngine singleton
  try {
    actionEngine = getActionEngine();
  } catch (err) {
    console.warn("[Browser] ActionEngine not available:", err.message);
  }

  // Resolve adapter
  await resolveAdapter();

  // Register actions
  if (actionEngine) {
    registerActions();
  }

  console.log("[Browser] Activated. Backend:", adapter?.backend || "none", "| Actions:", registeredActionIds.length);
  return { ok: true };
}

async function deactivate() {
  enabled = false;

  // Unregister all actions
  if (actionEngine) {
    for (const actionId of registeredActionIds) {
      try { actionEngine.unregisterAction(actionId); } catch {}
    }
  }

  // Disconnect adapter
  if (adapter) {
    try { await adapter.disconnect(); } catch {}
    adapter = null;
  }

  registeredActionIds = [];
  console.log("[Browser] Deactivated.");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Action registration (22 browser actions)
// ---------------------------------------------------------------------------

function registerActions() {
  const actions = [
    { id: "browser.open", desc: "Launch browser", perms: ["network:outbound", "process:spawn"], params: [{ name: "url", type: "string", required: false, desc: "Starting URL" }], handler: (p) => adapter?.open({ url: p.url }) },
    { id: "browser.close", desc: "Close browser", perms: [], params: [], handler: () => adapter?.close() },
    { id: "browser.navigate", desc: "Navigate to URL", perms: ["network:outbound"], params: [{ name: "url", type: "string", required: true, desc: "URL to navigate to" }], handler: (p) => adapter?.navigate(p.url) },
    { id: "browser.back", desc: "Go back", perms: [], params: [], handler: () => adapter?.back() },
    { id: "browser.forward", desc: "Go forward", perms: [], params: [], handler: () => adapter?.forward() },
    { id: "browser.reload", desc: "Reload page", perms: [], params: [], handler: () => adapter?.reload() },
    { id: "browser.currentUrl", desc: "Get current URL", perms: [], params: [], handler: () => adapter?.currentUrl() },
    { id: "browser.currentTitle", desc: "Get page title", perms: [], params: [], handler: () => adapter?.currentTitle() },
    { id: "browser.getHtml", desc: "Get page HTML", perms: [], params: [], handler: () => adapter?.getHtml() },
    { id: "browser.getMarkdown", desc: "Get page as Markdown", perms: [], params: [], handler: () => adapter?.getMarkdown() },
    { id: "browser.getText", desc: "Get visible text", perms: [], params: [], handler: () => adapter?.getText() },
    { id: "browser.screenshot", desc: "Take screenshot", perms: ["screen:capture"], params: [], handler: () => adapter?.screenshot() },
    { id: "browser.click", desc: "Click element", perms: [], params: [{ name: "selector", type: "string", required: false, desc: "CSS selector" }], handler: (p) => adapter?.click({ selector: p.selector }) },
    { id: "browser.type", desc: "Type text", perms: [], params: [{ name: "selector", type: "string", required: false, desc: "CSS selector" }, { name: "text", type: "string", required: true, desc: "Text to type" }], handler: (p) => adapter?.type({ selector: p.selector, text: p.text }) },
    { id: "browser.scroll", desc: "Scroll page", perms: [], params: [{ name: "deltaY", type: "number", required: false, desc: "Scroll pixels" }], handler: (p) => adapter?.scroll({ deltaY: p.deltaY }) },
    { id: "browser.wait", desc: "Wait milliseconds", perms: [], params: [{ name: "ms", type: "number", required: true, desc: "Milliseconds" }], handler: (p) => adapter?.wait(p.ms) },
    { id: "browser.find", desc: "Find elements", perms: [], params: [{ name: "selector", type: "string", required: true, desc: "CSS selector" }], handler: (p) => adapter?.find({ selector: p.selector }) },
    { id: "browser.evaluate", desc: "Evaluate JavaScript", perms: ["process:spawn"], params: [{ name: "expression", type: "string", required: true, desc: "JS expression" }], handler: (p) => adapter?.evaluate(p.expression) },
    { id: "browser.cookies", desc: "Get cookies", perms: [], params: [], handler: () => adapter?.getCookies() },
    { id: "browser.tabs", desc: "List tabs", perms: [], params: [], handler: () => adapter?.listTabs() },
    { id: "browser.newTab", desc: "Open new tab", perms: [], params: [{ name: "url", type: "string", required: false, desc: "URL" }], handler: (p) => adapter?.newTab(p.url) },
    { id: "browser.closeTab", desc: "Close tab", perms: [], params: [{ name: "tabId", type: "string", required: true, desc: "Tab ID" }], handler: (p) => adapter?.closeTab(p.tabId) },
  ];

  for (const action of actions) {
    try {
      actionEngine.registerAction(
        {
          id: action.id,
          pluginId: "com.jarvis.browser",
          description: action.desc,
          permissions: action.perms,
          parameters: action.params.map((p) => ({
            name: p.name,
            type: p.type,
            required: p.required || false,
            description: p.desc,
          })),
          returnType: { type: "object", description: "Result" },
        },
        async (ctx) => {
          try {
            const result = await action.handler(ctx.params);
            return result;
          } catch (err) {
            lastError = err.message;
            throw err;
          }
        }
      );
      registeredActionIds.push(action.id);
    } catch (err) {
      console.warn("[Browser] Failed to register action:", action.id, err.message);
    }
  }

  console.log("[Browser] Registered", registeredActionIds.length, "actions with ActionEngine.");
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
