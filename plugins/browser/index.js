/**
 * Browser Plugin — Production Implementation V1
 *
 * Real browser execution layer using Playwright.
 * All 22 browser actions execute through real Chromium.
 *
 * Architecture:
 *   Action Engine → Browser Plugin → Playwright → Chromium → DOM
 */

const { existsSync, mkdirSync } = require("fs");
const { join } = require("path");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let pluginContext = null;
let enabled = false;
let actionEngine = null;
let registeredActionIds = [];
let activateTime = 0;

/** @type {import("playwright").Browser | null} */
let browser = null;

/** @type {import("playwright").BrowserContext | null} */
let context = null;

/** @type {import("playwright").Page | null} */
let page = null;

let lastError = null;
let lastAction = null;
let actionCount = 0;
let launchTimeMs = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, "data");
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

function ensureBrowser() {
  if (!browser || !browser.isConnected()) {
    throw new Error("Browser is not running. Call browser.open first.");
  }
  if (!page) {
    throw new Error("No active page. Call browser.open or browser.newTab first.");
  }
}

function recordAction(name, durationMs, success, error) {
  actionCount++;
  lastAction = { name, durationMs, success, error, timestamp: Date.now() };
  if (error) lastError = error;
}

// ---------------------------------------------------------------------------
// Action: browser.open — Launch browser
// ---------------------------------------------------------------------------

async function browser_open(params) {
  const t0 = Date.now();
  const headless = params.headless !== false;
  const url = params.url || "about:blank";

  try {
    const { chromium } = require("playwright");
    browser = await chromium.launch({
      headless,
      args: ["--no-sandbox", "--disable-gpu", "--disable-setuid-sandbox"],
      timeout: params.timeoutMs || 30000,
    });
    context = await browser.newContext({
      viewport: { width: params.width || 1280, height: params.height || 720 },
    });
    page = await context.newPage();
    if (url && url !== "about:blank") {
      await page.goto(url, { timeout: params.timeoutMs || 15000, waitUntil: "domcontentloaded" });
    }
    launchTimeMs = Date.now() - t0;
    recordAction("browser.open", launchTimeMs, true);
    console.log("[Browser] Launched in " + launchTimeMs + "ms. URL:", url, "| Headless:", headless);
    return { ok: true, url: page.url(), title: await page.title(), launchTimeMs };
  } catch (err) {
    recordAction("browser.open", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.close — Close browser
// ---------------------------------------------------------------------------

async function browser_close() {
  const t0 = Date.now();
  try {
    if (page) { await page.close().catch(() => {}); page = null; }
    if (context) { await context.close().catch(() => {}); context = null; }
    if (browser) { await browser.close().catch(() => {}); browser = null; }
    const dur = Date.now() - t0;
    recordAction("browser.close", dur, true);
    console.log("[Browser] Closed.");
    return { ok: true, durationMs: dur };
  } catch (err) {
    recordAction("browser.close", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.navigate
// ---------------------------------------------------------------------------

async function browser_navigate(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    const waitUntil = params.waitUntil || "domcontentloaded";
    await page.goto(params.url, {
      timeout: params.timeoutMs || 30000,
      waitUntil: waitUntil,
    });
    const dur = Date.now() - t0;
    recordAction("browser.navigate", dur, true);
    console.log("[Browser] Navigated to:", params.url, "| Title:", await page.title());
    return { ok: true, url: page.url(), title: await page.title(), durationMs: dur };
  } catch (err) {
    recordAction("browser.navigate", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.back
// ---------------------------------------------------------------------------

async function browser_back() {
  const t0 = Date.now();
  try {
    ensureBrowser();
    await page.goBack({ timeout: 10000 });
    const dur = Date.now() - t0;
    recordAction("browser.back", dur, true);
    return { ok: true, url: page.url(), durationMs: dur };
  } catch (err) {
    recordAction("browser.back", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.forward
// ---------------------------------------------------------------------------

async function browser_forward() {
  const t0 = Date.now();
  try {
    ensureBrowser();
    await page.goForward({ timeout: 10000 });
    const dur = Date.now() - t0;
    recordAction("browser.forward", dur, true);
    return { ok: true, url: page.url(), durationMs: dur };
  } catch (err) {
    recordAction("browser.forward", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.reload
// ---------------------------------------------------------------------------

async function browser_reload() {
  const t0 = Date.now();
  try {
    ensureBrowser();
    await page.reload({ timeout: 15000 });
    const dur = Date.now() - t0;
    recordAction("browser.reload", dur, true);
    return { ok: true, url: page.url(), durationMs: dur };
  } catch (err) {
    recordAction("browser.reload", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.currentUrl
// ---------------------------------------------------------------------------

async function browser_currentUrl() {
  try {
    ensureBrowser();
    recordAction("browser.currentUrl", 0, true);
    return { ok: true, url: page.url() };
  } catch (err) {
    recordAction("browser.currentUrl", 0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.currentTitle
// ---------------------------------------------------------------------------

async function browser_currentTitle() {
  try {
    ensureBrowser();
    const title = await page.title();
    recordAction("browser.currentTitle", 0, true);
    return { ok: true, title };
  } catch (err) {
    recordAction("browser.currentTitle", 0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.getHtml
// ---------------------------------------------------------------------------

async function browser_getHtml() {
  const t0 = Date.now();
  try {
    ensureBrowser();
    const html = await page.content();
    const dur = Date.now() - t0;
    recordAction("browser.getHtml", dur, true);
    return { ok: true, html, length: html.length, durationMs: dur };
  } catch (err) {
    recordAction("browser.getHtml", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.getMarkdown — Convert page to Markdown
// ---------------------------------------------------------------------------

async function browser_getMarkdown() {
  const t0 = Date.now();
  try {
    ensureBrowser();
    // Use a simple heuristic: extract visible text, headings, links
    const result = await page.evaluate(() => {
      const md = [];
      const body = document.body;
      if (!body) return "";

      // Walk DOM and convert to markdown
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
      const stack = [];
      let node;
      const lines = [];

      // Simpler approach: get all text with structure
      const elements = body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,a,pre,code,blockquote,table");
      const seen = new Set();

      for (const el of elements) {
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || "").trim().replace(/\s+/g, " ");
        if (!text || text.length < 1) continue;
        if (seen.has(text)) continue;
        seen.add(text);

        switch (tag) {
          case "h1": lines.push("# " + text); break;
          case "h2": lines.push("## " + text); break;
          case "h3": lines.push("### " + text); break;
          case "h4": lines.push("#### " + text); break;
          case "h5": lines.push("##### " + text); break;
          case "h6": lines.push("###### " + text); break;
          case "li": lines.push("- " + text); break;
          case "a":
            const href = el.getAttribute("href") || "";
            lines.push("[" + text + "](" + href + ")");
            break;
          case "pre":
          case "code":
            lines.push("```\n" + text + "\n```");
            break;
          case "blockquote":
            lines.push("> " + text);
            break;
          default:
            lines.push(text);
        }
      }

      return lines.join("\n\n");
    });

    const dur = Date.now() - t0;
    recordAction("browser.getMarkdown", dur, true);
    return { ok: true, markdown: result, length: result.length, durationMs: dur };
  } catch (err) {
    recordAction("browser.getMarkdown", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.getText — Extract all visible text
// ---------------------------------------------------------------------------

async function browser_getText() {
  const t0 = Date.now();
  try {
    ensureBrowser();
    const text = await page.evaluate(() => {
      return (document.body?.innerText || "").trim();
    });
    const dur = Date.now() - t0;
    recordAction("browser.getText", dur, true);
    return { ok: true, text, length: text.length, durationMs: dur };
  } catch (err) {
    recordAction("browser.getText", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.screenshot
// ---------------------------------------------------------------------------

async function browser_screenshot(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    const fullPage = params.fullPage !== false;
    const dataDir = getDataDir();
    const filename = "browser_screenshot_" + Date.now() + ".png";
    const filepath = join(dataDir, filename);
    await page.screenshot({ path: filepath, fullPage, type: "png" });
    const dur = Date.now() - t0;
    recordAction("browser.screenshot", dur, true);
    console.log("[Browser] Screenshot saved:", filepath);
    return { ok: true, path: filepath.replace(/\\/g, "/"), durationMs: dur };
  } catch (err) {
    recordAction("browser.screenshot", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.click
// ---------------------------------------------------------------------------

async function browser_click(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    if (params.selector) {
      await page.click(params.selector, { timeout: params.timeoutMs || 10000 });
    } else if (params.x !== undefined && params.y !== undefined) {
      await page.mouse.click(params.x, params.y);
    } else if (params.text) {
      await page.click("text=" + params.text, { timeout: params.timeoutMs || 10000 });
    } else {
      throw new Error("click requires selector, x/y, or text parameter.");
    }
    const dur = Date.now() - t0;
    recordAction("browser.click", dur, true);
    return { ok: true, durationMs: dur };
  } catch (err) {
    recordAction("browser.click", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.type
// ---------------------------------------------------------------------------

async function browser_type(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    if (params.selector) {
      await page.fill(params.selector, params.text || "", { timeout: params.timeoutMs || 10000 });
    } else if (params.selector) {
      await page.type(params.selector, params.text || "", { delay: params.delay || 0 });
    } else {
      throw new Error("type requires a selector parameter.");
    }
    const dur = Date.now() - t0;
    recordAction("browser.type", dur, true);
    return { ok: true, durationMs: dur };
  } catch (err) {
    recordAction("browser.type", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.scroll
// ---------------------------------------------------------------------------

async function browser_scroll(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    const x = params.x || 0;
    const y = params.y || 0;
    if (params.selector) {
      await page.locator(params.selector).scrollIntoViewIfNeeded({ timeout: params.timeoutMs || 5000 });
    } else if (params.toBottom) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } else if (params.toTop) {
      await page.evaluate(() => window.scrollTo(0, 0));
    } else {
      await page.evaluate(({ x, y }) => window.scrollBy(x, y), { x, y });
    }
    const dur = Date.now() - t0;
    recordAction("browser.scroll", dur, true);
    return { ok: true, durationMs: dur };
  } catch (err) {
    recordAction("browser.scroll", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.wait
// ---------------------------------------------------------------------------

async function browser_wait(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    if (params.ms) {
      await page.waitForTimeout(params.ms);
    } else if (params.selector) {
      await page.waitForSelector(params.selector, { timeout: params.timeoutMs || 15000 });
    } else if (params.navigation) {
      await page.waitForLoadState("networkidle", { timeout: params.timeoutMs || 30000 });
    } else {
      await page.waitForLoadState("domcontentloaded", { timeout: params.timeoutMs || 15000 });
    }
    const dur = Date.now() - t0;
    recordAction("browser.wait", dur, true);
    return { ok: true, durationMs: dur };
  } catch (err) {
    recordAction("browser.wait", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.find — Find elements matching a selector
// ---------------------------------------------------------------------------

async function browser_find(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    const selector = params.selector || params.text;
    if (!selector) throw new Error("find requires selector or text parameter.");

    const limit = params.limit || 20;
    const elements = await page.evaluate(({ sel, limit }) => {
      const results = [];
      let els;
      try {
        els = document.querySelectorAll(sel);
      } catch {
        els = document.querySelectorAll("*");
      }

      let idx = 0;
      for (const el of els) {
        const text = (el.textContent || "").trim().substring(0, 200);
        if (sel.startsWith("text=")) {
          const searchText = sel.slice(5).toLowerCase();
          if (!text.toLowerCase().includes(searchText)) { idx++; continue; }
        }
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        results.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          className: el.className?.toString?.() || null,
          text: text.substring(0, 100),
          href: el.getAttribute("href") || null,
          visible,
          rect: visible ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
        });
        idx++;
        if (results.length >= limit) break;
      }
      return results;
    }, { sel: selector, limit });

    const dur = Date.now() - t0;
    recordAction("browser.find", dur, true);
    return { ok: true, elements, count: elements.length, durationMs: dur };
  } catch (err) {
    recordAction("browser.find", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.evaluate — Execute JavaScript in page context
// ---------------------------------------------------------------------------

async function browser_evaluate(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    if (!params.script && !params.code) {
      throw new Error("evaluate requires script or code parameter.");
    }
    const script = params.script || params.code;
    let result;
    if (typeof script === "function") {
      result = await page.evaluate(script);
    } else if (typeof script === "string") {
      // Wrap in a function if it contains return/function keywords
      if (script.includes("return ") || script.includes("function") || script.includes("=>")) {
        result = await page.evaluate("(() => { " + script + " })()");
      } else {
        result = await page.evaluate(script);
      }
    } else {
      result = await page.evaluate(String(script));
    }
    const dur = Date.now() - t0;
    recordAction("browser.evaluate", dur, true);
    return { ok: true, result, durationMs: dur };
  } catch (err) {
    recordAction("browser.evaluate", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.cookies
// ---------------------------------------------------------------------------

async function browser_cookies(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    if (params && params.set) {
      // Set cookies
      const cookies = Array.isArray(params.set) ? params.set : [params.set];
      await context.addCookies(cookies);
    }
    const allCookies = await context.cookies(params?.url ? [params.url] : undefined);
    const dur = Date.now() - t0;
    recordAction("browser.cookies", dur, true);
    return { ok: true, cookies: allCookies, count: allCookies.length, durationMs: dur };
  } catch (err) {
    recordAction("browser.cookies", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.tabs — List all tabs
// ---------------------------------------------------------------------------

async function browser_tabs() {
  const t0 = Date.now();
  try {
    ensureBrowser();
    const pages = context.pages();
    const tabs = [];
    for (const p of pages) {
      tabs.push({ url: p.url(), title: await p.title().catch(() => ""), index: tabs.length });
    }
    const dur = Date.now() - t0;
    recordAction("browser.tabs", dur, true);
    return { ok: true, tabs, count: tabs.length, durationMs: dur };
  } catch (err) {
    recordAction("browser.tabs", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.newTab
// ---------------------------------------------------------------------------

async function browser_newTab(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    const newPage = await context.newPage();
    const url = params?.url || "about:blank";
    if (url !== "about:blank") {
      await newPage.goto(url, { timeout: params?.timeoutMs || 15000, waitUntil: "domcontentloaded" });
    }
    page = newPage; // Switch focus to new tab
    const dur = Date.now() - t0;
    recordAction("browser.newTab", dur, true);
    console.log("[Browser] New tab:", page.url());
    return { ok: true, url: page.url(), title: await page.title(), durationMs: dur };
  } catch (err) {
    recordAction("browser.newTab", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Action: browser.closeTab
// ---------------------------------------------------------------------------

async function browser_closeTab(params) {
  const t0 = Date.now();
  try {
    ensureBrowser();
    const pages = context.pages();
    const index = params?.index;

    if (index !== undefined && index < pages.length) {
      // Close specific tab by index
      await pages[index].close();
      // Switch to another tab
      const remaining = context.pages();
      page = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    } else {
      // Close current tab
      await page.close();
      const remaining = context.pages();
      page = remaining.length > 0 ? remaining[remaining.length - 1] : null;

      if (!page) {
        // All tabs closed — create a new one
        page = await context.newPage();
      }
    }

    const dur = Date.now() - t0;
    recordAction("browser.closeTab", dur, true);
    return { ok: true, remainingTabs: context.pages().length, currentUrl: page ? page.url() : null, durationMs: dur };
  } catch (err) {
    recordAction("browser.closeTab", Date.now() - t0, false, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Plugin lifecycle
// ---------------------------------------------------------------------------

async function activate(context) {
  pluginContext = context;
  enabled = true;
  activateTime = Date.now();

  // Get the global ActionEngine singleton
  try {
    const { getActionEngine } = require("../../action-engine/singleton");
    actionEngine = getActionEngine();
  } catch (err) {
    console.warn("[Browser] ActionEngine singleton not available:", err.message);
    actionEngine = null;
  }

  // Auto-register all 22 actions
  if (actionEngine) {
    registerAllActions();
  }

  console.log("[Browser] Plugin activated. Headless Chromium via Playwright. Actions registered:", registeredActionIds.length);
  return { ok: true, playwrightAvailable: true, actionsRegistered: registeredActionIds.length };
}

async function deactivate() {
  // Unregister all actions
  if (actionEngine) {
    for (const actionId of registeredActionIds) {
      actionEngine.unregisterAction(actionId);
    }
    console.log("[Browser] Unregistered", registeredActionIds.length, "actions.");
    registeredActionIds = [];
  }

  // Close browser if running
  await browser_close().catch(() => {});
  enabled = false;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Health & Diagnostics
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Action Registration (ActionEngine Integration)
// ---------------------------------------------------------------------------

const ACTION_DEFINITIONS = [
  { id: "browser.open",        description: "Launch a browser instance and optionally navigate to a URL.",                   permissions: ["network:outbound", "process:spawn"], category: "browser" },
  { id: "browser.close",       description: "Close the browser and all its tabs.",                                          permissions: ["process:spawn"],                   category: "browser" },
  { id: "browser.navigate",    description: "Navigate the current page to a URL.",                                          permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.back",        description: "Navigate back in browser history.",                                            permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.forward",     description: "Navigate forward in browser history.",                                         permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.reload",      description: "Reload the current page.",                                                    permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.currentUrl",  description: "Get the current page URL.",                                                   permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.currentTitle",description: "Get the current page title.",                                                 permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.getHtml",     description: "Get the full HTML content of the current page.",                               permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.getMarkdown", description: "Convert the current page content to Markdown.",                                permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.getText",     description: "Extract all visible text from the current page.",                              permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.screenshot",  description: "Take a screenshot of the current page or viewport.",                           permissions: ["screen:capture", "network:outbound"], category: "browser" },
  { id: "browser.click",       description: "Click on an element by selector, coordinates, or text.",                       permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.type",        description: "Type text into an input element.",                                            permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.scroll",      description: "Scroll the page by delta, to top, to bottom, or to a selector.",               permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.wait",        description: "Wait for a specified time, selector, or navigation state.",                    permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.find",        description: "Find elements on the page matching a CSS selector or text search.",            permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.evaluate",    description: "Execute arbitrary JavaScript in the page context and return the result.",      permissions: ["network:outbound", "process:spawn"], category: "browser" },
  { id: "browser.cookies",     description: "Get or set browser cookies.",                                                 permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.tabs",        description: "List all open browser tabs.",                                                 permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.newTab",      description: "Open a new browser tab and optionally navigate to a URL.",                     permissions: ["network:outbound"],                category: "browser" },
  { id: "browser.closeTab",    description: "Close a browser tab by index or the current tab.",                             permissions: ["network:outbound"],                category: "browser" },
];

/** Map action ids to the corresponding plugin functions. */
const ACTION_HANDLERS = {
  "browser.open":         browser_open,
  "browser.close":        browser_close,
  "browser.navigate":     browser_navigate,
  "browser.back":         browser_back,
  "browser.forward":      browser_forward,
  "browser.reload":       browser_reload,
  "browser.currentUrl":   browser_currentUrl,
  "browser.currentTitle": browser_currentTitle,
  "browser.getHtml":      browser_getHtml,
  "browser.getMarkdown":  browser_getMarkdown,
  "browser.getText":      browser_getText,
  "browser.screenshot":   browser_screenshot,
  "browser.click":        browser_click,
  "browser.type":         browser_type,
  "browser.scroll":       browser_scroll,
  "browser.wait":         browser_wait,
  "browser.find":         browser_find,
  "browser.evaluate":     browser_evaluate,
  "browser.cookies":      browser_cookies,
  "browser.tabs":         browser_tabs,
  "browser.newTab":       browser_newTab,
  "browser.closeTab":     browser_closeTab,
};

function registerAllActions() {
  registeredActionIds = [];

  for (const def of ACTION_DEFINITIONS) {
    const handlerFn = ACTION_HANDLERS[def.id];
    if (!handlerFn) {
      console.warn("[Browser] No handler found for action:", def.id);
      continue;
    }

    // Wrap the plugin function into an ActionHandler signature
    const actionHandler = async (ctx) => {
      // Pass ctx.params directly to the browser function
      return handlerFn(ctx.params || {});
    };

    actionEngine.registerAction(
      {
        id: def.id,
        pluginId: "com.jarvis.browser",
        description: def.description,
        permissions: def.permissions,
        parameters: [],
        returnType: { type: "object", description: "Action result with ok, data, and error fields." },
        category: def.category,
      },
      actionHandler
    );

    registeredActionIds.push(def.id);
  }

  console.log("[Browser] Registered", registeredActionIds.length, "actions with ActionEngine.");
}


function health() {
  const aeDiag = actionEngine ? actionEngine.getDiagnostics() : null;
  return {
    status: enabled ? "ok" : "disabled",
    browserRunning: !!(browser && browser.isConnected()),
    pageUrl: page ? page.url() : null,
    lastAction,
    lastError,
    actionCount,
    launchTimeMs,
    uptimeMs: activateTime ? Date.now() - activateTime : 0,
    registeredActions: registeredActionIds.length,
    registeredActionIds: registeredActionIds.slice(),
    actionEngineStats: aeDiag ? {
      totalExecutions: aeDiag.totalExecutions,
      totalSuccess: aeDiag.totalSuccess,
      totalFailures: aeDiag.totalFailures,
      actionsByPlugin: aeDiag.actionsByPlugin,
    } : null,
  };
}

const diagnostics = {
  name: "Browser Plugin",
  version: "1.0.0",
  capabilities: ["browser", "screen", "network"],
  permissions: ["screen:capture", "network:outbound", "network:inbound", "filesystem:read", "filesystem:write", "process:spawn"],
  runtime: "Playwright + Chromium",
  integration: "ActionEngine",
  actionCount: () => registeredActionIds.length,
  getStatus: health,
};

// ---------------------------------------------------------------------------
// Exports — All 22 actions
// ---------------------------------------------------------------------------

module.exports = {
  // Lifecycle
  activate,
  deactivate,

  // Actions
  browser_open,
  browser_close,
  browser_navigate,
  browser_back,
  browser_forward,
  browser_reload,
  browser_currentUrl,
  browser_currentTitle,
  browser_getHtml,
  browser_getMarkdown,
  browser_getText,
  browser_screenshot,
  browser_click,
  browser_type,
  browser_scroll,
  browser_wait,
  browser_find,
  browser_evaluate,
  browser_cookies,
  browser_tabs,
  browser_newTab,
  browser_closeTab,

  // Health
  health,
  diagnostics,
};