/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TASK-0021 E2E Smoke Test — Persistence + Orchestration
 *
 * Verifies:
 *   1. JarvisConfigService saves and loads persistent config
 *   2. ModeManager uses persistent config for plugin orchestration
 *   3. Changing config takes effect on next mode switch
 *   4. Reset to defaults works
 *   5. Round-trip: save → reload → verify
 *
 * Usage: bun run scripts/smoke-persistence.ts
 */

import { JarvisConfigService, getJarvisConfig, resetJarvisConfig, buildDefaultSettings } from "../config/jarvis-config";
import { ModeManager } from "../mode-system";
import { PluginManager } from "../plugin-marketplace";
import { getActionEngine, resetActionEngine } from "../action-engine/singleton";
import type { IEventBus } from "../jarvis-core/interfaces";
import { existsSync, unlinkSync } from "fs";

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
// Mini plugin factory (same pattern as smoke-orchestration.ts)
// ---------------------------------------------------------------------------

function createMiniPlugin(id: string, name: string, actionIds: string[]) {
  const actions = actionIds.map((aid) => ({ id: aid, registered: false }));

  return {
    manifest: {
      id, name, version: "1.0.0", author: "test",
      description: "Test plugin", entry: "index.js",
      permissions: [], dependencies: [], capabilities: [],
      minimumJarvisVersion: "2.0.0", enabledByDefault: false,
    },
    directory: `plugins/installed/${id}`,
    status: "discovered" as const,
    exports: null, lastError: null, loadedAt: null,
    reloadCount: 0, enabled: false, loadTimeMs: 0,

    async activate() {
      const engine = getActionEngine();
      for (const action of actions) {
        engine.registerAction(
          { id: action.id, pluginId: id, description: `Test action ${action.id}`, permissions: [], parameters: [], returnType: { type: "string", description: "result" } },
          async () => "ok"
        );
        action.registered = true;
      }
    },

    async deactivate() {
      const engine = getActionEngine();
      for (const action of actions) {
        engine.unregisterAction(action.id);
        action.registered = false;
      }
    },

    get actions() { return actions; },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("TASK-0021 E2E Smoke Test — Persistence + Orchestration");
  console.log("=".repeat(60));
  console.log("");

  // Clean slate
  resetActionEngine();
  resetJarvisConfig();

  // Remove any existing config file for clean test
  const configPath = "config/jarvis-settings.json";
  if (existsSync(configPath)) {
    unlinkSync(configPath);
    console.log("  Cleaned existing config file.");
  }

  // -----------------------------------------------------------------------
  // STEP 1: JarvisConfigService — Create + Save
  // -----------------------------------------------------------------------
  console.log("--- Step 1: JarvisConfigService — Create & Save ---");

  const config = getJarvisConfig();
  assert(config.getSource() === "defaults", "Config source is 'defaults' (no disk file)");

  // Get default mode plugins
  const defaultPlugins = config.getModePlugins("default");
  assert(defaultPlugins.length === 3, "Default mode has 3 plugins (built-in)");
  assert(defaultPlugins.includes("com.jarvis.memory"), "Default mode includes memory");

  // Customize work mode
  config.setModePlugins("work", [
    "com.jarvis.browser",
    "com.jarvis.memory",
    "com.jarvis.voice",
  ]);
  assert(config.getSource() === "disk", "Config source is 'disk' after save");

  // Verify the change
  const workPlugins = config.getModePlugins("work");
  assert(workPlugins.length === 3, "Work mode has 3 custom plugins");
  assert(workPlugins.includes("com.jarvis.browser"), "Work mode includes browser");
  assert(!workPlugins.includes("com.jarvis.scheduler"), "Work mode does NOT include scheduler (customized)");

  // Add/remove individual plugins
  config.addPluginToMode("game", "com.jarvis.ocr");
  const gamePlugins = config.getModePlugins("game");
  assert(gamePlugins.includes("com.jarvis.ocr"), "Game mode now includes ocr (added)");

  config.removePluginFromMode("game", "com.jarvis.ocr");
  const gamePlugins2 = config.getModePlugins("game");
  assert(!gamePlugins2.includes("com.jarvis.ocr"), "Game mode no longer includes ocr (removed)");

  // Active mode / provider persistence
  config.setActiveModeId("work");
  assert(config.getActiveModeId() === "work", "Active mode persisted");
  config.setActiveProviderId("openai");
  assert(config.getActiveProviderId() === "openai", "Active provider persisted");
  config.setActiveModel("gpt-4o");
  assert(config.getActiveModel() === "gpt-4o", "Active model persisted");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 2: Reload from disk
  // -----------------------------------------------------------------------
  console.log("--- Step 2: Reload from Disk ---");

  resetJarvisConfig();
  const config2 = getJarvisConfig();
  assert(config2.getSource() === "disk", "Reloaded config source is 'disk'");

  const reloadedWork = config2.getModePlugins("work");
  assert(reloadedWork.length === 3, "Reloaded work mode has 3 plugins");
  assert(reloadedWork.includes("com.jarvis.browser"), "Custom browser setting survived reload");
  assert(!reloadedWork.includes("com.jarvis.scheduler"), "Custom no-scheduler setting survived reload");

  assert(config2.getActiveModeId() === "work", "Active mode survived reload");
  assert(config2.getActiveProviderId() === "openai", "Active provider survived reload");
  assert(config2.getActiveModel() === "gpt-4o", "Active model survived reload");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 3: Reset to defaults
  // -----------------------------------------------------------------------
  console.log("--- Step 3: Reset to Defaults ---");

  config2.resetToDefaults();
  assert(config2.getSource() === "disk", "Source is disk after reset (defaults written to file)");

  const resetWork = config2.getModePlugins("work");
  assert(resetWork.length === 6, "Work mode restored to 6 built-in plugins");
  assert(resetWork.includes("com.jarvis.scheduler"), "Work mode has scheduler again (reset)");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 4: ModeManager with persistent config
  // -----------------------------------------------------------------------
  console.log("--- Step 4: ModeManager + Persistent Config ---");

  resetActionEngine();
  resetJarvisConfig();

  // Remove config file for this test
  if (existsSync(configPath)) unlinkSync(configPath);

  const config3 = getJarvisConfig();
  const eventBus = createMockEventBus();
  const pluginManager = new PluginManager("plugins");
  const modeManager = new ModeManager(eventBus);

  // Wire everything
  modeManager.setPluginManager(pluginManager);
  modeManager.setConfigService(config3);

  // Create mini plugins and inject
  const allMiniPlugins = [
    createMiniPlugin("com.jarvis.memory", "Memory", ["memory.store"]),
    createMiniPlugin("com.jarvis.browser", "Browser", ["browser.open"]),
    createMiniPlugin("com.jarvis.scheduler", "Scheduler", ["scheduler.create"]),
    createMiniPlugin("com.jarvis.voice", "Voice", ["voice.speak"]),
    createMiniPlugin("com.jarvis.clipboard", "Clipboard", ["clipboard.read"]),
    createMiniPlugin("com.jarvis.overlay", "Overlay", ["overlay.show"]),
    createMiniPlugin("com.jarvis.computer-use", "Computer Use", ["computer.screenshot"]),
  ];

  const loader = pluginManager.getLoader();
  for (const mp of allMiniPlugins) {
    loader["plugins"].set(mp.manifest.id, mp);
  }

  // Override loader methods
  const origLoad = loader.load.bind(loader);
  const origEnable = loader.enable.bind(loader);
  const origDisable = loader.disable.bind(loader);

  loader.load = async (pluginId: string): Promise<boolean> => {
    const p = loader["plugins"].get(pluginId);
    if (!p || !allMiniPlugins.includes(p)) return origLoad(pluginId);
    p.status = "loaded";
    p.loadedAt = Date.now();
    p.loadTimeMs = 1;
    return true;
  };

  loader.enable = async (pluginId: string): Promise<boolean> => {
    const p = loader["plugins"].get(pluginId);
    if (!p || !allMiniPlugins.includes(p)) return origEnable(pluginId);
    if (p.enabled) return true;
    p.status = "loaded";
    p.loadedAt = Date.now();
    if (p.activate) await p.activate();
    p.enabled = true;
    p.status = "enabled";
    return true;
  };

  loader.disable = async (pluginId: string): Promise<boolean> => {
    const p = loader["plugins"].get(pluginId);
    if (!p || !allMiniPlugins.includes(p)) return origDisable(pluginId);
    if (!p.enabled) return false;
    if (p.deactivate) await p.deactivate();
    p.enabled = false;
    p.status = "disabled";
    return true;
  };

  // Initialize (triggers Default mode with built-in defaults)
  await modeManager.initialize();

  // Default mode should have 3 plugins (built-in defaults since no persistent config yet)
  const defaultEnabled = pluginManager.listEnabled();
  assert(defaultEnabled.length === 3, "Default mode: 3 plugins from built-in defaults");
  assert(defaultEnabled.includes("com.jarvis.memory"), "memory enabled");
  assert(defaultEnabled.includes("com.jarvis.scheduler"), "scheduler enabled");
  assert(defaultEnabled.includes("com.jarvis.clipboard"), "clipboard enabled");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 5: Customize config → switch mode → verify
  // -----------------------------------------------------------------------
  console.log("--- Step 5: Custom Config Takes Effect on Mode Switch ---");

  // Customize work mode to only have 2 plugins
  config3.setModePlugins("work", [
    "com.jarvis.browser",
    "com.jarvis.voice",
  ]);

  // Switch to work mode — should only enable these 2
  await modeManager.switchMode("work");

  const workEnabled = pluginManager.listEnabled();
  assert(workEnabled.length === 2, "Work mode: 2 custom plugins enabled");
  assert(workEnabled.includes("com.jarvis.browser"), "browser enabled (custom)");
  assert(workEnabled.includes("com.jarvis.voice"), "voice enabled (custom)");
  assert(!workEnabled.includes("com.jarvis.scheduler"), "scheduler NOT enabled (customized out)");
  assert(!workEnabled.includes("com.jarvis.memory"), "memory NOT enabled (customized out)");
  assert(!workEnabled.includes("com.jarvis.clipboard"), "clipboard NOT enabled (customized out)");

  // Verify ActionEngine reflects the change
  const engine = getActionEngine();
  const actions = engine.listActions();
  assert(actions.some((a) => a.id === "browser.open"), "browser.open action registered");
  assert(actions.some((a) => a.id === "voice.speak"), "voice.speak action registered");
  assert(!actions.some((a) => a.id === "memory.store"), "memory.store NOT registered");
  assert(!actions.some((a) => a.id === "scheduler.create"), "scheduler.create NOT registered");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 6: Persist config → reload → re-initialize → verify
  // -----------------------------------------------------------------------
  console.log("--- Step 6: Round-Trip Persistence ---");

  const config4 = getJarvisConfig();
  // Verify what was persisted
  const persistedWork = config4.getModePlugins("work");
  assert(persistedWork.length === 2, "Persisted work mode has 2 plugins");
  assert(persistedWork.includes("com.jarvis.browser"), "browser in persisted config");

  // Diagnostics
  const diag = config4.getDiagnostics() as Record<string, unknown>;
  assert(diag.source === "disk", "Diagnostics: source = disk");
  assert(typeof diag.path === "string", "Diagnostics: path exists");
  assert(typeof diag.updatedAt === "number", "Diagnostics: updatedAt exists");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 7: Switch back to Default (still uses built-in defaults since we didn't customize it)
  // -----------------------------------------------------------------------
  console.log("--- Step 7: Switch to Default (no custom config) ---");

  await modeManager.switchMode("default");
  const defaultEnabled2 = pluginManager.listEnabled();
  assert(defaultEnabled2.length === 3, "Default mode: 3 plugins (built-in, no custom config)");
  assert(defaultEnabled2.includes("com.jarvis.memory"), "memory enabled");
  assert(defaultEnabled2.includes("com.jarvis.scheduler"), "scheduler enabled");
  assert(defaultEnabled2.includes("com.jarvis.clipboard"), "clipboard enabled");
  console.log("");

  // -----------------------------------------------------------------------
  // Final
  // -----------------------------------------------------------------------
  console.log("=".repeat(60));
  console.log(`Final Result: ${testsFailed === 0 ? "PASS" : "FAIL"}`);
  console.log(`Tests: ${testsPassed} passed, ${testsFailed} failed`);
  console.log("=".repeat(60));

  // Cleanup test config file
  if (existsSync(configPath)) {
    unlinkSync(configPath);
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});


