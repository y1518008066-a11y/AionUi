/**
 * System Wiring Layer 鈥?Full Initializer
 *
 * Bootstraps ALL Jarvis subsystems in dependency order:
 *
 *   1. jarvis-core       (EventBus + registries)
 *   2. action-engine     (Action registry + dispatcher)
 *   3. ai-router         (Provider routing)
 *   4. provider-manager  (Auto-discovery + health)
 *   5. provider-center   (Persistence + activation)
 *   6. plugin-marketplace (Plugin lifecycle)
 *   7. mode-system       (Mode registry + orchestration)
 *   8. execution-bridge  (Execution abstraction)
 *   9. adapters          (BackendManager)
 *  10. system-wiring     (Event connections + ModeManager wiring)
 *
 * Each stage is timed. Failures are isolated per subsystem.
 * Never throws 鈥?reports failures through diagnostics.
 */

import { initializeJarvisCore } from '../jarvis-core/index';
import type { IJarvisCore } from '../jarvis-core/interfaces';
import { createAIRouter } from '../ai-router/index';
import type { AIRouter } from '../ai-router/router';
import { ExecutionBridge } from '../execution-bridge/index';
import { PluginManager as PluginMarketplaceManager } from '../plugin-marketplace/index';
import { ModeManager } from '../mode-system/index';
import { ProviderManager } from '../provider-manager/index';
import { ProviderCenter } from '../provider-center/index';
import { getActionEngine, resetActionEngine } from '../action-engine/singleton';
import { getBackendManager, resetBackendManager } from '../adapters/backend-manager';
import { PlaywrightBrowserBackend } from '../adapters/playwright-backend';
import { LocalComputerUseBackend } from '../adapters/local-computer-use-backend';
import { getJarvisConfig, resetJarvisConfig } from '../config/jarvis-config';
import { wireAll, buildSystemGraph } from './wiring';
import type { WiredSystems, InitStage } from './types';

// ---------------------------------------------------------------------------
// System initializer
// ---------------------------------------------------------------------------

let _globalSystems: WiredSystems | null = null;

async function initializeJarvisSystem(): Promise<WiredSystems> {
  if (_globalSystems) {
    console.log('[SystemWiring] Already initialized 鈥?returning cached systems.');
    return _globalSystems;
  }

  const t0 = performance.now();
  const stages: InitStage[] = [];

  console.log('[SystemWiring] ========================================');
  console.log('[SystemWiring] Initializing Jarvis system...');
  console.log('[SystemWiring] ========================================');

  // -------------------------------------------------------------------
  // Stage 1: Jarvis Core (REQUIRED)
  // -------------------------------------------------------------------
  let jarvisCore: IJarvisCore;
  {
    const s = performance.now();
    try {
      jarvisCore = await initializeJarvisCore();
      stages.push({ name: 'jarvis-core', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   jarvis-core OK (' + stages[stages.length-1].durationMs + 'ms)');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'jarvis-core', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] jarvis-core FAILED:', err);
      throw e; // Required
    }
  }

  // -------------------------------------------------------------------
  // Stage 2: Action Engine (REQUIRED)
  // -------------------------------------------------------------------
  let actionEngine: ReturnType<typeof getActionEngine>;
  {
    const s = performance.now();
    try {
      resetActionEngine();
      actionEngine = getActionEngine();
      stages.push({ name: 'action-engine', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   action-engine OK (' + stages[stages.length-1].durationMs + 'ms)');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'action-engine', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] action-engine FAILED:', err);
      actionEngine = null as unknown as ReturnType<typeof getActionEngine>;
    }
  }

  // -------------------------------------------------------------------
  // Stage 3: AI Router
  // -------------------------------------------------------------------
  let aiRouter: AIRouter;
  {
    const s = performance.now();
    try {
      aiRouter = createAIRouter(jarvisCore, 'dual');
      stages.push({ name: 'ai-router', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   ai-router OK (' + stages[stages.length-1].durationMs + 'ms)');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'ai-router', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] ai-router FAILED:', err);
      aiRouter = null as unknown as AIRouter;
    }
  }

  // -------------------------------------------------------------------
  // Stage 4: Provider Manager (auto-discovery)
  // -------------------------------------------------------------------
  let providerManager: ProviderManager;
  {
    const s = performance.now();
    try {
      providerManager = new ProviderManager(jarvisCore);
      // Start auto-discovery (non-blocking)
      providerManager.discoverAndRegister().catch((e) => {
        console.warn('[SystemWiring] Provider auto-discovery warning:', e instanceof Error ? e.message : e);
      });
      stages.push({ name: 'provider-manager', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   provider-manager OK (' + stages[stages.length-1].durationMs + 'ms)');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'provider-manager', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] provider-manager FAILED:', err);
      providerManager = null as unknown as ProviderManager;
    }
  }

  // -------------------------------------------------------------------
  // Stage 5: Provider Center (persistence + activation)
  // -------------------------------------------------------------------
  let providerCenter: ProviderCenter;
  {
    const s = performance.now();
    try {
      const config = getJarvisConfig();
      providerCenter = new ProviderCenter(providerManager, config);
      await providerCenter.initialize();
      stages.push({ name: 'provider-center', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   provider-center OK (' + stages[stages.length-1].durationMs + 'ms)');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'provider-center', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] provider-center FAILED:', err);
      providerCenter = null as unknown as ProviderCenter;
    }
  }

  // -------------------------------------------------------------------
  // Stage 6: Plugin Marketplace Manager
  // -------------------------------------------------------------------
  let pluginManager: PluginMarketplaceManager;
  {
    const s = performance.now();
    try {
      pluginManager = new PluginMarketplaceManager('plugins');
      stages.push({ name: 'plugin-marketplace', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   plugin-marketplace OK (' + stages[stages.length-1].durationMs + 'ms)');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'plugin-marketplace', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] plugin-marketplace FAILED:', err);
      pluginManager = null as unknown as PluginMarketplaceManager;
    }
  }

  // -------------------------------------------------------------------
  // Stage 7: Mode Manager (with PluginManager + ConfigService wired)
  // -------------------------------------------------------------------
  let modeManager: ModeManager;
  {
    const s = performance.now();
    try {
      const config = getJarvisConfig();
      modeManager = new ModeManager(jarvisCore.events);
      modeManager.setConfigService(config);

      // Wire PluginManager for orchestration
      if (pluginManager) {
        modeManager.setPluginManager(pluginManager);
      }

      // Register builtin modes and activate default
      await modeManager.initialize();
      stages.push({ name: 'mode-system', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   mode-system OK (' + stages[stages.length-1].durationMs + 'ms | active: ' + modeManager.activeModeId + ')');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'mode-system', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] mode-system FAILED:', err);
      modeManager = null as unknown as ModeManager;
    }
  }

  // -------------------------------------------------------------------
  // Stage 8: Execution Bridge
  // -------------------------------------------------------------------
  let executionBridge: ExecutionBridge;
  {
    const s = performance.now();
    try {
      executionBridge = new ExecutionBridge(jarvisCore);
      stages.push({ name: 'execution-bridge', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   execution-bridge OK (' + stages[stages.length-1].durationMs + 'ms)');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'execution-bridge', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] execution-bridge FAILED:', err);
      executionBridge = null as unknown as ExecutionBridge;
    }
  }

  // -------------------------------------------------------------------
  // Stage 9: Backend Manager (adapters)
  // -------------------------------------------------------------------
  let backendManager: ReturnType<typeof getBackendManager>;
  {
    const s = performance.now();
    try {
      resetBackendManager();
      backendManager = getBackendManager();

      // Register real backends
      const localCU = new LocalComputerUseBackend();
      await localCU.connect().catch((e) => console.warn('[SystemWiring] Local CU connect warning:', e));
      backendManager.registerBackend('local', localCU);

      const playwright = new PlaywrightBrowserBackend();
      await playwright.connect().catch((e) => console.warn('[SystemWiring] Playwright connect warning:', e));
      backendManager.registerBackend('playwright', playwright);

      // Set defaults
      backendManager.setBackend('computerUse', 'local');
      backendManager.setBackend('browser', 'playwright');

      stages.push({ name: 'adapters', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   adapters OK (' + stages[stages.length-1].durationMs + 'ms | backends: ' + (backendManager as any).backends?.size + ')');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'adapters', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] adapters FAILED:', err);
      backendManager = null as unknown as ReturnType<typeof getBackendManager>;
    }
  }

  // -------------------------------------------------------------------
  // Stage 10: System Wiring (event connections)
  // -------------------------------------------------------------------
  let _unwire: (() => void) | null = null;
  {
    const s = performance.now();
    try {
      _unwire = wireAll(jarvisCore, aiRouter, executionBridge, pluginManager as any);
      stages.push({ name: 'system-wiring', success: true, durationMs: Math.round(performance.now() - s) });
      console.log('[SystemWiring]   event-wiring OK (' + stages[stages.length-1].durationMs + 'ms)');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      stages.push({ name: 'system-wiring', success: false, durationMs: Math.round(performance.now() - s), error: err });
      console.error('[SystemWiring] event-wiring FAILED:', err);
    }
  }

  // -------------------------------------------------------------------
  // Build system graph + finalize
  // -------------------------------------------------------------------
  const graph = buildSystemGraph(jarvisCore, aiRouter, executionBridge, pluginManager as any);
  const totalMs = Math.round(performance.now() - t0);

  // Log summary
  const okCount = stages.filter((s) => s.success).length;
  console.log('[SystemWiring] ========================================');
  console.log('[SystemWiring] Initialization complete: ' + okCount + '/' + stages.length + ' OK (' + totalMs + 'ms)');
  console.log('[SystemWiring]   activeMode: ' + modeManager?.activeModeId || 'none');
  console.log('[SystemWiring]   activeProvider: ' + (providerCenter as any)?.activeProviderId || 'none');
  console.log('[SystemWiring] ========================================');

  _globalSystems = {
    jarvisCore,
    aiRouter,
    pluginManager: pluginManager as any,
    executionBridge,
    graph,
    // Extended fields
    actionEngine,
    providerManager,
    providerCenter,
    modeManager,
    backendManager,
    stages,
  } as WiredSystems;

  return _globalSystems;
}

/**
 * Get the cached initialized systems (null if not yet initialized).
 */
function getJarvisSystems(): WiredSystems | null {
  return _globalSystems;
}

/**
 * Format initialization status for diagnostics.
 */
function formatInitStatus(stages: InitStage[]): string {
  const totalMs = stages.reduce((sum, s) => sum + s.durationMs, 0);
  const okCount = stages.filter((s) => s.success).length;
  let out = 'Jarvis Init: ' + okCount + '/' + stages.length + ' OK (' + totalMs + 'ms)';
  for (const s of stages) {
    out += '\n  [' + (s.success ? 'OK' : 'FAIL') + '] ' + s.name + ' (' + s.durationMs + 'ms)';
    if (s.error) out += ' 鈥?' + s.error;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { initializeJarvisSystem, getJarvisSystems, formatInitStatus };

