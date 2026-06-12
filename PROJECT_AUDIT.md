# PROJECT AUDIT — AionUi v2.1.16

**Generated:** 2026-06-11  
**Phase:** FOUNDATION — TASK-0001  
**Branch:** main (working tree)  
**Environment:** Windows x64 | Node v24.16.0 | Bun 1.3.14 | NPM 11.13.0  

---

## 1. EXECUTIVE SUMMARY

AionUi is a **multi-platform AI Chat desktop application** built with Electron + React + TypeScript. It transforms CLI-based AI agents (Codex CLI, OpenCLAW, etc.) into a modern GUI experience with conversation management, multi-provider AI support, plugin/extensibility, MCP (Model Context Protocol) integration, and team collaboration features.

| Aspect | Status |
|--------|--------|
| TypeScript strict | ✅ Zero errors |
| Build (electron-vite) | ✅ All 3 bundles pass |
| Runtime (Electron startup) | ✅ Launches without crash |
| Dependencies | ✅ 120 top-level packages installed |
| Test suite | ✅ Vitest 4 configured |

---

## 2. FOLDER STRUCTURE OVERVIEW

```
E:\Projects\AionUi\
├── packages/
│   ├── desktop/                  # Electron desktop app (main deliverable)
│   │   └── src/
│   │       ├── process/          # Electron Main process (Node.js APIs)
│   │       │   ├── backend/      #   AionCore backend binary launcher
│   │       │   ├── bridge/       #   IPC handler registrations (8 bridges)
│   │       │   ├── pet/          #   Desktop pet (idle companion overlay)
│   │       │   ├── resources/    #   Built-in MCP servers
│   │       │   ├── services/     #   Auto-updater, database, i18n
│   │       │   ├── startup/      #   Startup orchestration
│   │       │   └── utils/        #   Window lifecycle, tray, storage init
│   │       ├── preload/          # Electron Preload (contextBridge)
│   │       ├── renderer/         # Electron Renderer (React SPA, no Node.js)
│   │       │   ├── pages/        #   Conversation, GUID, Settings, Team, Cron, Login
│   │       │   ├── components/   #   Shared UI components (Arco Design)
│   │       │   ├── hooks/        #   Renderer-only hooks
│   │       │   ├── services/     #   i18n service
│   │       │   ├── styles/       #   Global CSS, Arco overrides
│   │       │   └── utils/        #   Renderer-only utilities
│   │       └── common/           # Shared types & APIs (Main + Renderer)
│   │           ├── adapter/      #   IPC bridge, WebSocket registry, HTTP bridge
│   │           ├── api/          #   AI provider clients (OpenAI, Anthropic, Gemini)
│   │           ├── chat/         #   Chat logic, document conversion, approvals
│   │           ├── config/       #   App config, storage, i18n config, themes
│   │           ├── platform/     #   Platform abstraction (Electron vs Node vs Web)
│   │           ├── types/        #   Shared TypeScript types
│   │           ├── update/       #   Auto-update types
│   │           └── utils/        #   Shared utilities
│   ├── shared-scripts/           # Build/prepare shared scripts (aioncore)
│   ├── web-host/                 # HTTP + WebSocket host for WebUI mode
│   └── web-cli/                  # CLI entry for WebUI mode
├── mobile/                       # React Native mobile app (Expo)
├── examples/                     # Extension examples (6 extensions)
├── tests/                        # E2E, integration, unit, contract tests
├── scripts/                      # Build, release, benchmarks, dev tooling
├── docs/                         # Architecture, contributing, theming guides
├── resources/                    # App icons, installer assets
├── public/                       # Static public assets
├── electron.vite.config.ts       # Build config (Vite-based)
├── vitest.config.ts              # Test config
├── playwright.config.ts          # E2E test config
├── tsconfig.json                 # TypeScript config
├── uno.config.ts                 # UnoCSS config
└── package.json                  # Root workspace (bun workspaces)
```

---

## 3. ARCHITECTURE DIAGRAM (Text-Based)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ELECTRON MAIN PROCESS                          │
│                     (packages/desktop/src/process/)                    │
│                                                                       │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────────────┐   │
│  │   Startup    │   │   Bridges    │   │   Services              │   │
│  │  Orchestrator│──▶│  (8 bridges) │   │  • autoUpdaterService   │   │
│  │              │   │              │   │  • database (SQLite)    │   │
│  │ 1. initStorage│  │ • application│   │  • i18n (main process)  │   │
│  │ 2. backend   │   │ • dialog     │   │                         │   │
│  │ 3. window    │   │ • theme      │   └───────────┬─────────────┘   │
│  │ 4. tray      │   │ • update     │               │                 │
│  └──────────────┘   │ • webui      │   ┌───────────▼─────────────┐   │
│                     │ • systemSet. │   │   AionCore Backend      │   │
│  ┌──────────────┐   │ • notif.     │   │   (Rust binary)         │   │
│  │  Desktop Pet │   │ • windowCtrl │   │   • REST API server     │   │
│  │  (overlay)   │   └──────┬───────┘   │   • Agent orchestration │   │
│  └──────────────┘          │           │   • MCP client          │   │
│                             │           │   • SQLite catalog      │   │
│  ┌──────────────┐          │           └─────────────────────────┘   │
│  │  Built-in    │          │                                         │
│  │  MCP Servers │          │                                         │
│  │  • Image Gen │          │                                         │
│  └──────────────┘          │                                         │
└─────────────────────────────┼─────────────────────────────────────────┘
                              │ IPC (contextBridge)
                              │
┌─────────────────────────────▼─────────────────────────────────────────┐
│                      ELECTRON PRELOAD                                  │
│                   (packages/desktop/src/preload/)                       │
│                                                                        │
│  contextBridge.exposeInMainWorld('electronAPI', {                      │
│    emit, on, getPathForFile, collectFeedbackLogs,                      │
│    captureFeedbackScreenshot                                           │
│  })                                                                    │
│  + __backendPort, __initialLanguage, tray events → DOM events          │
└─────────────────────────────┬──────────────────────────────────────────┘
                              │ window.electronAPI
                              │
┌─────────────────────────────▼──────────────────────────────────────────┐
│                     ELECTRON RENDERER (SPA)                             │
│                  (packages/desktop/src/renderer/)                        │
│                                                                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │Conversation│  │   GUID     │  │  Settings  │  │   Team     │      │
│  │  (Chat UI) │  │(Guided AI) │  │  (Config)  │  │(Collab)    │      │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘      │
│                                                                        │
│  ┌────────────┐  ┌────────────┐                                       │
│  │   Login    │  │    Cron    │                                       │
│  │  (Auth)    │  │ (Scheduler)│                                       │
│  └────────────┘  └────────────┘                                       │
│                                                                        │
│  State: React context + SWR (fetch caching) + zustand (local)          │
│  UI:    Arco Design + UnoCSS + CSS Modules                             │
│  Icons: @icon-park/react                                               │
│  i18n:  react-i18next                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. STARTUP FLOW

```
app.whenReady()
    │
    ├─ 1. configureChromium()              # App name, GPU flags, Sentry
    ├─ 2. initializeProcess()              # Path aliases, platform registration
    ├─ 3. initStorage()                    # Config/chat/env file stores
    │      ├─ migrateLegacyData()          # temp → userData migration
    │      ├─ ConfigStorage / EnvStorage   # JSON-file-backed key-value stores
    │      ├─ ensureAssistantDirs()        # assistants/, skills/, cron-skills/
    │      ├─ cleanupLegacyBuiltinSkillsDir()
    │      └─ runLegacyDatabaseMigrations() # Pre-v26 → v26 SQLite schema upgrade
    │
    ├─ 4. startBackendOrExit()             # Launch aioncore Rust binary
    │      └─ HTTP health check → port assigned
    │
    ├─ 5. initAllBridges()                 # Register 8 IPC handler groups
    │
    ├─ 6. Create BrowserWindow            # Main window
    │      ├─ Load renderer SPA (out/renderer/index.html)
    │      └─ Preload script injects electronAPI + backendPort
    │
    ├─ 7. createTray()                     # System tray icon
    ├─ 8. initAutoUpdater()                # Check for updates
    ├─ 9. WebUI auto-restore               # If WebUI was enabled last session
    │
    └─ 10. Deep link handling              # aionui:// protocol
```

**Key observation:** AionCore (Rust backend) is launched as a child process and the Electron main process communicates with it via HTTP (`localhost:{port}/api/...`). The backend owns the primary SQLite catalog for agents, conversations, and settings.

---

## 5. BUILD FLOW

```
bun run package  (electron-vite build)
    │
    ├─ Main process (SSR bundle)
    │   └─ out/main/index.js (1,678 KB)
    │       └─ Code-split chunks (static-server, petManager, etc.)
    │
    ├─ Preload (SSR bundle)
    │   └─ out/preload/index.js (4 KB)
    │       └─ Separate preloads for pet windows
    │
    ├─ Renderer (Client bundle)
    │   └─ out/renderer/index.html
    │       ├─ vendor-react.js
    │       ├─ vendor-arco.js
    │       ├─ vendor-markdown.js
    │       ├─ vendor-highlight.js
    │       ├─ vendor-editor.js (Monaco + CodeMirror)
    │       ├─ vendor-katex.js
    │       ├─ vendor-icons.js
    │       └─ vendor-diff.js
    │
    └─ Post-build: build-mcp-servers.js     # Compile built-in MCP entry scripts
```

**Build system:** `electron-vite` (Vite-based) with:
- `externalizeDepsPlugin` — node_modules externalized in main process
- `viteStaticCopy` — copies native addons/resources post-build
- `@sentry/vite-plugin` — sourcemap upload in production
- `UnoCSS` — atomic CSS generation
- Custom `iconParkPlugin` — tree-shakes @icon-park/react icons

---

## 6. IPC FLOW

### Bridge Architecture

```
Renderer                    Preload                    Main Process
─────────                   ───────                    ────────────
                                                      
window.electronAPI          contextBridge              ipcMain.handle
  .emit(name, data)  ────▶  ipcRenderer.invoke  ────▶  ADAPTER_BRIDGE_EVENT_KEY
                            (ADAPTER_BRIDGE_EVENT_KEY)    │
                                                          ├─ bridge.emit()
                                                          │   ├─ Electron windows
                                                          │   ├─ Pet windows
                                                          │   └─ WebSocket clients
                                                          │
window.electronAPI          contextBridge     ◀──────── ipcMain.on
  .on(callback)      ◀────  ipcRenderer.on            (per-bridge channels)
```

### 8 Bridge Modules

| Bridge | Purpose |
|--------|---------|
| `applicationBridge` | Window show/hide, app quit/relaunch |
| `dialogBridge` | Native file/folder dialogs |
| `themeBridge` | Theme CSS injection, system theme |
| `updateBridge` | Auto-update check, download, install |
| `webuiBridge` | WebUI port, remote access, status |
| `systemSettingsBridge` | OS-level settings (power, notifications) |
| `notificationBridge` | Native OS notifications |
| `windowControlsBridge` | Maximize, minimize, fullscreen events |

### Sync Channels (preload bootstrap)

- `get-backend-port` — Synchronously fetch aioncore port
- `get-initial-language` — Sync language for first render
- `get-backend-startup-failed` — Backend health for error screen

### WebSocket Registry (WebUI mode)

In WebUI mode, instead of Electron IPC, a WebSocket server broadcasts events to connected browser clients via `registerWebSocketBroadcaster()`.

---

## 7. AI PROVIDER SYSTEM (Existing)

### Provider Clients (`packages/desktop/src/common/api/`)

The system supports **multi-protocol AI providers** with automatic protocol conversion:

| Client | File | Protocol |
|--------|------|----------|
| `OpenAIRotatingClient` | `OpenAIRotatingClient.ts` | OpenAI Chat Completions |
| `AnthropicRotatingClient` | `AnthropicRotatingClient.ts` | Anthropic Messages |
| `GeminiRotatingClient` | `GeminiRotatingClient.ts` | Google Generative AI |
| `RotatingApiClient` | `RotatingApiClient.ts` | Generic OpenAI-compatible |

### Protocol Converters

- `OpenAI2AnthropicConverter.ts` — Translates OpenAI-format requests to Anthropic API
- `OpenAI2GeminiConverter.ts` — Translates OpenAI-format requests to Gemini API
- `ProtocolConverter.ts` — Base converter interface

### Key Management

- `ApiKeyManager.ts` — Multi-key rotation for rate-limit mitigation
- `ClientFactory.ts` — Creates appropriate client for platform + model

### Provider Types

Defined in `common/types/provider/providerApi.ts`:
- `TProviderWithModel` — Platform, base_url, api_key, use_model
- `speech.ts` — TTS/STT provider types

### Provider Configuration

Stored in `ProcessEnv` (`.aionui-env` file) via `EnvStorage`, which is a JSON-file-backed key-value store. The backend (aioncore) also maintains its own provider registry in SQLite.

**Observation:** Provider configuration flows from the Settings UI → backend HTTP API → SQLite. The `EnvStorage` legacy file is kept for backward compatibility but is secondary to the backend store.

---

## 8. EXTENSIBILITY / PLUGIN SYSTEM

### Extension Examples (`examples/`)

| Extension | Purpose |
|-----------|---------|
| `hello-world-extension` | Minimal template extension |
| `acp-adapter-extension` | ACP (Agent Communication Protocol) adapter |
| `e2e-full-extension` | Full-featured E2E extension |
| `ext-feishu` | Feishu/Lark integration |
| `ext-wecom-bot` | WeCom bot integration |
| `star-office-extension` | Star Office (WPS) integration |

### MCP Integration (`packages/desktop/src/process/resources/builtinMcp/`)

- **Built-in MCP server:** `imageGenServer.ts` — Image generation via MCP stdio protocol
- Uses `@modelcontextprotocol/sdk` (server + stdio transport)
- Config passed via environment variables (`AIONUI_IMG_*`)
- Post-build script (`scripts/build-mcp-servers.js`) compiles MCP entry scripts alongside the main bundle

### Desktop Pet System (`packages/desktop/src/process/pet/`)

A quirky extensibility point: desktop companion overlay with:
- `petManager.ts` — Window lifecycle
- `petStateMachine.ts` — State transitions
- `petIdleTicker.ts` — Idle animation timer
- `petEventBridge.ts` — IPC events → pet reactions

### Skills Hub

- `packages/desktop/src/renderer/pages/settings/SkillsHubSettings.tsx` — UI for managing skills
- Skills directories: `skills/`, `cron-skills/` under user data
- Backend (aioncore) owns the skill catalog in SQLite

### WebUI Mode

The `web-host` package enables running AionUi as a headless web server:
- `packages/web-host/src/` — Express-based HTTP server + WebSocket
- `packages/web-cli/` — CLI entry for `bun run webui`
- Accessible from any browser on the network (remote mode)

---

## 9. STATE MANAGEMENT

| Layer | Technology | Scope |
|-------|-----------|-------|
| **Backend** | SQLite (aioncore Rust) | Agents, conversations, settings, users, teams |
| **Main Process** | JSON files (ConfigStorage, EnvStorage) | Legacy config, provider env vars, chat cache |
| **Main Process** | SQLite (better-sqlite3) | Legacy DB migrations, pre-v26 schema |
| **Renderer** | SWR (stale-while-revalidate) | Server state from backend HTTP API |
| **Renderer** | React Context | Auth, theme, platform info |
| **Renderer** | Zustand (inferred) | Local UI state |
| **Renderer** | react-i18next | i18n translations |

---

## 10. STORAGE SYSTEM

### File-Based (Main Process)

| Store | File | Purpose |
|-------|------|---------|
| `ConfigStorage` | `{userData}/config/aionui-config.txt` | App configuration (JSON → base64 → file) |
| `EnvStorage` | `{userData}/config/.aionui-env` | API keys, provider URLs |
| `ProcessChat` | `{userData}/data/aionui-chat.txt` | Chat conversation cache |
| `ProcessChatMessage` | `{userData}/data/aionui-chat-message.txt` | Chat messages cache |

### SQLite (Backend + Main Process)

- **aioncore backend:** Owns the primary SQLite catalog (agents, conversations, settings, users, teams, skills)
- **Main process:** `better-sqlite3` driver for legacy migrations and team database
- Schema includes: `users`, `conversations`, `messages`, `teams`, `team_members`, `team_conversations`, `settings`

### Key Directories

```
{userData}/
├── config/
│   ├── aionui-config.txt
│   └── .aionui-env
├── data/
│   ├── aionui-chat.txt
│   ├── aionui-chat-message.txt
│   └── *.db (SQLite)
├── assistants/
├── skills/
├── cron-skills/
└── temp/
```

---

## 11. SETTINGS SYSTEM

### Flow

```
Settings UI (Renderer) → configService → HTTP → /api/settings/client (Backend)
                                                       │
                                                       └─ SQLite store
```

- `configService.ts` — Client-side settings API wrapper
- `configKeys.ts` — Typed setting key definitions
- `configMigration.ts` — Version-aware settings migration
- `storageKeys.ts` — Storage key constants
- `i18n-config.json` — Language and module configuration

### Settings Pages

- `AgentSettings/LocalAgents.tsx` — Local agent configuration
- `AppearanceSettings/` — Theme, CSS themes, fonts
- `SkillsHubSettings.tsx` — Skill management
- `AddPlatformModal.tsx` — Add AI provider platform
- `EditModeModal.tsx` — Agent edit modes

---

## 12. ENTRY POINTS

| Entry | Path | Mode |
|-------|------|------|
| Electron Main | `packages/desktop/src/process/index.ts` → `out/main/index.js` | Desktop |
| Electron Preload | `packages/desktop/src/preload/main.ts` → `out/preload/index.js` | Desktop |
| Electron Renderer | `packages/desktop/src/renderer/index.html` | Desktop |
| WebUI | `scripts/webui.ts` → `packages/web-cli/` | Web |
| Mobile | `mobile/src/` (Expo) | Mobile |
| Password Reset CLI | `scripts/resetpass.ts` | CLI |

---

## 13. OBSERVATIONS & METRICS

| Metric | Value |
|--------|-------|
| Total TypeScript/TSX files | ~1,228 |
| Main process modules | 60 |
| Renderer modules | 754 |
| Common (shared) modules | 90 |
| Test files | 320 |
| Renderer bundle size | ~10,458 modules transformed |
| Main bundle size | 1,678 KB (uncompressed) |
| Code-split chunks | 8 vendor chunks + dynamic imports |
| TypeScript version | 5.9.3 (strict mode) |
| Test framework | Vitest 4 + Playwright |
| Linting | Oxlint (with Oxfmt formatting) |
| Package manager | Bun (workspaces) |

---

## 14. RISKS / ISSUES

### 🔴 High

None identified in the FOUNDATION phase.

### 🟡 Medium

1. **Dual storage systems** — Both file-based JSON stores (ConfigStorage) and SQLite (backend + main process) coexist. Settings read from the backend but the legacy files persist, creating potential for stale data. The codebase is actively migrating to backend-owned storage.

2. **Large renderer bundle** — 10,458 modules with chunk warnings ("Some chunks are larger than 1500 kB"). Code-splitting is already in place (8 vendor chunks), but further optimization may be needed.

3. **Native module fragility** — `better-sqlite3` and `@mapbox/node-pre-gyp` require native compilation. The build uses `electronRebuild` for native addons. First-attempt builds can fail transiently due to native module timing (observed during STEP 3).

### 🟢 Low

1. **"use client" warnings** — Several React dependencies (react-router, swr, streamdown) emit "Module level directives cause errors when bundled" warnings. These are cosmetic and handled correctly by the bundler.

2. **Circular chunk dependency** — `vendor-editor → vendor-highlight → vendor-arco → vendor-react → vendor-editor`. The bundler warns but handles it gracefully.

---

## 15. RECOMMENDATIONS (Non-Invasive Only)

1. **Consider consolidating storage** — Complete the migration from file-based ConfigStorage to backend-managed SQLite to eliminate dual-write paths and stale data risks.

2. **Add build caching** — The renderer bundle transforms 10,458 modules each build. Consider `vite-plugin-inspect` or build cache to speed up incremental builds.

3. **Monitor chunk sizes** — The main bundle (1,678 KB) and vendor chunks approach the 1,500 KB warning threshold. Consider further dynamic imports for rarely-used features.

4. **Document native module rebuild** — The transient first-build failure due to `@mapbox/node-pre-gyp` could confuse new contributors. A note in CONTRIBUTING.md about `bun run postinstall` would help.

5. **WebUI health check** — The WebUI auto-restore feature depends on the backend being healthy. Consider adding a retry mechanism with backoff for scenarios where the backend starts slowly.

---

## 16. VERIFICATION RESULTS

| Step | Status | Detail |
|------|--------|--------|
| STEP 1 — Environment Check | ✅ PASS | Node v24.16.0, Bun 1.3.14, CWD confirmed |
| STEP 2 — Dependency Check | ✅ PASS | 120 packages installed, tsc 5.9.3, vitest 4.1.0 |
| STEP 3 — Build Verification | ✅ PASS | Main (1,678 KB), Preload (4 KB), Renderer all built |
| STEP 4 — Runtime Verification | ✅ PASS | Electron launched, survived 15s without crash |
| STEP 5 — Architecture Audit | ✅ PASS | This document |

---

## 17. CONCLUSION

AionUi v2.1.16 is a **well-structured, production-grade Electron + React application**. The architecture cleanly separates main process (Node.js) from renderer (browser), uses a typed IPC bridge, supports multiple AI providers with protocol conversion, and includes extensibility via MCP servers and extension examples. The codebase follows strict TypeScript conventions, has comprehensive test coverage (320 test files), and builds cleanly on Windows.

**FOUNDATION phase: PASS ✅**

No code changes were required — the project is stable and buildable as-is.
