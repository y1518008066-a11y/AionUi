/**
 * Jarvis Workspace ¡ª Main Page
 *
 * Three-panel layout: Sidebar | Chat | Right Panel
 * Connected to JarvisAgentService for full pipeline:
 *   UI ¡ú AgentService ¡ú LLM (streaming) ¡ú ActionEngine ¡ú Plugin ¡ú Backend
 */

import React, { useState, useCallback } from "react";
import JarvisSidebar from "../../components/jarvis/workspace/JarvisSidebar";
import JarvisChatView from "../../components/jarvis/workspace/JarvisChatView";
import JarvisRightPanel from "../../components/jarvis/workspace/JarvisRightPanel";
import JarvisComposer from "../../components/jarvis/workspace/JarvisComposer";
import type { ModeInfo } from "../../components/jarvis/JarvisModeConfig";
import type { ProviderInfo } from "../../components/jarvis/ProviderCenterUI";
import type { PluginInfo } from "../../components/jarvis/JarvisPluginManager";
import type { ToolCallState } from "./JarvisAgentService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    status: "pending" | "running" | "completed" | "failed";
    result?: unknown;
    durationMs?: number;
  }>;
  streaming?: boolean;
  agentStatus?: "idle" | "thinking" | "acting" | "streaming" | "completed" | "error";
};

type JarvisWorkspaceProps = {
  modes: ModeInfo[];
  activeModeId: string | null;
  providers: ProviderInfo[];
  activeProviderId: string | null;
  plugins: PluginInfo[];
  onSwitchMode: (modeId: string) => Promise<void>;
  onSwitchProvider: (providerId: string) => Promise<void>;
  onSendMessage: (text: string, attachments?: File[]) => Promise<void>;
  onStopGeneration?: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const JarvisWorkspace: React.FC<JarvisWorkspaceProps> = ({
  modes,
  activeModeId,
  providers,
  activeProviderId,
  plugins,
  onSwitchMode,
  onSwitchProvider,
  onSendMessage,
  onStopGeneration,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentStatus, setAgentStatus] = useState<ChatMessage["agentStatus"]>("idle");
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallState[]>([]);

  const handleSend = useCallback(async (text: string, attachments?: File[]) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent(null);
    setStreamingMessageId(null);
    setActiveToolCalls([]);
    setAgentStatus("thinking");

    try {
      await onSendMessage(text, attachments);
    } catch {
      setAgentStatus("error");
    } finally {
      setIsStreaming(false);
      setAgentStatus("idle");
    }
  }, [onSendMessage]);

  // -------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------
  const S = {
    container: {
      display: "flex",
      height: "100vh",
      width: "100%",
      overflow: "hidden",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "var(--color-text-primary, #1a1a2e)",
      backgroundColor: "var(--color-bg-primary, #fff)",
    } as React.CSSProperties,
    sidebar: (collapsed: boolean) => ({
      width: collapsed ? 48 : 260,
      minWidth: collapsed ? 48 : 260,
      transition: "width 0.2s",
      borderRight: "1px solid var(--color-border, #e0e0e0)",
      overflow: "hidden" as const,
      display: "flex",
      flexDirection: "column" as const,
    }),
    main: {
      flex: 1,
      display: "flex",
      flexDirection: "column" as const,
      minWidth: 0,
    },
    chatArea: {
      flex: 1,
      overflowY: "auto" as const,
      padding: "16px 24px",
    },
    rightPanel: (collapsed: boolean) => ({
      width: collapsed ? 0 : 280,
      minWidth: collapsed ? 0 : 280,
      transition: "width 0.2s",
      borderLeft: "1px solid var(--color-border, #e0e0e0)",
      overflow: "hidden" as const,
      display: collapsed ? "none" : "flex",
      flexDirection: "column" as const,
    }),
    toggleBtn: {
      padding: "4px 8px",
      cursor: "pointer",
      border: "none",
      background: "transparent",
      fontSize: 14,
      color: "var(--color-text-tertiary, #999)",
    },
  };

  return (
    <div style={S.container}>
      {/* Sidebar */}
      <div style={S.sidebar(sidebarCollapsed)}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: 4 }}>
          <button style={S.toggleBtn} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? "?" : "?"}
          </button>
        </div>
        {!sidebarCollapsed && (
          <JarvisSidebar
            modes={modes}
            activeModeId={activeModeId}
            providers={providers}
            activeProviderId={activeProviderId}
            plugins={plugins}
            onSwitchMode={onSwitchMode}
            onSwitchProvider={onSwitchProvider}
          />
        )}
      </div>

      {/* Main Chat Area */}
      <div style={S.main}>
        <div style={S.chatArea}>
          <JarvisChatView
            messages={messages}
            streamingContent={streamingContent}
            activeToolCalls={activeToolCalls}
            agentStatus={agentStatus}
            streamingMessageId={streamingMessageId}
          />
        </div>
        <JarvisComposer onSend={handleSend} onStop={onStopGeneration} isStreaming={isStreaming} onScreenshot={handleScreenshot} />
      </div>

      {/* Right Panel */}
      <div style={S.rightPanel(rightPanelCollapsed)}>
        <div style={{ display: "flex", justifyContent: "flex-start", padding: 4 }}>
          <button style={S.toggleBtn} onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}>
            {rightPanelCollapsed ? "?" : "?"}
          </button>
        </div>
        <JarvisRightPanel
          modes={modes}
          activeModeId={activeModeId}
          providers={providers}
          activeProviderId={activeProviderId}
          plugins={plugins}
          agentStatus={agentStatus}
          messageCount={messages.length}
        />
      </div>
    </div>
  );
};

export default JarvisWorkspace;
export type { ChatMessage };
