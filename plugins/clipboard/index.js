/**
 * Clipboard Plugin
 *
 * Provides clipboard read/write through ActionEngine.
 * Uses platform-specific clipboard access.
 *
 * Registered actions:
 *   clipboard.read()   — read current clipboard content
 *   clipboard.write(text) — write text to clipboard
 */

const { execSync } = require("child_process");

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClipboardPowerShell() {
  // Read clipboard via PowerShell
  try {
    const result = execSync(
      'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetText()"',
      { encoding: "utf-8", timeout: 5000 }
    );
    return result.trim();
  } catch (e) {
    console.warn("[Clipboard] Read failed:", e.message);
    return null;
  }
}

function setClipboardPowerShell(text) {
  // Escape single quotes for PowerShell
  const escaped = text.replace(/'/g, "''");
  try {
    execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText('${escaped}')"`,
      { encoding: "utf-8", timeout: 5000 }
    );
    return true;
  } catch (e) {
    console.error("[Clipboard] Write failed:", e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function clipboard_read(_params) {
  const text = getClipboardPowerShell();
  return { text: text || "", length: (text || "").length, success: text !== null };
}

async function clipboard_write(params) {
  const { text } = params;
  if (text === undefined) throw new Error("clipboard.write requires 'text' parameter");
  const ok = setClipboardPowerShell(String(text));
  return { written: ok, length: String(text).length };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function activate(context) {
  pluginContext = context;
  console.log("[Clipboard] Activated.");

  try {
    const aeMod = await import("../../action-engine/singleton");
    actionEngine = aeMod.getActionEngine();
  } catch (e) {
    console.warn("[Clipboard] ActionEngine not available:", e.message);
    return;
  }

  const actions = [
    { id: "clipboard.read", handler: clipboard_read, description: "Read clipboard content", permissions: ["clipboard"] },
    { id: "clipboard.write", handler: clipboard_write, description: "Write text to clipboard", permissions: ["clipboard"] },
  ];

  for (const a of actions) {
    actionEngine.registerAction(
      { actionId: a.id, pluginId: context.pluginId, description: a.description, permissions: a.permissions, parameters: {}, returnType: "json" },
      a.handler
    );
    registeredActionIds.push(a.id);
  }

  enabled = true;
  console.log("[Clipboard] Registered " + actions.length + " actions.");
}

async function deactivate(context) {
  if (actionEngine) {
    for (const id of registeredActionIds) {
      actionEngine.unregisterAction(id);
    }
  }
  registeredActionIds = [];
  enabled = false;
  console.log("[Clipboard] Deactivated.");
}

function health() {
  return { enabled };
}

module.exports = { activate, deactivate, health };
