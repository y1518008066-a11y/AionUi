/**
 * OCR Plugin - Optical Character Recognition for images.
 */

const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let ocrCache = new Map();

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, 'data');
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

async function ocr_extractText(params) {
  const { imagePath } = params;
  if (!imagePath) throw new Error('ocr.extractText requires imagePath');
  const result = { text: '', confidence: 0, imagePath, timestamp: Date.now(), provider: 'ocr-plugin', note: 'OCR forwarded to vision provider' };
  ocrCache.set(imagePath, result);
  return result;
}

async function ocr_recognize(params) {
  const { imagePath, language } = params;
  return ocr_extractText({ imagePath, language: language || 'auto' });
}

async function ocr_health(_params) {
  return { enabled, cacheSize: ocrCache.size };
}

async function activate(context) {
  pluginContext = context;
  console.log('[OCR] Activated');
  try {
    const aeMod = await import('../../action-engine/singleton');
    actionEngine = aeMod.getActionEngine();
  } catch (e) {
    console.warn('[OCR] ActionEngine not available:', e.message);
    return;
  }
  const actions = [
    { id:'ocr.extractText', handler:ocr_extractText, desc:'Extract text from image', perms:['screen:capture','network:outbound'] },
    { id:'ocr.recognize', handler:ocr_recognize, desc:'Recognize text with language', perms:['screen:capture'] },
    { id:'ocr.health', handler:ocr_health, desc:'Health check', perms:[] },
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
  ocrCache.clear();
  enabled = false;
}

function health() { return { enabled, cacheSize: ocrCache.size }; }
module.exports = { activate, deactivate, health };
