/**
 * Voice Plugin - Speech-to-text and text-to-speech.
 */

const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let transcripts = [];

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, 'data');
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

async function voice_speak(params) {
  const { text, voice } = params;
  if (!text) throw new Error('voice.speak requires text');
  console.log('[Voice] speak:', text);
  return { spoken: true, text, voice: voice || 'default', timestamp: Date.now() };
}

async function voice_listen(params) {
  const { duration } = params || {};
  console.log('[Voice] listen requested, duration:', duration);
  return { transcript: '', listening: true, note: 'Voice capture requires system audio input' };
}

async function voice_transcripts(_params) {
  return { transcripts, count: transcripts.length };
}

async function voice_health(_params) {
  return { enabled, transcripts: transcripts.length };
}

async function activate(context) {
  pluginContext = context;
  console.log('[Voice] Activated');
  try {
    actionEngine = context.actionEngine || null;
  } catch (e) {
    console.warn('[Voice] ActionEngine not available:', e.message);
    return;
  }
  const actions = [
    { id:'voice.speak', handler:voice_speak, desc:'Convert text to speech', perms:['audio:output'] },
    { id:'voice.listen', handler:voice_listen, desc:'Listen and transcribe', perms:['audio:input'] },
    { id:'voice.transcripts', handler:voice_transcripts, desc:'Get transcript history', perms:['audio:input'] },
    { id:'voice.health', handler:voice_health, desc:'Health check', perms:[] },
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

function health() { return { enabled, transcripts: transcripts.length }; }
module.exports = { activate, deactivate, health };
