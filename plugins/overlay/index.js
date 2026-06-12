/**
 * Overlay Plugin - On-screen overlay for active assistance.
 */

const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let overlays = [];

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, 'data');
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

async function overlay_show(params) {
  const { id, content, x, y, width, height } = params;
  const overlay = { id: id || ('ovl_' + Date.now()), content, x: x||0, y: y||0, width: width||300, height: height||200, visible: true, timestamp: Date.now() };
  overlays.push(overlay);
  return { shown: true, overlay };
}

async function overlay_hide(params) {
  const { id } = params;
  const idx = overlays.findIndex(o => o.id === id);
  if (idx >= 0) { overlays[idx].visible = false; return { hidden: true, id }; }
  return { hidden: false, error: 'Overlay not found: ' + id };
}

async function overlay_list(_params) {
  return { overlays: overlays.filter(o => o.visible), count: overlays.filter(o => o.visible).length };
}

async function overlay_notify(params) {
  const { title, message, duration } = params;
  const ovl = await overlay_show({ id: 'notify_' + Date.now(), content: { title, message }, width: 280, height: 80 });
  if (duration) setTimeout(() => overlay_hide({ id: ovl.overlay.id }), duration);
  return ovl;
}

async function overlay_health(_params) {
  return { enabled, activeOverlays: overlays.filter(o => o.visible).length };
}

async function activate(context) {
  pluginContext = context;
  console.log('[Overlay] Activated');
  try {
    const aeMod = await import('../../action-engine/singleton');
    actionEngine = aeMod.getActionEngine();
  } catch (e) {
    console.warn('[Overlay] ActionEngine not available:', e.message);
    return;
  }
  const actions = [
    { id:'overlay.show', handler:overlay_show, desc:'Show overlay widget', perms:['ui:overlay'] },
    { id:'overlay.hide', handler:overlay_hide, desc:'Hide overlay widget', perms:['ui:overlay'] },
    { id:'overlay.list', handler:overlay_list, desc:'List visible overlays', perms:['ui:overlay'] },
    { id:'overlay.notify', handler:overlay_notify, desc:'Show notification', perms:['ui:overlay','ui:notification'] },
    { id:'overlay.health', handler:overlay_health, desc:'Health check', perms:[] },
  ];
  for (const a of actions) {
    actionEngine.registerAction({ actionId:a.id, pluginId:context.pluginId, description:a.desc, permissions:a.perms, parameters:{}, returnType:'json' }, a.handler);
    registeredActionIds.push(a.id);
  }
  enabled = true;
}

async function deactivate(context) {
  if (actionEngine) { for (const id of registeredActionIds) actionEngine.unregisterAction(id); }
  registeredActionIds = [];
  overlays = [];
  enabled = false;
}

function health() { return { enabled, activeOverlays: overlays.filter(o => o.visible).length }; }
module.exports = { activate, deactivate, health };
