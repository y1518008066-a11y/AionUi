/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TASK-0023 E2E Smoke Test — Adapter Backend Switching
 *
 * Verifies:
 *   1. BackendManager singleton creation + registration
 *   2. LocalComputerUseBackend implements IComputerUseAdapter
 *   3. PlaywrightBrowserBackend implements IBrowserAdapter (smoke)
 *   4. BackendManager backend selection + fallback
 *   5. Diagnostics
 *
 * Usage: bun run scripts/smoke-adapters.ts
 */

import { BackendManager, getBackendManager, resetBackendManager } from "../adapters/backend-manager";
import { LocalComputerUseBackend } from "../adapters/local-computer-use-backend";
import { PlaywrightBrowserBackend } from "../adapters/playwright-backend";

const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, label: string): boolean {
  if (condition) { console.log(`  ${PASS}  ${label}`); testsPassed++; return true; }
  else { console.log(`  ${FAIL}  ${label}`); testsFailed++; return false; }
}

async function main() {
  console.log("=".repeat(60));
  console.log("TASK-0023 E2E Smoke Test — Adapter Backend Switching");
  console.log("=".repeat(60));
  console.log("");

  // Reset singleton
  resetBackendManager();

  // -----------------------------------------------------------------------
  // STEP 1: BackendManager singleton
  // -----------------------------------------------------------------------
  console.log("--- Step 1: BackendManager Singleton ---");

  const bm = getBackendManager();
  assert(bm !== null, "BackendManager created");
  assert(bm.getBrowserAdapter() === null, "No browser adapter (nothing registered)");
  assert(bm.getComputerUseAdapter() === null, "No CU adapter (nothing registered)");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 2: Register LocalComputerUseBackend
  // -----------------------------------------------------------------------
  console.log("--- Step 2: LocalComputerUseBackend ---");

  const localCU = new LocalComputerUseBackend();
  await localCU.connect();
  assert(localCU.status === "connected", "Local CU backend connected");

  const desktopInfo = await localCU.getDesktopInfo();
  console.log(`  Platform: ${desktopInfo.platform}`);
  assert(desktopInfo.platform.length > 0, "DesktopInfo returns platform");
  assert(desktopInfo.displays.length >= 1, "At least 1 display detected");

  const cursor = await localCU.getCursorPosition();
  console.log(`  Cursor: (${cursor.x}, ${cursor.y})`);
  assert(typeof cursor.x === "number", "Cursor position has x");

  // Screenshot
  if (desktopInfo.platform === "win32") {
    const screenshot = await localCU.captureScreenshot();
    console.log(`  Screenshot: ${screenshot.encoding}=${screenshot.data.substring(0, 50)}... | ${screenshot.width}x${screenshot.height}`);
    assert(screenshot.width > 0, "Screenshot has dimensions");
  }

  // Health
  const cuHealth = await localCU.health();
  assert(cuHealth.available, "CU backend health: available");

  // Diagnostics
  const cuDiag = localCU.diagnostics();
  assert(cuDiag.connected, "CU backend diagnostics: connected");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 3: Register PlaywrightBrowserBackend (smoke — no real browser)
  // -----------------------------------------------------------------------
  console.log("--- Step 3: PlaywrightBrowserBackend ---");

  const pw = new PlaywrightBrowserBackend();
  await pw.connect();
  assert(pw.status === "connected", "Playwright backend connected (no real browser)");

  // Health check — should show disconnected since no browser launched
  const pwHealth = await pw.health();
  console.log(`  Playwright health: available=${pwHealth.available}, status=${pwHealth.status}`);
  assert(!pwHealth.available, "Playwright not available without open() (expected)");

  const pwDiag = pw.diagnostics();
  assert(pwDiag.backend === "playwright", "Playwright diagnostics: correct backend type");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 4: BackendManager registration + resolution
  // -----------------------------------------------------------------------
  console.log("--- Step 4: BackendManager Registration ---");

  bm.register(localCU);
  bm.register(pw);

  const diag1 = bm.getDiagnostics() as Record<string, unknown>;
  console.log(`  Registered backends: ${diag1.registeredBackends}`);

  // Set preferred backend to local (since Codex is not registered)
  bm.setBackend("computerUse", "local");
  assert(bm.getBackend("computerUse") === "local", "CU backend preference set to local");

  bm.setBackend("browser", "playwright");
  assert(bm.getBackend("browser") === "playwright", "Browser backend preference set to playwright");

  // Manually connect playwright for resolution to work
  // (resolve checks status === 'connected')
  await pw.connect();
  bm.refresh();

  // Now resolution should find the backends
  const cuAdapter = bm.getComputerUseAdapter();
  const bwAdapter = bm.getBrowserAdapter();

  // Note: resolution checks adapter.status, PW is 'connected' but health says not available
  // The CU adapter should resolve since local is connected
  console.log(`  CU adapter resolved: ${cuAdapter?.backend || "none"}`);
  console.log(`  Browser adapter resolved: ${bwAdapter?.backend || "none"}`);

  assert(cuAdapter !== null, "CU adapter resolved to local backend");
  assert(cuAdapter?.backend === "local", "CU adapter backend is 'local'");
  console.log("");

  // -----------------------------------------------------------------------
  // STEP 5: Diagnostics
  // -----------------------------------------------------------------------
  console.log("--- Step 5: Diagnostics ---");

  const fullDiag = bm.getDiagnostics() as Record<string, unknown>;
  console.log(`  Config browser: ${(fullDiag.config as Record<string,unknown>)?.browser}`);
  console.log(`  Config CU: ${(fullDiag.config as Record<string,unknown>)?.computerUse}`);
  console.log(`  Active browser: ${fullDiag.activeBrowserBackend}`);
  console.log(`  Active CU: ${fullDiag.activeComputerUseBackend}`);

  assert(fullDiag.config !== undefined, "Diagnostics includes config");
  assert(fullDiag.registeredBackends !== undefined, "Diagnostics includes registered backends");
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

main().catch((err) => { console.error("Fatal error:", err); process.exit(1); });
