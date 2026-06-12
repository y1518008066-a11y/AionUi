/**
 * Jarvis Route ！ Production entry point wired to real runtime managers.
 *
 * All state flows through:
 *   ModeManager  ！ mode switching + plugin orchestration
 *   ProviderCenter ！ provider activation + model selection
 *   PluginManager ！ enable/disable/reload
 *   BackendManager ！ screenshot/monitoring backends
 *   AgentRuntime  ！ Reason★Act★Observe (via JarvisAgentService)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import JarvisWorkspace from "./index";
import { getAgentService } from "./JarvisAgentService";
import {
  getModeManager,
  getPluginManager,
  getProviderCenter,
  getBackendManager,
} from "@/common/jarvisBridge";
import type { ToolCallState } from "./JarvisAgentService";
import type { ChatMessage } from "./index";
import type { ModeInfo } from "../../components/jarvis/JarvisModeConfig";
import type { ProviderInfo } from "../../components/jarvis/ProviderCenterUI";
import type { PluginInfo } from "../../components/jarvis/JarvisPluginManager";

// ---------------------------------------------------------------------------
// Fallback defaults (used before systems initialize)
// ---------------------------------------------------------------------------

const FALLBACK_MODES: ModeInfo[] = [
  { id: "default", label: "Default", description: "Initializing...", icon: "??", activePlugins: [], permissionLevel: "standard", builtin: true },
];

const FALLBACK_PROVIDERS: ProviderInfo[] = [
  {
    providerId: "lmstudio", name: "LM Studio", type: "lmstudio", enabled: true, active: true,
    health: { reachable: false, connected: false, latencyMs: 0, endpoint: "http://127.0.0.1:1234", protocol: null, providerType: "lmstudio", modelCount: 0, lastChecked: null, lastError: null, consecutiveFailures: 0 },
    modelCount: 0, requestCount: 0,
  },
];

const FALLBACK_PLUGINS: PluginInfo[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert ModeManager data to UI ModeInfo format. */
function modeProfileToModeInfo(mode: any): ModeInfo {
  return {
    id: mode.id,
    label: mode.label || mode.id,
    description: mode.description || "",
    icon: mode.icon || "??",
    activePlugins: mode.rules?.activePlugins || [],
    permissionLevel: mode.rules?.permissionLevel || "standard",
    builtin: true,
  };
}

/** Convert ProviderCenter data to UI ProviderInfo format. */
function providerStatusToProviderInfo(p: any): ProviderInfo {
  return {
    providerId: p.providerId || p.id,
    name: p.name || p.providerId,
    type: p.type || "unknown",
    enabled: p.enabled !== false,
    active: p.active === true,
    health: {
      reachable: p.health?.reachable || false,
      connected: p.health?.connected || false,
      latencyMs: p.health?.latencyMs || 0,
      endpoint: p.health?.endpoint || "",
      protocol: p.health?.protocol || null,
      providerType: p.health?.providerType || "",
      modelCount: p.health?.modelCount || 0,
      lastChecked: p.health?.lastChecked || null,
      lastError: p.health?.lastError || null,
      consecutiveFailures: p.health?.consecutiveFailures || 0,
    },
    modelCount: p.modelCount || 0,
    requestCount: p.requestCount || 0,
  };
}

/** Convert PluginManager data to UI PluginInfo format. */
function pluginEntryToPluginInfo(p: any): PluginInfo {
  return {
    id: p.id || p.manifest?.id || "",
    name: p.name || p.manifest?.name || "",
    version: p.version || p.manifest?.version || "0.0.0",
    author: p.author || p.manifest?.author || "",
    description: p.description || p.manifest?.description || "",
    enabled: p.enabled || false,
    state: p.state || p.status || "unknown",
    capabilities: p.capabilities || [],
    permissions: p.permissions || [],
    dependencies: p.dependencies || [],
    loadTimeMs: p.loadTimeMs || 0,
    lastError: p.lastError || null,
  };
}

// ---------------------------------------------------------------------------
// Route Component
// ---------------------------------------------------------------------------

const JarvisRoute: React.FC = () => {
  const agentService = useRef(getAgentService());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Runtime state ！ sourced from real managers
  const [modes, setModes] = useState<ModeInfo[]>(FALLBACK_MODES);
  const [providers, setProviders] = useState<ProviderInfo[]>(FALLBACK_PROVIDERS);
  const [plugins, setPlugins] = useState<PluginInfo[]>(FALLBACK_PLUGINS);
  const [activeModeId, setActiveModeId] = useState<string | null>("default");
  const [activeProviderId, setActiveProviderId] = useState<string | null>("lmstudio");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallState[]>([]);
  const [agentStatus, setAgentStatus] = useState<ChatMessage["agentStatus"]>("idle");
  const [isStreaming, setIsStreaming] = useState(false);

  // -------------------------------------------------------------------
  // Poll managers for live state (only until EventBus integration)
  // -------------------------------------------------------------------
  const refreshState = useCallback(() => {
    const mm = getModeManager();
    const pc = getProviderCenter();
    const pm = getPluginManager();

    if (mm) {
      try {
        const modeList = mm.listModes?.() || [];
        setModes(modeList.map(modeProfileToModeInfo));
        setActiveModeId(mm.activeModeId ?? "default");
      } catch (e) { /* ignore polling errors */ }
    }

    if (pc) {
      try {
        const provList = pc.listProviders?.() || [];
        setProviders(provList.map(providerStatusToProviderInfo));
        setActiveProviderId(pc.activeProviderId ?? "lmstudio");
      } catch (e) { /* ignore */ }
    }

    if (pm) {
      try {
        const plugList = (pm as any).list?.() || [];
        setPlugins(plugList.map(pluginEntryToPluginInfo));
      } catch (e) { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    // Initial refresh
    refreshState();
    // Poll every 2s until EventBus integration
    pollRef.current = setInterval(refreshState, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshState]);

  // -------------------------------------------------------------------
  // Register callbacks with agent service
  // -------------------------------------------------------------------
  useEffect(() => {
    const svc = agentService.current;
    svc.setCallbacks({
      onStreamChunk: (msgId, chunk) => {
        setStreamingMessageId(msgId);
        setStreamingContent((prev) => (prev || "") + chunk);
      },
      onToolCallStart: (_msgId, tc) => {
        setActiveToolCalls((prev) => {
          const existing = prev.findIndex((t) => t.id === tc.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = tc;
            return updated;
          }
          return [...prev, tc];
        });
        setAgentStatus("acting");
      },
      onToolCallComplete: (_msgId, tc) => {
        setActiveToolCalls((prev) =>
          prev.map((t) => (t.id === tc.id ? tc : t))
        );
      },
      onStatusChange: (status) => {
        setAgentStatus(status);
        if (status === "completed" || status === "error" || status === "idle") {
          setIsStreaming(false);
        }
      },
      onComplete: (message) => {
        setMessages((prev) => [...prev, message]);
        setStreamingContent(null);
        setStreamingMessageId(null);
        setActiveToolCalls([]);
        setIsStreaming(false);
      },
      onError: (msgId, error) => {
        const errorMsg: ChatMessage = {
          id: msgId,
          role: "assistant",
          content: `? Error: ${error}`,
          timestamp: Date.now(),
          agentStatus: "error",
        };
        setMessages((prev) => [...prev, errorMsg]);
        setStreamingContent(null);
        setStreamingMessageId(null);
        setActiveToolCalls([]);
        setIsStreaming(false);
      },
    });
  }, []);

  // -------------------------------------------------------------------
  // Mode switching ！ through real ModeManager
  // -------------------------------------------------------------------
  const handleSwitchMode = useCallback(async (modeId: string) => {
    const mm = getModeManager();
    if (mm) {
      try {
        await mm.switchMode(modeId);
        console.log("[JarvisRoute] Mode switched via ModeManager:", modeId);
      } catch (e) {
        console.error("[JarvisRoute] Mode switch failed:", e);
      }
    } else {
      console.warn("[JarvisRoute] ModeManager not available ！ using local state");
    }
    setActiveModeId(modeId);
    refreshState();
  }, [refreshState]);

  // -------------------------------------------------------------------
  // Provider switching ！ through real ProviderCenter
  // -------------------------------------------------------------------
  const handleSwitchProvider = useCallback(async (providerId: string) => {
    const pc = getProviderCenter();
    if (pc) {
      try {
        await pc.activateProvider(providerId);
        console.log("[JarvisRoute] Provider activated via ProviderCenter:", providerId);
      } catch (e) {
        console.error("[JarvisRoute] Provider activation failed:", e);
      }
    }
    setActiveProviderId(providerId);
    agentService.current.updateConfig({ providerId });
    if (providerId === "lmstudio") {
      agentService.current.updateConfig({ baseUrl: "http://127.0.0.1:1234/v1" });
    }
    refreshState();
  }, [refreshState]);

  // -------------------------------------------------------------------
  // Plugin enable/disable ！ through real PluginManager
  // -------------------------------------------------------------------
  const handleTogglePlugin = useCallback(async (pluginId: string, enable: boolean) => {
    const pm = getPluginManager();
    if (pm) {
      try {
        if (enable) {
          await pm.enable(pluginId);
        } else {
          await pm.disable(pluginId);
        }
        console.log("[JarvisRoute] Plugin " + (enable ? "enabled" : "disabled") + ":", pluginId);
      } catch (e) {
        console.error("[JarvisRoute] Plugin toggle failed:", e);
      }
    }
    refreshState();
  }, [refreshState]);

  // -------------------------------------------------------------------
  // Send message ！ through AgentService
  // -------------------------------------------------------------------
  const handleSendMessage = useCallback(async (text: string, attachments?: File[]) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent(null);
    setStreamingMessageId(null);
    setActiveToolCalls([]);

    try {
      await agentService.current.sendMessage(text, messages, attachments);
    } catch (err) {
      console.error("[JarvisRoute] sendMessage error:", err);
    }
  }, [messages]);

  // -------------------------------------------------------------------
  // Stop generation
  // -------------------------------------------------------------------
  const handleStopGeneration = useCallback(() => {
    agentService.current.stop();
    setIsStreaming(false);
  }, []);

  // -------------------------------------------------------------------
  // Screenshot ！ through real BackendManager
  // -------------------------------------------------------------------
  const handleScreenshot = useCallback(async () => {
    const bm = getBackendManager();
    if (bm) {
      try {
        const adapter = (bm as any).getComputerUseAdapter?.();
        if (adapter) {
          const screenshot = await adapter.captureScreenshot();
          console.log("[JarvisRoute] Screenshot captured:", screenshot?.width + "x" + screenshot?.height);
        } else {
          console.warn("[JarvisRoute] No ComputerUse adapter available");
        }
      } catch (e) {
        console.error("[JarvisRoute] Screenshot failed:", e);
      }
    } else {
      console.log("[JarvisRoute] BackendManager not available");
    }
  }, []);

  return (
    <JarvisWorkspace
      modes={modes}
      activeModeId={activeModeId}
      providers={providers}
      activeProviderId={activeProviderId}
      plugins={plugins}
      onSwitchMode={handleSwitchMode}
      onSwitchProvider={handleSwitchProvider}
      onSendMessage={handleSendMessage}
      onStopGeneration={handleStopGeneration}
    />
  );
};

export default JarvisRoute;
