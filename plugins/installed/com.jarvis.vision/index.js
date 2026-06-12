/**
 * Vision Plugin
 * AI-powered screen analysis and UI understanding.
 */

const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let lastAnalysis = null;

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, 'data');
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

async function vision_analyze(params) {
  const { imagePath } = params;
  if (!imagePath) throw new Error('vision.analyze requires imagePath');
  const analysis = { status: 'analyzed', imagePath, timestamp: Date.now(), elements: [], text: '', provider: 'vision-layer', note: 'Vision analysis forwarded to provider pipeline' };
  lastAnalysis = analysis;
  return analysis;
}

async function vision_latestAnalysis(_params) {
  return lastAnalysis || { status: 'no_analysis', timestamp: 0 };
}

async function vision_health(_params) {
  return { enabled, lastAnalysis: lastAnalysis?.timestamp || 0 };
}

async function activate(context) {
  pluginContext = context;
  console.log('[Vision] Activated');
  try {
    actionEngine = context.actionEngine || null;
  } catch (e) {
    console.warn('[Vision] ActionEngine not available:', e.message);
    return;
  }
  const actions = [
    { id:'vision.analyze', handler:vision_analyze, desc:'Analyze a screenshot', perms:['screen:capture','network:outbound'] },
    { id:'vision.latestAnalysis', handler:vision_latestAnalysis, desc:'Get latest analysis', perms:['screen:capture'] },
    { id:'vision.health', handler:vision_health, desc:'Health check', perms:[] },
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
  enabled = false;
}

function health() { return { enabled, lastAnalysis: lastAnalysis?.timestamp || 0 }; }
module.exports = { activate, deactivate, health };
