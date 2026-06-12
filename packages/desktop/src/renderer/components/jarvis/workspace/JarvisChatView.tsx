/**
 * Jarvis Chat View — Message list with streaming, tool call visualization,
 * and real-time incremental updates.
 *
 * Renders conversation messages, live-streaming content, tool call
 * execution status, and agent state indicators.
 */

import React, { useRef, useEffect, useMemo } from "react";
import type { ChatMessage } from "../../../pages/jarvis";
import type { ToolCallState } from "../../../pages/jarvis/JarvisAgentService";

type Props = {
  messages: ChatMessage[];
  /** Currently streaming assistant message (incremental). */
  streamingContent: string | null;
  /** Active tool calls with live status. */
  activeToolCalls?: ToolCallState[];
  /** Overall agent status. */
  agentStatus: ChatMessage["agentStatus"];
  /** Active streaming message id. */
  streamingMessageId: string | null;
};

const S = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  empty: {
    textAlign: "center" as const,
    padding: 60,
    color: "var(--color-text-tertiary, #999)",
    fontSize: 15,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--color-text-secondary, #888)",
    margin: "0 0 8px",
  },
  emptySub: {
    fontSize: 13,
    color: "var(--color-text-tertiary, #aaa)",
    margin: "4px 0",
  },
  msgRow: (role: string) => ({
    display: "flex",
    gap: 12,
    justifyContent: role === "user" ? "flex-end" : "flex-start",
    animation: "fadeIn 0.2s ease",
  }),
  avatar: (role: string) => ({
    width: 32,
    height: 32,
    borderRadius: 16,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    backgroundColor: role === "user"
      ? "var(--color-primary, #4f46e5)"
      : "#10b981",
    color: "#fff",
  }),
  bubble: (role: string) => ({
    maxWidth: "75%",
    padding: "12px 16px",
    borderRadius: 12,
    backgroundColor: role === "user"
      ? "var(--color-primary, #4f46e5)"
      : "var(--color-bg-secondary, #f3f4f6)",
    color: role === "user"
      ? "#fff"
      : "var(--color-text-primary, #1a1a2e)",
    fontSize: 14,
    lineHeight: 1.65,
    wordBreak: "break-word" as const,
  }),
  content: {
    whiteSpace: "pre-wrap" as const,
  },
  streamingCursor: {
    display: "inline-block",
    width: 2,
    height: 16,
    backgroundColor: "var(--color-primary, #4f46e5)",
    marginLeft: 2,
    animation: "blink 0.8s infinite",
    verticalAlign: "text-bottom",
  },
  // Tool call styles
  toolCallCard: {
    marginTop: 8,
    padding: "10px 14px",
    borderRadius: 8,
    backgroundColor: "rgba(245,158,11,0.08)",
    border: "1px solid rgba(245,158,11,0.2)",
    fontSize: 12,
    fontFamily: "system-ui, -apple-system, sans-serif",
    transition: "all 0.15s ease",
  },
  toolCallHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  toolCallName: {
    fontWeight: 600,
    color: "#92400e",
  },
  toolCallStatus: (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      pending: { bg: "rgba(107,114,128,0.12)", color: "#6b7280" },
      running: { bg: "rgba(37,99,235,0.12)", color: "#2563eb" },
      completed: { bg: "rgba(22,163,74,0.12)", color: "#16a34a" },
      failed: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
    };
    const c = colors[status] || colors.pending;
    return {
      fontSize: 10,
      fontWeight: 600,
      padding: "1px 6px",
      borderRadius: 6,
      backgroundColor: c.bg,
      color: c.color,
    };
  },
  toolArgs: {
    fontSize: 11,
    color: "var(--color-text-secondary, #666)",
    fontFamily: "monospace",
    marginTop: 4,
    padding: "6px 8px",
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 4,
    overflowX: "auto" as const,
    whiteSpace: "pre-wrap" as const,
    maxHeight: 120,
    overflowY: "auto" as const,
  },
  toolResult: {
    fontSize: 11,
    marginTop: 4,
    padding: "6px 8px",
    backgroundColor: "rgba(22,163,74,0.06)",
    borderRadius: 4,
    borderLeft: "2px solid #16a34a",
    color: "var(--color-text-secondary, #666)",
    fontFamily: "monospace",
    maxHeight: 200,
    overflowY: "auto" as const,
  },
  toolDuration: {
    fontSize: 10,
    color: "var(--color-text-tertiary, #999)",
    marginLeft: "auto",
  },
  // Status bar
  statusBar: {
    display: "flex",
    justifyContent: "center",
    padding: "8px 0",
    gap: 8,
  },
  statusBadge: (status: string | undefined) => {
    const icons: Record<string, string> = {
      idle: "",
      thinking: "🤔",
      acting: "⚡",
      streaming: "📝",
      completed: "✅",
      error: "❌",
    };
    const colors: Record<string, string> = {
      idle: "#d1d5db",
      thinking: "#f59e0b",
      acting: "#3b82f6",
      streaming: "#8b5cf6",
      completed: "#16a34a",
      error: "#ef4444",
    };
    const color = colors[status || ""] || "#d1d5db";
    return {
      fontSize: 12,
      fontWeight: 600,
      padding: "4px 14px",
      borderRadius: 12,
      backgroundColor: color + "18",
      color,
      display: "flex",
      alignItems: "center",
      gap: 4,
    };
  },
  // Spinner
  spinner: {
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid var(--color-border, #d1d5db)",
    borderTopColor: "var(--color-primary, #4f46e5)",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
  },
};

// Inline keyframe styles injected once
const KEYFRAMES = `
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
`;

const JarvisChatView: React.FC<Props> = ({
  messages,
  streamingContent,
  activeToolCalls = [],
  agentStatus,
  streamingMessageId,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, activeToolCalls]);

  const isThinking = agentStatus === "thinking";
  const isStreaming = agentStatus === "streaming";
  const isActing = agentStatus === "acting";

  // Merge streaming content into messages for display
  const displayMessages = useMemo(() => {
    if (!streamingContent && activeToolCalls.length === 0) return messages;

    const result = [...messages];

    // Add/update streaming message
    if (streamingMessageId && streamingContent !== null) {
      const existing = result.findIndex((m) => m.id === streamingMessageId);
      const streamMsg: ChatMessage = {
        id: streamingMessageId,
        role: "assistant",
        content: streamingContent,
        timestamp: Date.now(),
        toolCalls: activeToolCalls.length > 0 ? activeToolCalls : undefined,
        streaming: true,
        agentStatus,
      };
      if (existing >= 0) {
        result[existing] = streamMsg;
      } else {
        result.push(streamMsg);
      }
    }

    return result;
  }, [messages, streamingContent, activeToolCalls, streamingMessageId, agentStatus]);

  if (displayMessages.length === 0 && !isThinking && !isStreaming && !isActing) {
    return (
      <div style={S.container}>
        <style>{KEYFRAMES}</style>
        <div style={S.empty}>
          <p style={S.emptyTitle}>✨ Jarvis Workspace</p>
          <p style={S.emptySub}>Ask anything or use /commands to get started.</p>
          <p style={{ ...S.emptySub, fontSize: 11, marginTop: 8 }}>
            Available: /weather · /search · /screenshot · /analyze
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <style>{KEYFRAMES}</style>

      {displayMessages.map((msg, idx) => {
        const isLast = idx === displayMessages.length - 1;
        const isStreamingMsg = msg.streaming && isLast;

        return (
          <div key={msg.id} style={S.msgRow(msg.role)}>
            <div style={S.avatar(msg.role)}>
              {msg.role === "user" ? "U" : "J"}
            </div>
            <div style={S.bubble(msg.role)}>
              {/* Message content */}
              {msg.content && (
                <div style={S.content}>
                  {msg.content}
                  {isStreamingMsg && <span style={S.streamingCursor} />}
                </div>
              )}

              {/* Thinking indicator */}
              {isStreamingMsg && !msg.content && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={S.spinner} />
                  <span style={{ fontSize: 13, color: "var(--color-text-tertiary, #999)" }}>
                    Thinking...
                  </span>
                </div>
              )}

              {/* Tool calls */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div>
                  {msg.toolCalls.map((tc) => (
                    <div key={tc.id} style={S.toolCallCard}>
                      <div style={S.toolCallHeader}>
                        <span>🔧</span>
                        <span style={S.toolCallName}>{tc.name}</span>
                        <span style={S.toolCallStatus(tc.status)}>
                          {tc.status.toUpperCase()}
                        </span>
                        {tc.durationMs !== undefined && (
                          <span style={S.toolDuration}>
                            {tc.durationMs}ms
                          </span>
                        )}
                      </div>

                      {/* Arguments (collapsed if long) */}
                      {tc.arguments && Object.keys(tc.arguments).length > 0 && (
                        <div style={S.toolArgs}>
                          {JSON.stringify(tc.arguments, null, 2)}
                        </div>
                      )}

                      {/* Result */}
                      {tc.result !== undefined && (
                        <div style={S.toolResult}>
                          {typeof tc.result === "string"
                            ? tc.result
                            : JSON.stringify(tc.result, null, 2)}
                        </div>
                      )}

                      {/* Running indicator */}
                      {tc.status === "running" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <span style={{ ...S.spinner, width: 10, height: 10 }} />
                          <span style={{ fontSize: 11, color: "var(--color-text-tertiary, #999)" }}>
                            Executing...
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Global status bar */}
      {agentStatus && agentStatus !== "idle" && agentStatus !== "completed" && (
        <div style={S.statusBar}>
          <span style={S.statusBadge(agentStatus)}>
            {agentStatus === "thinking" && "🤔 Thinking..."}
            {agentStatus === "acting" && "⚡ Executing tools..."}
            {agentStatus === "streaming" && "📝 Streaming..."}
            {agentStatus === "error" && "❌ Error"}
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default JarvisChatView;
