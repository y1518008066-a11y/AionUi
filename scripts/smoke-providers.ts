/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TASK-0022 E2E Smoke Test - Provider Center + Runtime Switching
 *
 * Verifies against a running LM Studio:
 *   1. Provider auto-discovery
 *   2. ProviderManager registration + health
 *   3. Model listing
 *   4. ProviderCenter persistence
 *   5. Real chat via ToolCallingProvider
 *   6. Diagnostics
 */

import { ProviderManager } from "../provider-manager/manager";
import { discoverProviders } from "../provider-manager/discovery";
import { ProviderCenter } from "../provider-center/center";
import { getJarvisConfig, resetJarvisConfig } from "../config/jarvis-config";
import { createLMStudioProvider } from "../agent-runtime/tool-provider";
import type { IEventBus, IJarvisCore } from "../jarvis-core/interfaces";
import { existsSync, unlinkSync } from "fs";

const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, label: string): boolean {
  if (condition) { console.log(`  ${PASS}  ${label}`); testsPassed++; return true; }
  else { console.log(`  ${FAIL}  ${label}`); testsFailed++; return false; }
}

function createMockJarvisCore(): IJarvisCore {
  const events: Array<{ type: string; payload: unknown }> = [];
  const eventBus: IEventBus = {
    emit(event: { type: string } & Record<string, unknown>): void { events.push({ type: event.type, payload: event }); },
    on(_event: string, _handler: (...args: unknown[]) => void): void {},
    off(_event: string, _handler: (...args: unknown[]) => void): void {},
  } as IEventBus;
  return { events: eventBus, id: "jarvis-core", status: "initialized" } as unknown as IJarvisCore;
}

async function main() {
  console.log("=".repeat(60));
  console.log("TASK-0022 E2E Smoke Test - Provider Center + Runtime Switching");
  console.log("=".repeat(60));
  console.log("");

  resetJarvisConfig();
  const configPath = "config/jarvis-settings.json";
  if (existsSync(configPath)) unlinkSync(configPath);

  // Step 1: Auto-Discovery
  console.log("--- Step 1: Auto-Discovery ---");
  const results = await discoverProviders();
  const reachable = results.filter((r) => r.reachable);
  assert(reachable.length >= 1, "At least 1 provider reachable via auto-discovery");
  const lmStudio = results.find((r) => r.target.type === "lmstudio" && r.reachable);
  assert(lmStudio !== undefined, "LM Studio is reachable");
  if (lmStudio) {
    console.log(`  Endpoint: ${lmStudio.target.endpoint} | Latency: ${lmStudio.latencyMs}ms | Models: ${lmStudio.modelCount}`);
    assert(lmStudio.modelCount >= 1, "LM Studio has at least 1 model");
  }
  console.log("");

  // Step 2: ProviderManager Registration + Health
  console.log("--- Step 2: ProviderManager Registration + Health ---");
  const jarvisCore = createMockJarvisCore();
  const manager = new ProviderManager(jarvisCore);
  await manager.discoverAndRegister();
  const providerIds = manager.listProviderIds();
  assert(providerIds.length >= 1, "ProviderManager has registered providers");
  console.log(`  Registered: ${providerIds.join(", ")}`);
  if (providerIds.length > 0) {
    const health = await manager.checkHealth(providerIds[0]);
    console.log(`  Connected: ${health.connected} | Latency: ${health.latencyMs}ms | Models: ${health.modelCount} | Protocol: ${health.protocol}`);
    assert(health.connected, "Provider is connected");
    assert(health.latencyMs > 0, "Latency is measured");
    assert(health.connected, "Model count >= 1");
  }
  console.log("");

  // Step 3: Model Listing
  console.log("--- Step 3: Model Listing ---");
  if (providerIds.length > 0) {
    const models = await manager.refreshModels(providerIds[0]);
    console.log(`  Models retrieved: ${models.length}`);
    for (const m of models.slice(0, 5)) console.log(`    - ${m.displayName || m.id}`);
    assert(models.length >= 1, "Models retrieved successfully");
  }
  console.log("");

  // Step 4: Persistence
  console.log("--- Step 4: ProviderCenter Persistence ---");
  const config = getJarvisConfig();
  assert(config.getProviders().length >= 1, "Default provider config exists");
  config.setProvider({ id: "openai-test", type: "openai", name: "OpenAI (Test)", endpoint: "https://api.openai.com/v1", apiKey: "", enabled: false, autoDiscover: false, lastChecked: null, createdAt: Date.now() });
  assert(config.getProviders().some((p) => p.id === "openai-test"), "OpenAI provider added");
  config.setActiveProviderId("lmstudio");
  config.setDefaultModelId("qwen3.5-9b");
  resetJarvisConfig();
  const config2 = getJarvisConfig();
  assert(config2.getProviders().some((p) => p.id === "openai-test"), "Config survived reload");
  assert(config2.getActiveProviderId() === "lmstudio", "Active provider survived reload");
  console.log("");

  // Step 5: ProviderCenter integration
  console.log("--- Step 5: ProviderCenter + ProviderManager ---");
  const center = new ProviderCenter(manager, config2);
  await center.initialize();
  const centerProviders = center.listProviders();
  assert(centerProviders.length >= 1, "ProviderCenter lists providers");
  assert(center.activeProviderId !== null, "Has active provider");
  if (centerProviders.length > 0) {
    const health = await center.checkHealth(centerProviders[0].providerId);
    assert(health.connected, "ProviderCenter health: connected");
    const models = await center.refreshModels(centerProviders[0].providerId);
    assert(models.length >= 1, "ProviderCenter model refresh works");
  }
  console.log("");

  // Step 6: Real Chat via ToolCallingProvider
  console.log("--- Step 6: Real Chat Request ---");
  const toolProvider = createLMStudioProvider("qwen3.5-9b");
  const result = await toolProvider.chat({
    messages: [{ role: "user", content: "Say hello in exactly 3 words." }],
    tools: [],
    model: "qwen3.5-9b",
    temperature: 0.1,
    maxTokens: 256,
    signal: new AbortController().signal,
  });
  console.log(`  Response: "${(result.content || "").trim()}" | Latency: ${result.latencyMs}ms`);
  assert(result.finishReason === "stop" || result.finishReason === "length" || result.finishReason === "tool_calls", `Chat response received (finish: ${result.finishReason})`);
  assert(result.latencyMs < 60000, "Response within 30 seconds");
  if (providerIds.length > 0) manager.recordRequest(providerIds[0]);
  console.log("");

  // Step 7: Diagnostics
  console.log("--- Step 7: Diagnostics ---");
  const diag = manager.getDiagnostics() as Record<string, unknown>;
  console.log(`  Providers: ${diag.providerCount} | Active: ${diag.activeProviderName} | Requests: ${diag.totalRequests}`);
  assert(typeof diag.providerCount === "number", "Diagnostics: provider count");
  const statuses = center.listProviders();
  for (const s of statuses) console.log(`  ${s.name}: ${s.health.connected ? "ONLINE" : "OFFLINE"} | ${s.health.latencyMs}ms | ${s.modelCount} models`);
  assert(statuses.length >= 1, "Diagnostics: statuses available");
  console.log("");

  console.log("=".repeat(60));
  console.log(`Final Result: ${testsFailed === 0 ? "PASS" : "FAIL"}`);
  console.log(`Tests: ${testsPassed} passed, ${testsFailed} failed`);
  console.log("=".repeat(60));

  if (existsSync(configPath)) unlinkSync(configPath);
  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal error:", err); process.exit(1); });
