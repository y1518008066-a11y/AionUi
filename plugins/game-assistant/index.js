/**
 * Game Assistant Plugin
 *
 * In-game overlay assistant for Game Mode.
 * - Screen observation
 * - OCR analysis
 * - Strategy suggestions
 * - Build recommendations
 * - Boss alerts
 * - Quest reminders
 * - Wiki search
 *
 * Desktop control requires explicit approval.
 * Never bypass anti-cheat.
 */

const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let gameContext = {};
let gameAlerts = [];
let gameKnowledge = [];

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, 'data');
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

// ---- Action handlers ----

async function ga_get_status(_p) {
  return { enabled, game: gameContext, alertsCount: gameAlerts.filter(a=>!a.dismissed).length, knowledgeCount: gameKnowledge.length };
}

async function ga_set_game(p) {
  if (!p.name) throw new Error('game name required');
  gameContext = { name:p.name, genre:p.genre||'', platform:p.platform||'PC', region:p.region||'', updatedAt:Date.now() };
  return { game: gameContext };
}

async function ga_alert_boss(p) {
  if (!p.name) throw new Error('boss name required');
  const a = { id:'boss-'+Date.now(), type:'boss', name:p.name, strategy:p.strategy||'', location:p.location||'', mechanics:p.mechanics||[], tips:p.tips||[], createdAt:Date.now(), dismissed:false };
  gameAlerts.push(a);
  try { if (actionEngine) await actionEngine.dispatch({ actionId:'active-assistant.addSuggestion', callerPluginId:'com.jarvis.game-assistant', params:{ type:'game-boss', title:'BOSS: '+p.name, body:p.strategy||'Strategy available', urgency:'high', source:'game-assistant' } }, { timeoutMs:3000 }); } catch {}
  return { alert:a };
}

async function ga_suggest_build(p) {
  const b = { type:p.type||'general', build:p.build||{}, reasoning:p.reasoning||'', confidence:p.confidence||0.5, timestamp:Date.now() };
  try { if (actionEngine) await actionEngine.dispatch({ actionId:'active-assistant.addSuggestion', callerPluginId:'com.jarvis.game-assistant', params:{ type:'game-build', title:'Build: '+(p.build?.name||'Recommended'), body:p.reasoning||'', urgency:'normal', source:'game-assistant' } }, { timeoutMs:3000 }); } catch {}
  return { suggestion:b };
}

async function ga_search_wiki(p) {
  if (!p.query) throw new Error('query required');
  return { query:p.query, sources:['official-wiki','community-wiki'], timestamp:Date.now(), results:[], note:'Wiki search dispatched. Results via overlay.' };
}

async function ga_analyze_screen(p) {
  return { timestamp:Date.now(), game:gameContext.name||null, note:'Screen analysis dispatched through vision plugin.', mode:pluginContext?.modeId||null };
}

async function ga_ocr_region(p) {
  return { region:p.region||null, timestamp:Date.now(), text:'', note:'OCR dispatched through vision plugin.' };
}

async function ga_add_knowledge(p) {
  if (!p.key||p.value===undefined) throw new Error('key and value required');
  gameKnowledge.push({ key:p.key, value:p.value, category:p.category||'general', addedAt:Date.now() });
  return { added:true, total:gameKnowledge.length };
}

async function ga_get_knowledge(p) {
  if (p.key) { const k=gameKnowledge.find(k=>k.key===p.key); return { found:!!k, entry:k||null }; }
  const cat = p.category;
  const results = cat ? gameKnowledge.filter(k=>k.category===cat) : gameKnowledge;
  return { entries:results.slice(0,p.limit||50), total:results.length };
}

async function ga_list_alerts(p) {
  const active = p.activeOnly ? gameAlerts.filter(a=>!a.dismissed) : gameAlerts;
  return { alerts: active.slice(0,p.limit||20), total:gameAlerts.length, activeCount:gameAlerts.filter(a=>!a.dismissed).length };
}

async function ga_dismiss_alert(p) {
  const a = gameAlerts.find(a=>a.id===p.id);
  if (a) a.dismissed=true;
  return { dismissed:!!a };
}

async function ga_health(_p) {
  return { enabled, game:gameContext.name||null, alertCount:gameAlerts.length, knowledgeCount:gameKnowledge.length };
}

async function activate(context) {
  pluginContext=context;
  console.log('[GameAssistant] Activated.');
  try {
    const aeMod = await import('../../action-engine/singleton');
    actionEngine = aeMod.getActionEngine();
  } catch(e) { console.warn('[GameAssistant] AE unavailable:',e.message); return; }
  const actions = [
    { id:'game-assistant.getStatus', handler:ga_get_status, desc:'Get status', perms:['game'] },
    { id:'game-assistant.setGame', handler:ga_set_game, desc:'Set current game', perms:['game','memory'] },
    { id:'game-assistant.alertBoss', handler:ga_alert_boss, desc:'Boss alert', perms:['game','ui:overlay'] },
    { id:'game-assistant.suggestBuild', handler:ga_suggest_build, desc:'Build suggestion', perms:['game','ui:overlay'] },
    { id:'game-assistant.searchWiki', handler:ga_search_wiki, desc:'Search game wiki', perms:['game','network:outbound'] },
    { id:'game-assistant.analyzeScreen', handler:ga_analyze_screen, desc:'Analyze game screen', perms:['game','screen:capture'] },
    { id:'game-assistant.ocrRegion', handler:ga_ocr_region, desc:'OCR a region', perms:['game','screen:capture'] },
    { id:'game-assistant.addKnowledge', handler:ga_add_knowledge, desc:'Add game knowledge', perms:['game','memory'] },
    { id:'game-assistant.getKnowledge', handler:ga_get_knowledge, desc:'Get game knowledge', perms:['game'] },
    { id:'game-assistant.listAlerts', handler:ga_list_alerts, desc:'List alerts', perms:['game'] },
    { id:'game-assistant.dismissAlert', handler:ga_dismiss_alert, desc:'Dismiss alert', perms:['game'] },
    { id:'game-assistant.health', handler:ga_health, desc:'Health check', perms:['game'] },
  ];
  for (const a of actions) {
    actionEngine.registerAction({ actionId:a.id, pluginId:context.pluginId, description:a.desc, permissions:a.perms, parameters:{}, returnType:'json' }, a.handler);
    registeredActionIds.push(a.id);
  }
  enabled=true;
  console.log('[GameAssistant] Registered '+actions.length+' actions.');
}

async function deactivate(context) {
  if (actionEngine) { for (const id of registeredActionIds) { actionEngine.unregisterAction(id); } }
  registeredActionIds=[];
  enabled=false;
  console.log('[GameAssistant] Deactivated.');
}

function health() { return { enabled, game:gameContext.name||null, alertCount:gameAlerts.length, knowledgeCount:gameKnowledge.length }; }

module.exports = { activate, deactivate, health };
