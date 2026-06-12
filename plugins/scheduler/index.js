/**
 * Scheduler Plugin
 *
 * Provides task scheduling through ActionEngine.
 * Tasks are stored in-memory with JSON persistence.
 *
 * Registered actions:
 *   scheduler.create(name, delayMs, repeat)
 *   scheduler.cancel(taskId)
 *   scheduler.list()
 *   scheduler.get(taskId)
 */

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let tasks = {};
let nextTaskId = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, "data");
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

function getStorePath() {
  return join(getDataDir(), "scheduler.json");
}

function loadTasks() {
  try {
    if (existsSync(getStorePath())) {
      const data = JSON.parse(readFileSync(getStorePath(), "utf-8"));
      tasks = data.tasks || {};
      nextTaskId = data.nextTaskId || 1;
    }
  } catch (e) {
    console.warn("[Scheduler] Failed to load tasks:", e.message);
  }
}

function saveTasks() {
  try {
    writeFileSync(getStorePath(), JSON.stringify({ tasks, nextTaskId }, null, 2), "utf-8");
  } catch (e) {
    console.error("[Scheduler] Failed to save tasks:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function scheduler_create(params) {
  const { name, delayMs, repeat } = params;
  if (!name) throw new Error("scheduler.create requires 'name' parameter");

  const id = String(nextTaskId++);
  const timeout = delayMs || 0;
  let timer = null;

  const task = {
    id,
    name,
    delayMs: timeout,
    repeat: repeat || false,
    createdAt: Date.now(),
    status: "pending",
    runCount: 0,
  };

  if (timeout > 0) {
    const handler = () => {
      task.status = "running";
      task.runCount++;
      task.lastRunAt = Date.now();
      console.log("[Scheduler] Task '" + name + "' (id=" + id + ") executed. Run count: " + task.runCount);
      task.status = "completed";
      saveTasks();
      if (!task.repeat) {
        delete tasks[id];
        saveTasks();
      } else {
        task.timer = setTimeout(handler, timeout);
      }
    };
    task.timer = setTimeout(handler, timeout);
  }

  tasks[id] = task;
  saveTasks();

  return { created: true, taskId: id, name, delayMs: timeout, repeat: repeat || false };
}

async function scheduler_cancel(params) {
  const { taskId } = params;
  if (!taskId) throw new Error("scheduler.cancel requires 'taskId' parameter");

  const task = tasks[taskId];
  if (!task) return { cancelled: false, reason: "Task not found" };

  if (task.timer) clearTimeout(task.timer);
  delete tasks[taskId];
  saveTasks();

  return { cancelled: true, taskId, name: task.name };
}

async function scheduler_list(_params) {
  const list = Object.values(tasks).map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    delayMs: t.delayMs,
    repeat: t.repeat,
    runCount: t.runCount,
    createdAt: t.createdAt,
  }));
  return { tasks: list, count: list.length };
}

async function scheduler_get(params) {
  const { taskId } = params;
  if (!taskId) throw new Error("scheduler.get requires 'taskId' parameter");
  const task = tasks[taskId];
  return task ? { ...task, timer: undefined } : null;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function activate(context) {
  pluginContext = context;
  loadTasks();
  console.log("[Scheduler] Activated. Data dir:", getDataDir(), "| Tasks:", Object.keys(tasks).length);

  try {
    actionEngine = context.actionEngine || null;
  } catch (e) {
    console.warn("[Scheduler] ActionEngine not available:", e.message);
    return;
  }

  const actions = [
    { id: "scheduler.create", handler: scheduler_create, description: "Schedule a task", permissions: ["scheduler"] },
    { id: "scheduler.cancel", handler: scheduler_cancel, description: "Cancel a scheduled task", permissions: ["scheduler"] },
    { id: "scheduler.list", handler: scheduler_list, description: "List all tasks", permissions: ["scheduler"] },
    { id: "scheduler.get", handler: scheduler_get, description: "Get task details", permissions: ["scheduler"] },
  ];

  for (const a of actions) {
    actionEngine.registerAction(
      { actionId: a.id, pluginId: context.pluginId, description: a.description, permissions: a.permissions, parameters: {}, returnType: "json" },
      a.handler
    );
    registeredActionIds.push(a.id);
  }

  enabled = true;
  console.log("[Scheduler] Registered " + actions.length + " actions.");
}

async function deactivate(context) {
  if (actionEngine) {
    for (const id of registeredActionIds) {
      actionEngine.unregisterAction(id);
    }
  }
  registeredActionIds = [];
  enabled = false;
  console.log("[Scheduler] Deactivated.");
}

function health() {
  return { enabled, tasks: Object.keys(tasks).length, dataDir: getDataDir() };
}

module.exports = { activate, deactivate, health };
