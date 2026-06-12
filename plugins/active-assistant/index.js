/**
 * Active Assistant Plugin
 *
 * Background observer that:
 * - Monitors screen via computer-use plugin
 * - Analyzes context via vision plugin
 * - Generates proactive suggestions
 * - Presents reminders via overlay
 * - NEVER executes dangerous actions without user approval
 *
 * Approval Levels:
 *   PASSIVE    — observe, analyze, remember (auto)
 *   ASSIST     — suggest, remind, recommend (auto)
 *   CONTROL    — click, keyboard, browser (approval req)
 *   AUTONOMOUS — continuous delegated (per-session approval)
 */

const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let observers = [];
let suggestions = [];
let sessionApproval = { control: false, autonomous: false };
let observerInterval = null;

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, 'data');
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

// ---- Action handlers ----

async function aa_get_status(_p) {
  return { enabled, observerCount: observers.length, suggestionCount: suggestions.filter(s=>!s.dismissed).length, approval: sessionApproval };
}

async function aa_add_observer(p) {
  if (!p.name||!p.type) throw new Error('name and type required');
  observers.push({ name:p.name, type:p.type, config:p.config||{}, addedAt:Date.now() });
  return { added:true, count: observers.length };
}

async function aa_remove_observer(p) {
  const before = observers.length;
  observers = observers.filter(o=>o.name!==p.name);
  return { removed: before-observers.length, count: observers.length };
}

async function aa_list_observers(_p) {
  return { observers, count: observers.length };
}

async function aa_get_suggestions(p) {
  let result = suggestions;
  if (p.type) result = result.filter(s=>s.type===p.type);
  if (p.activeOnly) result = result.filter(s=>!s.dismissed);
  return { suggestions: result.slice(0,p.limit||10), total: suggestions.length };
}

async function aa_add_suggestion(p) {
  if (!p.type||!p.title) throw new Error('type and title required');
  const s = { id:'sug-'+Date.now()+'-'+Math.random().toString(36).slice(2,8), type:p.type, title:p.title, body:p.body||'', action:p.action||null, urgency:p.urgency||'normal', source:p.source||'active-assistant', createdAt:Date.now(), dismissed:false, approved:false };
  suggestions.unshift(s);
  if (suggestions.length>200) suggestions=suggestions.slice(0,200);
  return { added:true, suggestion:s, total:suggestions.length };
}

async function aa_dismiss_suggestion(p) {
  const s = suggestions.find(s=>s.id===p.id);
  if (s) s.dismissed=true;
  return { dismissed:!!s };
}

async function aa_approve_suggestion(p) {
  const s = suggestions.find(s=>s.id===p.id);
  if (s) s.approved=true;
  if (p.level==='control') sessionApproval.control=true;
  if (p.level==='autonomous') sessionApproval.autonomous=true;
  return { approved:!!s, approval:sessionApproval };
}

async function aa_set_approval_level(p) {
  if (!p.level||typeof p.value!=='boolean') throw new Error('level and value required');
  if (p.level==='control'||p.level==='autonomous') sessionApproval[p.level]=p.value;
  return { approval:sessionApproval };
}

async function aa_analyze_context(p) {
  const result = { timestamp:Date.now(), mode:pluginContext?.modeId||null, observerCount:observers.length, suggestionCount:suggestions.filter(s=>!s.dismissed).length, approval:sessionApproval };
  if (p.includeScreen&&actionEngine) {
    try {
      const di = await actionEngine.dispatch({ actionId:'computer.getDisplays', callerPluginId:'com.jarvis.active-assistant', params:{} }, { timeoutMs:3000 });
      if (di.success) result.displays=di.data;
    } catch(e) { result.screenError = e.message; }
  }
  return result;
}

async function aa_health(_p) {
  return { enabled, observerCount:observers.length, suggestionCount:suggestions.length, activeSuggestions:suggestions.filter(s=>!s.dismissed).length, approval:sessionApproval, uptime:pluginContext?.startedAt?Date.now()-pluginContext.startedAt:0 };
}

function startObserver() {
  if (observerInterval) return;
  observerInterval = setInterval(() => { if(!enabled||observers.length===0) return; /* observation tick */ }, 5000);
}

function stopObserver() {
  if (observerInterval) { clearInterval(observerInterval); observerInterval=null; }
}

async function activate(context) {
  pluginContext=context;
  console.log('[ActiveAssistant] Activated.');
  try {
    const aeMod = await import('../../action-engine/singleton');
    actionEngine = aeMod.getActionEngine();
  } catch(e) { console.warn('[ActiveAssistant] AE unavailable:',e.message); return; }
  const actions = [
    { id:'active-assistant.getStatus', handler:aa_get_status, desc:'Get assistant status', perms:['assistant'] },
    { id:'active-assistant.addObserver', handler:aa_add_observer, desc:'Add context observer', perms:['assistant','screen:capture'] },
    { id:'active-assistant.removeObserver', handler:aa_remove_observer, desc:'Remove observer', perms:['assistant'] },
    { id:'active-assistant.listObservers', handler:aa_list_observers, desc:'List observers', perms:['assistant'] },
    { id:'active-assistant.getSuggestions', handler:aa_get_suggestions, desc:'Get suggestions', perms:['assistant'] },
    { id:'active-assistant.addSuggestion', handler:aa_add_suggestion, desc:'Add suggestion', perms:['assistant','ui:overlay'] },
    { id:'active-assistant.dismissSuggestion', handler:aa_dismiss_suggestion, desc:'Dismiss suggestion', perms:['assistant'] },
    { id:'active-assistant.approveSuggestion', handler:aa_approve_suggestion, desc:'Approve suggestion', perms:['assistant'] },
    { id:'active-assistant.setApprovalLevel', handler:aa_set_approval_level, desc:'Set approval level', perms:['assistant'] },
    { id:'active-assistant.analyzeContext', handler:aa_analyze_context, desc:'Analyze context', perms:['assistant','screen:capture'] },
    { id:'active-assistant.health', handler:aa_health, desc:'Health check', perms:['assistant'] },
  ];
  for (const a of actions) {
    actionEngine.registerAction({ actionId:a.id, pluginId:context.pluginId, description:a.desc, permissions:a.perms, parameters:{}, returnType:'json' }, a.handler);
    registeredActionIds.push(a.id);
  }
  enabled=true;
  startObserver();
  console.log('[ActiveAssistant] Registered '+actions.length+' actions.');
}

async function deactivate(context) {
  stopObserver();
  if (actionEngine) { for (const id of registeredActionIds) { actionEngine.unregisterAction(id); } }
  registeredActionIds=[];
  enabled=false;
  console.log('[ActiveAssistant] Deactivated.');
}

function health() { return { enabled, observerCount:observers.length, suggestionCount:suggestions.length, approval:sessionApproval }; }

module.exports = { activate, deactivate, health };
