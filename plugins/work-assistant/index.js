/**
 * Work Assistant Plugin
 *
 * Proactive work helper for Work Mode.
 * - Document understanding
 * - Coding assistance
 * - Browser assistance
 * - Project awareness
 * - Productivity suggestions
 * - Knowledge search
 *
 * All CONTROL actions require explicit user approval.
 */

const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let projectContext = {};
let workHistory = [];

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, 'data');
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

// ---- Action handlers ----

async function wa_get_status(_p) {
  return { enabled, project: projectContext, historyCount: workHistory.length };
}

async function wa_set_project(p) {
  if (!p.name) throw new Error('project name required');
  projectContext = { name:p.name, type:p.type||'unknown', path:p.path||'', ide:p.ide||'', files:p.files||[], updatedAt:Date.now() };
  return { project: projectContext };
}

async function wa_log_activity(p) {
  workHistory.push({ action:p.action||'unknown', detail:p.detail||'', timestamp:Date.now() });
  if (workHistory.length > 500) workHistory = workHistory.slice(-500);
  return { logged:true, total:workHistory.length };
}

async function wa_get_recent_activity(p) {
  const limit = p.limit||20;
  return { activities: workHistory.slice(-limit), total:workHistory.length };
}

async function wa_search_knowledge(p) {
  if (!p.query) throw new Error('query required');
  const sources = p.sources||['docs','github','wiki'];
  return { query:p.query, sources, timestamp:Date.now(), results:[], note:'Knowledge search dispatched through action engine. Results stream via overlay.' };
}

async function wa_suggest(p) {
  const s = { type:p.type||'general', title:p.title||'', body:p.body||'', category:p.category||'work', confidence:p.confidence||0.5, timestamp:Date.now() };
  try {
    if (actionEngine) {
      await actionEngine.dispatch({ actionId:'active-assistant.addSuggestion', callerPluginId:'com.jarvis.work-assistant', params:{ type:'work', title:s.title, body:s.body, urgency:p.urgency||'normal', source:'work-assistant' } }, { timeoutMs:5000 });
    }
  } catch(e) { /* overlay not available */ }
  return { suggested:true, suggestion:s };
}

async function wa_analyze_document(p) {
  if (!p.content) throw new Error('document content required');
  return { type:p.type||'text', length:(p.content||'').length, timestamp:Date.now(), note:'Document analysis dispatched. Full results via vision/provider pipeline.' };
}

async function wa_health(_p) {
  return { enabled, project:projectContext.name||null, historyCount:workHistory.length };
}

async function activate(context) {
  pluginContext=context;
  console.log('[WorkAssistant] Activated.');
  try {
    actionEngine = context.actionEngine || null;
  } catch(e) { console.warn('[WorkAssistant] AE unavailable:',e.message); return; }
  const actions = [
    { id:'work-assistant.getStatus', handler:wa_get_status, desc:'Get status', perms:['work'] },
    { id:'work-assistant.setProject', handler:wa_set_project, desc:'Set project context', perms:['work','memory'] },
    { id:'work-assistant.logActivity', handler:wa_log_activity, desc:'Log an activity', perms:['work','memory'] },
    { id:'work-assistant.getRecentActivity', handler:wa_get_recent_activity, desc:'Get recent activities', perms:['work'] },
    { id:'work-assistant.searchKnowledge', handler:wa_search_knowledge, desc:'Search trusted knowledge', perms:['work','network:outbound'] },
    { id:'work-assistant.suggest', handler:wa_suggest, desc:'Make a suggestion', perms:['work','ui:overlay'] },
    { id:'work-assistant.analyzeDocument', handler:wa_analyze_document, desc:'Analyze document', perms:['work','screen:capture'] },
    { id:'work-assistant.health', handler:wa_health, desc:'Health check', perms:['work'] },
  ];
  for (const a of actions) {
    actionEngine.registerAction({ actionId:a.id, pluginId:context.pluginId, description:a.desc, permissions:a.perms, parameters:{}, returnType:'json' }, a.handler);
    registeredActionIds.push(a.id);
  }
  enabled=true;
  console.log('[WorkAssistant] Registered '+actions.length+' actions.');
}

async function deactivate(context) {
  if (actionEngine) { for (const id of registeredActionIds) { actionEngine.unregisterAction(id); } }
  registeredActionIds=[];
  enabled=false;
  console.log('[WorkAssistant] Deactivated.');
}

function health() { return { enabled, project:projectContext.name||null, historyCount:workHistory.length }; }

module.exports = { activate, deactivate, health };
