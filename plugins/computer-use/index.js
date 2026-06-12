const { execSync } = require("child_process");
const { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } = require("fs");
const { join, resolve } = require("path");
const os = require("os");

let pluginContext = null;
let enabled = false;
let lastScreenshot = null;
let lastError = null;
let screenshotCount = 0;

// ---------------------------------------------------------------------------
// Lazy vision layer import (Bun handles TS imports natively)
// ---------------------------------------------------------------------------

let _visionAnalyzer = null;
let _visionImported = false;

async function _getVisionAnalyzer() {
  if (_visionAnalyzer) return _visionAnalyzer;
  if (_visionImported) return null; // tried and failed
  _visionImported = true;
  try {
    const visionPath = resolve(__dirname, "..", "..", "vision-layer", "index.ts");
    const mod = await import(visionPath);
    _visionAnalyzer = new mod.ScreenAnalyzer();
    // Check health
    const health = await _visionAnalyzer.getHealth();
    console.log("[CU:Vision] Vision layer loaded. Available:", health.available, "| Providers:", health.providers.length);
    return _visionAnalyzer;
  } catch (err) {
    console.warn("[CU:Vision] Vision layer not available:", err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDataDir() {
  const dir = pluginContext?.dataDir || join(__dirname, "data");
  if (!existsSync(dir)) { try { mkdirSync(dir, { recursive: true }); } catch {} }
  return dir;
}

function runPS(script, opts) {
  opts = opts || {};
  const dataDir = getDataDir();
  const psFile = join(dataDir, "_tmp_" + Date.now() + "_" + (Math.random() * 10000 | 0) + ".ps1");
  try {
    writeFileSync(psFile, script, "utf-8");
    const result = execSync(
      "powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + psFile + "\"",
      { timeout: opts.timeoutMs || 10000, encoding: "utf-8", windowsHide: true }
    );
    const trimmed = result.trim();
    if (!trimmed) return null;
    if (opts.parseJson !== false) { try { return JSON.parse(trimmed); } catch { return trimmed; } }
    return trimmed;
  } catch (error) {
    lastError = error.message;
    return null;
  } finally {
    try { if (existsSync(psFile)) unlinkSync(psFile); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function activate(context) {
  pluginContext = context;
  enabled = true;
  console.log("[CU] Activated:", os.platform());
  // Pre-warm vision layer asynchronously (non-blocking)
  _getVisionAnalyzer().catch(() => {});
  return { ok: true };
}

async function deactivate() {
  enabled = false;
  lastScreenshot = null;
  _visionAnalyzer = null;
  _visionImported = false;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Desktop state APIs
// ---------------------------------------------------------------------------

function getDesktopInfo() {
  if (!enabled) return { error: "disabled" };
  return {
    platform: os.platform(),
    release: os.release(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    displays: getDisplays(),
    windows: listWindows(),
    cursor: getCursorPosition(),
    timestamp: Date.now()
  };
}

function getDisplays() {
  if (!enabled) return [];
  var ps = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | ForEach-Object { [PSCustomObject]@{deviceName=$_.DeviceName;primary=$_.Primary;bounds=@{x=$_.Bounds.X;y=$_.Bounds.Y;width=$_.Bounds.Width;height=$_.Bounds.Height};workingArea=@{x=$_.WorkingArea.X;y=$_.WorkingArea.Y;width=$_.WorkingArea.Width;height=$_.WorkingArea.Height};bitsPerPixel=$_.BitsPerPixel} } | ConvertTo-Json -Depth 4";
  var r = runPS(ps);
  if (!r) return [];
  return Array.isArray(r) ? r : [r];
}

function listWindows() {
  if (!enabled) return [];
  var ps = "";
  ps += "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 50 | ForEach-Object {\n";
  ps += "  $title = $_.MainWindowTitle;\n";
  ps += "  $name = $_.ProcessName;\n";
  ps += "  $id = $_.Id;\n";
  ps += "  $hwnd = $_.MainWindowHandle;\n";
  ps += "  $x = 0; $y = 0; $w = 0; $h = 0;\n";
  ps += "  if ($hwnd -ne 0) {\n";
  ps += "    try {\n";
  ps += "      $signature = '[DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h, out RECT r); public struct RECT { public int L,T,R,B; }';\n";
  ps += "      $code = Add-Type -MemberDefinition $signature -Name 'Win32Rect' -Namespace 'CU' -PassThru;\n";
  ps += "      $rect = New-Object CU.Win32Rect+RECT;\n";
  ps += "      $ok = [CU.Win32Rect]::GetWindowRect($hwnd, [ref]$rect);\n";
  ps += "      if ($ok) { $x = $rect.L; $y = $rect.T; $w = $rect.R - $rect.L; $h = $rect.B - $rect.T; }\n";
  ps += "    } catch {}\n";
  ps += "  }\n";
  ps += "  [PSCustomObject]@{title=$title;process=$name;id=$id;x=$x;y=$y;width=$w;height=$h}\n";
  ps += "} | ConvertTo-Json -Depth 3";
  var r = runPS(ps, { timeoutMs: 10000 });
  if (!r) return [];
  return Array.isArray(r) ? r.slice(0, 50) : [r];
}

function getCursorPosition() {
  if (!enabled) return null;
  var r = runPS("Add-Type -AssemblyName System.Windows.Forms; $p=[System.Windows.Forms.Cursor]::Position; [PSCustomObject]@{x=$p.X;y=$p.Y} | ConvertTo-Json");
  if (!r) return { x: 0, y: 0 };
  return { x: r.x || 0, y: r.y || 0, timestamp: Date.now() };
}

function captureScreenshot(opts) {
  opts = opts || {};
  if (!enabled) return { error: "disabled" };
  var ts = Date.now();
  var dir = getDataDir();
  var fp = join(dir, "screenshot_" + ts + ".png");
  var ps = "";
  ps += "Add-Type -AssemblyName System.Windows.Forms,System.Drawing;\n";
  ps += "$s=[System.Windows.Forms.Screen]::PrimaryScreen;\n";
  ps += "$b=$s.Bounds;\n";
  ps += "$bm=New-Object System.Drawing.Bitmap $b.Width,$b.Height;\n";
  ps += "$g=[System.Drawing.Graphics]::FromImage($bm);\n";
  ps += "$g.CopyFromScreen($b.X,$b.Y,0,0,$b.Size);\n";
  ps += "$bm.Save('" + fp.replace(/\\/g, "\\\\") + "',[System.Drawing.Imaging.ImageFormat]::Png);\n";
  ps += "$g.Dispose();$bm.Dispose();\n";
  ps += "$fi=Get-Item '" + fp.replace(/\\/g, "\\\\") + "';\n";
  ps += "[PSCustomObject]@{width=$b.Width;height=$b.Height;sizeBytes=$fi.Length} | ConvertTo-Json";
  var r = runPS(ps, { timeoutMs: 10000 });
  screenshotCount++;
  if (!r) { lastScreenshot = { ok: false, error: lastError, ts: ts }; return lastScreenshot; }
  lastScreenshot = { ok: true, path: fp.replace(/\\/g, "/"), width: r.width, height: r.height, bytes: r.sizeBytes, ts: ts };
  console.log("[CU] Screenshot:", lastScreenshot.path);
  return lastScreenshot;
}

// ---------------------------------------------------------------------------
// Vision APIs (NEW)
// ---------------------------------------------------------------------------

/**
 * Analyze the current screen: capture + analyze in one call.
 * @param {object} opts - { providerId?, model?, systemPrompt?, useCache?, maxTokens?, timeoutMs? }
 */
async function analyzeCurrentScreen(opts) {
  if (!enabled) return { error: "disabled" };

  // 1. Capture screenshot
  var ss = captureScreenshot();
  if (!ss || !ss.ok) {
    return { error: "Screenshot capture failed", detail: lastError };
  }

  // 2. Get vision analyzer
  var analyzer = await _getVisionAnalyzer();
  if (!analyzer) {
    return {
      error: "Vision layer not available",
      screenshot: ss,
      degraded: true,
      summary: "Vision analysis requires LM Studio or another vision provider to be running."
    };
  }

  // 3. Analyze
  try {
    var result = await analyzer.analyzeFile(
      ss.path,
      { width: ss.width, height: ss.height, capturedAt: ss.ts },
      {
        providerId: (opts && opts.providerId) || undefined,
        model: (opts && opts.model) || undefined,
        systemPrompt: (opts && opts.systemPrompt) || undefined,
        useCache: (opts && opts.useCache !== undefined) ? opts.useCache : true,
        maxTokens: (opts && opts.maxTokens) || undefined,
        timeoutMs: (opts && opts.timeoutMs) || undefined
      }
    );
    return result;
  } catch (err) {
    return {
      error: "Analysis failed: " + (err.message || String(err)),
      screenshot: ss
    };
  }
}

/**
 * Analyze a previously captured screenshot file.
 * @param {string} screenshotPath - path to the PNG file
 * @param {object} opts - analysis options
 */
async function analyzeScreenshot(screenshotPath, opts) {
  if (!enabled) return { error: "disabled" };

  var analyzer = await _getVisionAnalyzer();
  if (!analyzer) {
    return { error: "Vision layer not available", degraded: true };
  }

  // Get image dimensions from file
  var width = 0, height = 0;
  try {
    var buf = readFileSync(screenshotPath);
    // Quick PNG header parse for dimensions
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      width = buf.readUInt32BE(16);
      height = buf.readUInt32BE(20);
    }
  } catch {}

  try {
    return await analyzer.analyzeFile(
      screenshotPath,
      { width, height, capturedAt: 0 },
      {
        providerId: (opts && opts.providerId) || undefined,
        model: (opts && opts.model) || undefined,
        systemPrompt: (opts && opts.systemPrompt) || undefined,
        useCache: (opts && opts.useCache !== undefined) ? opts.useCache : true,
        maxTokens: (opts && opts.maxTokens) || undefined,
        timeoutMs: (opts && opts.timeoutMs) || undefined
      }
    );
  } catch (err) {
    return { error: "Analysis failed: " + (err.message || String(err)) };
  }
}

/**
 * Get the most recent analysis result.
 */
function latestAnalysis() {
  if (_visionAnalyzer) {
    return _visionAnalyzer.getLatestAnalysis() || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Health & Diagnostics
// ---------------------------------------------------------------------------

function health() {
  var d = getDisplays();
  var w = listWindows();
  var c = getCursorPosition();
  return {
    status: enabled ? "ok" : "disabled",
    platform: os.platform(),
    displays: d.length,
    windows: w.length,
    cursorOk: !!c,
    lastScreenshot: lastScreenshot ? lastScreenshot.ts : null,
    lastError: lastError,
    screenshots: screenshotCount,
    vision: _visionAnalyzer ? "loaded" : "unavailable"
  };
}

var diagnostics = {
  name: "Computer Use Plugin",
  version: "1.0.0",
  capabilities: ["computer-use", "screen", "filesystem", "subprocess", "vision"],
  permissions: ["screen:capture", "filesystem:write"],
  platform: os.platform(),
  getStatus: health
};

module.exports = {
  activate,
  deactivate,
  getDesktopInfo,
  getDisplays,
  listWindows,
  getCursorPosition,
  captureScreenshot,
  // Vision APIs
  analyzeCurrentScreen,
  analyzeScreenshot,
  latestAnalysis,
  // Health
  health,
  diagnostics
};
