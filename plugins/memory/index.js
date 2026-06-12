/**
 * Memory Plugin
 *
 * Provides key-value memory storage through ActionEngine.
 * Persists to the plugin data directory.
 *
 * Registered actions:
 *   memory.store(key, value)  — store a value
 *   memory.retrieve(key)      — retrieve a value
 *   memory.delete(key)        — delete a key
 *   memory.list()             — list all keys
 */

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let store = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, "data");
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

function getStorePath() {
  return join(getDataDir(), "memory.json");
}

function loadStore() {
  try {
    if (existsSync(getStorePath())) {
      store = JSON.parse(readFileSync(getStorePath(), "utf-8"));
    }
  } catch (e) {
    console.warn("[Memory] Failed to load store:", e.message);
  }
}

function saveStore() {
  try {
    writeFileSync(getStorePath(), JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("[Memory] Failed to save store:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function memory_store(params) {
  const { key, value } = params;
  if (!key) throw new Error("memory.store requires 'key' parameter");
  store[key] = value;
  saveStore();
  return { stored: true, key };
}

async function memory_retrieve(params) {
  const { key } = params;
  if (!key) throw new Error("memory.retrieve requires 'key' parameter");
  return { key, value: store[key] ?? null, exists: key in store };
}

async function memory_delete(params) {
  const { key } = params;
  if (!key) throw new Error("memory.delete requires 'key' parameter");
  const existed = key in store;
  delete store[key];
  if (existed) saveStore();
  return { deleted: existed, key };
}

async function memory_list(_params) {
  return { keys: Object.keys(store), count: Object.keys(store).length };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function activate(context) {
  pluginContext = context;
  loadStore();
  console.log("[Memory] Activated. Data dir:", getDataDir(), "| Keys:", Object.keys(store).length);

  // Import ActionEngine singleton
  try {
    const aeMod = await import("../../action-engine/singleton");
    actionEngine = aeMod.getActionEngine();
  } catch (e) {
    console.warn("[Memory] ActionEngine not available:", e.message);
    return;
  }

  const actions = [
    { id: "memory.store", handler: memory_store, description: "Store a value by key", permissions: ["memory"] },
    { id: "memory.retrieve", handler: memory_retrieve, description: "Retrieve a value by key", permissions: ["memory"] },
    { id: "memory.delete", handler: memory_delete, description: "Delete a key", permissions: ["memory"] },
    { id: "memory.list", handler: memory_list, description: "List all stored keys", permissions: ["memory"] },
  ];

  for (const a of actions) {
    actionEngine.registerAction(
      { actionId: a.id, pluginId: context.pluginId, description: a.description, permissions: a.permissions, parameters: {}, returnType: "json" },
      a.handler
    );
    registeredActionIds.push(a.id);
  }

  enabled = true;
  console.log("[Memory] Registered " + actions.length + " actions.");
}

async function deactivate(context) {
  if (actionEngine) {
    for (const id of registeredActionIds) {
      actionEngine.unregisterAction(id);
    }
  }
  registeredActionIds = [];
  enabled = false;
  console.log("[Memory] Deactivated.");
}

function health() {
  return { enabled, keys: Object.keys(store).length, dataDir: getDataDir() };
}

module.exports = { activate, deactivate, health };
