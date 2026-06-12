/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TASK-0020 E2E Orchestration Smoke Test
 *
 * Verifies the full runtime pipeline:
 *   ModeManager.switchMode → PluginManager.enable/disable → ActionEngine registration
 *
 * Tests:
 *   1. ModeManager initializes with Default mode + plugin orchestration
 *   2. Switch to Work Mode enables configured plugins
 *   3. Plugins register actions on enable
 *   4. Plugin disable unregisters actions
 *   5. Switch to Game Mode enables configured plugins
 *   6. Switch back to Default disables non-default plugins
 *   7. Diagnostics reflect state changes
 *
 * Usage: bun run scripts/smoke-orchestration.ts
 */

import { ModeManager } from "../mode-system";
import { PluginManager } from "../plugin-marketplace";
import { getActionEngine, resetActionEngine } from "../action-engine/singleton";
import type { IEventBus } from "../jarvis-core/interfaces";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, label: string): boolean {
  if (condition) {
    console.log(`  ${PASS}  ${label}`);
    testsPassed++;
    return true;
  } else {
    console.log(`  ${FAIL}  ${label}`);
    testsFailed++;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mock EventBus
// ---------------------------------------------------------------------------

function createMockEventBus(): IEventBus {
  const events: Array<{ type: string; payload: unknown }> = [];
  return {
    emit(event: { type: string } & Record<string, unknown>): void {
      events.push({ type: event.type, payload: event });
    },
    on(_event: string, _handler: (...args: unknown[]) => void): void {},
    off(_event: string, _handler: (...args: unknown[]) => void): void {},
    get events() { return events; },
  } as IEventBus & { events: Array<{ type: string; payload: unknown }> };
}

// ---------------------------------------------------------------------------
// Mini plugin that registers actions on enable
// ---------------------------------------------------------------------------

function createMiniPlugin(id: string, name: string, actionIds: string[]) {
  const actions: Array<{ id: string; registered: boolean }> = actionIds.map((aid) => ({
    id: aid,
    registered: false,
  }));

  return {
    manifest: {
      id,
      name,
      version: "1.0.0",
      author: "test",
      description: "Test plugin for orchestration",
      entry: "index.js",
      permissions: [],
      dependencies: [],
      capabilities: [],
      minimumJarvisVersion: "2.0.0",
      enabledByDefault: false,
    },
    directory: `plugins/installed/${id}`,
    status: "discovered" as const,
    exports: null,
    lastError: null,
    loadedAt: null,
    reloadCount: 0,
    enabled: false,
    loadTimeMs: 0,

    async activate() {
      const engine = getActionEngine();
      for (const action of actions) {
        engine.registerAction(
          {
            id: action.id,
            pluginId: id,
            description: `Test action ${action.id}`,
            permissions: [],
            parameters: [],
            returnType: { type: "string", description: "result" },
          },
          async () => "ok"
        );
        action.registered = true;
      }
      console.log(`  [${id}] Activated: registered ${actions.length} actions`);
    },

    async deactivate() {
      const engine = getActionEngine();
      for (const action of actions) {
        engine.unregisterAction(action.id);
        action.registered = false;
      }
      console.log(`  [${id}] Deactivated: unregistered ${actions.length} actions`);
    },

    get actions() { return actions; },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("TASK-0020 E2E Orchestration Smoke Test");
  console.log("=".repeat(60));
  console.log("");

  // Reset singletons
  resetActionEngine();

  // -----------------------------------------------------------------------
  // STEP 1: Create ModeManager + PluginManager + wire them
  // -----------------------------------------------------------------------
  console.log("--- Step 1: Create & Wire ModeManager + PluginManager ---");

  const eventBus = createMockEventBus();
  const pluginManager = new PluginManager("plugins");

  // Create mini plugins and manually inject them into PluginLoader
  const memoryPlugin = createMiniPlugin("com.jarvis.memory", "Memory Plugin", [
    "memory.store",
    "memory.retrieve",
  ]);
  const browserPlugin = createMiniPlugin("com.jarvis.browser", "Browser Plugin", [
    "browser.open",
    "browser.navigate",
  ]);
  const voicePlugin = createMiniPlugin("com.jarvis.voice", "Voice Plugin", [
    "voice.speak",
    "voice.listen",
  ]);
  const overlayPlugin = createMiniPlugin("com.jarvis.overlay", "Overlay Plugin", [
    "overlay.show",
    "overlay.hide",
  ]);
  const schedulerPlugin = createMiniPlugin("com.jarvis.scheduler", "Scheduler Plugin", [
    "scheduler.create",
  ]);
  const clipboardPlugin = createMiniPlugin("com.jarvis.clipboard", "Clipboard Plugin", [
    "clipboard.read",
    "clipboard.write",
  ]);
  const computerUsePlugin = createMiniPlugin("com.jarvis.computer-use", "Computer Use Plugin", [
    "computer.screenshot",
    "computer.cursor",
  ]);

  // Inject plugins into PluginLoader's internal map
  const loader = pluginManager.getLoader();
  const allMiniPlugins = [
    memoryPlugin, browserPlugin, voicePlugin, overlayPlugin,
    schedulerPlugin, clipboardPlugin, computerUsePlugin,
  ];

  for (const mp of allMiniPlugins) {
    // Override PluginLoader methods for these test plugins
    // @ts-expect-error: accessing private map for test
    loader["plugins"].set(mp.manifest.id, mp);

    // Override load to "succeed" instantly
    const origLoad = loader.load.bind(loader);
    const origEnable = loader.enable.bind(loader);
    const origDisable = loader.disable.bind(loader);

    // Monkey-patch load to just mark as loaded
    loader.load = async (pluginId: string): Promise<boolean> => {
      const p = loader["plugins"].get(pluginId);
      if (!p || !allMiniPlugins.includes(p)) return origLoad(pluginId);
      p.status = "loaded";
      p.loadedAt = Date.now();
      p.loadTimeMs = 1;
      return true;
    };

    // Monkey-patch enable to call activate
    loader.enable = async (pluginId: string): Promise<boolean> => {
      const p = loader["plugins"].get(pluginId);
      if (!p || !allMiniPlugins.includes(p)) return origEnable(pluginId);
      if (p.enabled) return true;
      if (p.status !== "loaded") {
        p.status = "loaded";
        p.loadedAt = Date.now();
      }
      if (p.activate) await p.activate();
      p.enabled = true;
      p.status = "enabled";
      return true;
    };

    // Monkey-patch disable to call deactivate
    loader.disable = async (pluginId: string): Promise<boolean> => {
      const p = loader["plugins"].get(pluginId);
      if (!p || !allMiniPlugins.includes(p)) return origDisable(pluginId);
      if (!p.enabled) return false;
      if (p.deactivate) await p.deactivate();
      p.enabled = false;
      p.status = "disabled";
      return true;
    };
  }

  // Create ModeManager and wire it
  const modeManager = new ModeManager(eventBus);
  modeManager.setPluginManager(pluginManager);

  assert(true, "ModeManager created and wired to PluginManager");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 2: Initialize — register built-in modes, activate Default
  // -----------------------------------------------------------------------
  console.log("--- Step 2: Initialize ModeManager (Default Mode) ---");

  await modeManager.initialize();

  const defaultMode = modeManager.getActiveProfile();
  assert(defaultMode?.id === "default", "Default mode is active");
  assert(
    eventBus.events.some((e) => e.type === "mode:registered"),
    "Mode registered events emitted"
  );
  assert(
    eventBus.events.some((e) => e.type === "mode:changed"),
    "Mode changed event emitted (none → default)"
  );
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 3: Verify Default Mode's activePlugins are enabled
  // -----------------------------------------------------------------------
  console.log("--- Step 3: Default Mode Plugin Orchestration ---");

  // Default mode activePlugins: memory, scheduler, clipboard
  const defaultExpected = ["com.jarvis.memory", "com.jarvis.scheduler", "com.jarvis.clipboard"];
  for (const pid of defaultExpected) {
    const enabled = pluginManager.isEnabled(pid);
    assert(enabled, `Default mode enabled: ${pid}`);
  }

  // Verify non-default plugins are NOT enabled
  const notExpected = ["com.jarvis.browser", "com.jarvis.voice", "com.jarvis.overlay"];
  for (const pid of notExpected) {
    const enabled = pluginManager.isEnabled(pid);
    assert(!enabled, `Non-default plugin NOT enabled: ${pid}`);
  }
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 4: Verify actions are registered in ActionEngine
  // -----------------------------------------------------------------------
  console.log("--- Step 4: ActionEngine Registration After Enable ---");

  const engine = getActionEngine();
  const actions = engine.listActions();

  assert(
    actions.some((a) => a.id === "memory.store"),
    "memory.store action is registered"
  );
  assert(
    actions.some((a) => a.id === "scheduler.create"),
    "scheduler.create action is registered"
  );
  assert(
    actions.some((a) => a.id === "clipboard.read"),
    "clipboard.read action is registered"
  );

  // Browser actions should NOT be registered (browser plugin not enabled)
  assert(
    !actions.some((a) => a.id === "browser.open"),
    "browser.open is NOT registered (plugin disabled)"
  );

  console.log(`  ActionEngine has ${actions.length} registered actions`);
  assert(actions.length >= 5, "At least 5 actions registered (memory×2 + scheduler×1 + clipboard×2)");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 5: Switch to Work Mode
  // -----------------------------------------------------------------------
  console.log("--- Step 5: Switch to Work Mode ---");

  const eventCountBefore = eventBus.events.length;
  await modeManager.switchMode("work");

  let workMode = modeManager.getActiveProfile();
  assert(workMode?.id === "work", "Work mode is now active");

  // Verify mode:changed event
  const newEvents = eventBus.events.slice(eventCountBefore);
  assert(
    newEvents.some((e) => e.type === "mode:changed"),
    "Mode changed event emitted (default → work)"
  );

  // Work mode activePlugins: browser, memory, scheduler, overlay, voice, clipboard
  const workExpected = [
    "com.jarvis.browser", "com.jarvis.memory", "com.jarvis.scheduler",
    "com.jarvis.overlay", "com.jarvis.voice", "com.jarvis.clipboard",
  ];
  for (const pid of workExpected) {
    const enabled = pluginManager.isEnabled(pid);
    assert(enabled, `Work mode enabled: ${pid}`);
  }

  // computer-use should NOT be enabled in Work mode
  assert(
    !pluginManager.isEnabled("com.jarvis.computer-use"),
    "computer-use NOT enabled in Work mode"
  );
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 6: Verify Work Mode actions are in ActionEngine
  // -----------------------------------------------------------------------
  console.log("--- Step 6: ActionEngine After Work Mode ---");

  const workActions = engine.listActions();
  assert(
    workActions.some((a) => a.id === "browser.open"),
    "browser.open action is registered (Work mode)"
  );
  assert(
    workActions.some((a) => a.id === "voice.speak"),
    "voice.speak action is registered (Work mode)"
  );
  assert(
    workActions.some((a) => a.id === "overlay.show"),
    "overlay.show action is registered (Work mode)"
  );
  assert(
    !workActions.some((a) => a.id === "computer.screenshot"),
    "computer.screenshot is NOT registered (plugin disabled in Work mode)"
  );

  console.log(`  ActionEngine has ${workActions.length} registered actions`);
  assert(workActions.length >= 9, "At least 9 actions in Work mode");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 7: Switch to Game Mode
  // -----------------------------------------------------------------------
  console.log("--- Step 7: Switch to Game Mode ---");

  await modeManager.switchMode("game");
  const gameMode = modeManager.getActiveProfile();
  assert(gameMode?.id === "game", "Game mode is now active");

  // Game mode activePlugins: overlay, voice, computer-use, memory, vision
  const gameExpected = [
    "com.jarvis.overlay", "com.jarvis.voice",
    "com.jarvis.computer-use", "com.jarvis.memory",
  ];
  for (const pid of gameExpected) {
    const enabled = pluginManager.isEnabled(pid);
    assert(enabled, `Game mode enabled: ${pid}`);
  }

  // Browser + scheduler should be DISABLED (not in Game mode)
  assert(
    !pluginManager.isEnabled("com.jarvis.browser"),
    "browser disabled in Game mode"
  );
  assert(
    !pluginManager.isEnabled("com.jarvis.scheduler"),
    "scheduler disabled in Game mode"
  );
  assert(
    !pluginManager.isEnabled("com.jarvis.clipboard"),
    "clipboard disabled in Game mode"
  );
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 8: Verify Game Mode actions
  // -----------------------------------------------------------------------
  console.log("--- Step 8: ActionEngine After Game Mode ---");

  const gameActions = engine.listActions();
  assert(
    gameActions.some((a) => a.id === "computer.screenshot"),
    "computer.screenshot action is registered (Game mode)"
  );
  assert(
    gameActions.some((a) => a.id === "computer.cursor"),
    "computer.cursor action is registered (Game mode)"
  );
  assert(
    !gameActions.some((a) => a.id === "browser.open"),
    "browser.open is NOT registered (disabled in Game mode)"
  );
  assert(
    !gameActions.some((a) => a.id === "scheduler.create"),
    "scheduler.create is NOT registered (disabled in Game mode)"
  );
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 9: Switch back to Default
  // -----------------------------------------------------------------------
  console.log("--- Step 9: Switch Back to Default ---");

  await modeManager.switchMode("default");
  assert(modeManager.activeMode === "default", "Default mode is active again");

  // Verify non-default plugins are cleaned up
  assert(!pluginManager.isEnabled("com.jarvis.browser"), "browser disabled in Default");
  assert(!pluginManager.isEnabled("com.jarvis.voice"), "voice disabled in Default");
  assert(!pluginManager.isEnabled("com.jarvis.computer-use"), "computer-use disabled in Default");

  // Default plugins should still be enabled
  assert(pluginManager.isEnabled("com.jarvis.memory"), "memory still enabled in Default");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 10: Diagnostics
  // -----------------------------------------------------------------------
  console.log("--- Step 10: Diagnostics ---");

  const modeDiag = modeManager.getDiagnostics() as Record<string, unknown>;
  console.log(`  Active mode: ${modeDiag.activeModeId} (${modeDiag.activeModeLabel})`);
  console.log(`  Permission: ${modeDiag.activePermission}`);
  console.log(`  Registered modes: ${modeDiag.modeCount}`);

  const enabledPlugins = pluginManager.listEnabled();
  console.log(`  Enabled plugins: ${enabledPlugins.join(", ") || "(none)"}`);

  const registeredActions = engine.listActions();
  console.log(`  Registered actions: ${registeredActions.length}`);

  const engineDiag = engine.getDiagnostics();
  console.log(`  Total executions: ${engineDiag.totalExecutions}`);
  console.log(`  Success: ${engineDiag.totalSuccess}`);
  console.log(`  Failures: ${engineDiag.totalFailures}`);

  assert(modeDiag.activeModeId === "default", "Diagnostics: active mode = default");
  assert(enabledPlugins.length >= 3, "Diagnostics: at least 3 plugins enabled");
  assert(registeredActions.length >= 5, "Diagnostics: at least 5 actions registered");
  console.log("");

  // -----------------------------------------------------------------------
  // Final
  // -----------------------------------------------------------------------
  console.log("=".repeat(60));
  console.log(`Final Result: ${testsFailed === 0 ? "PASS" : "FAIL"}`);
  console.log(`Tests: ${testsPassed} passed, ${testsFailed} failed`);
  console.log("=".repeat(60));

  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
