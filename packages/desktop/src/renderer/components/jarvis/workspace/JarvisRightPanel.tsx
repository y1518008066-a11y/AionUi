/**
 * Jarvis Right Panel — Agent Status, Diagnostics, Session Info
 *
 * Displays real-time diagnostics from the Jarvis runtime:
 * current mode, active provider, agent status, session stats,
 * plugin health, and system diagnostics.
 */

import React from "react";
import type { ModeInfo } from "../JarvisModeConfig";
import type { ProviderInfo } from "../ProviderCenterUI";
import type { PluginInfo } from "../JarvisPluginManager";
import type { ChatMessage } from "../../../pages/jarvis";

type Props = {
  modes: ModeInfo[];
  activeModeId: string | null;
  providers: ProviderInfo[];
  activeProviderId: string | null;
  plugins: PluginInfo[];
  agentStatus: ChatMessage["agentStatus"];
  messageCount: number;
};

const S = {
  container: {
    padding: "12px 12px",
    overflowY: "auto" as const,
    flex: 1,
    fontSize: 12,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "var(--color-text-primary, #333)",
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    color: "#999",
    padding: "4px 0",
    margin: "4px 0 6px",
    borderBottom: "1px solid var(--color-border, #e0e0e0)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "3px 0",
  },
  label: { color: "var(--color-text-secondary, #666)", fontSize: 11 },
  value: { fontWeight: 600, fontSize: 11 },
  badge: (color: string) => ({
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color,
    marginRight: 6,
    flexShrink: 0,
  }),
  statusBadge: (status: string | undefined) => {
    const colors: Record<string, string> = {
      idle: "#d1d5db",
      thinking: "#f59e0b",
      acting: "#3b82f6",
      streaming: "#8b5cf6",
      completed: "#16a34a",
      error: "#ef4444",
    };
    return {
      padding: "4px 10px",
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 600,
      backgroundColor: (colors[status || ""] || "#d1d5db") + "20",
      color: colors[status || ""] || "#999",
      textAlign: "center" as const,
    };
  },
  pluginItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 0",
    fontSize: 11,
  },
  codeBlock: {
    backgroundColor: "var(--color-bg-secondary, #f3f4f6)",
    padding: "8px 10px",
    borderRadius: 6,
    fontSize: 10,
    fontFamily: "monospace",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    maxHeight: 160,
    overflowY: "auto" as const,
  },
};

const JarvisRightPanel: React.FC<Props> = ({
  modes,
  activeModeId,
  providers,
  activeProviderId,
  plugins,
  agentStatus,
  messageCount,
}) => {
  const activeMode = modes.find((m) => m.id === activeModeId);
  const activeProvider = providers.find((p) => p.providerId === activeProviderId);
  const enabledPlugins = plugins.filter((p) => p.enabled);
  const errorPlugins = plugins.filter((p) => p.lastError);

  const statusLabel: Record<string, string> = {
    idle: "Idle",
    thinking: "Thinking",
    acting: "Acting",
    streaming: "Streaming",
    completed: "Completed",
    error: "Error",
  };

  return (
    <div style={S.container}>
      {/* Agent Status */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Agent Status</div>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <span style={S.statusBadge(agentStatus)}>
            {statusLabel[agentStatus || "idle"] || "Idle"}
          </span>
        </div>
        <div style={S.row}>
          <span style={S.label}>Messages</span>
          <span style={S.value}>{messageCount}</span>
        </div>
      </div>

      {/* Active Mode */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Active Mode</div>
        <div style={S.row}>
          <span style={S.label}>Mode</span>
          <span style={S.value}>{activeMode?.label || (activeModeId || "None")}</span>
        </div>
        <div style={S.row}>
          <span style={S.label}>Permission</span>
          <span style={S.value}>{activeMode?.permissionLevel || "—"}</span>
        </div>
        <div style={S.row}>
          <span style={S.label}>Plugins</span>
          <span style={S.value}>{activeMode?.activePlugins.length || 0}</span>
        </div>
        {activeMode?.description && (
          <div style={{ fontSize: 10, color: "#999", marginTop: 4, fontStyle: "italic" }}>
            {activeMode.description}
          </div>
        )}
      </div>

      {/* Active Provider */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Active Provider</div>
        {activeProvider ? (
          <>
            <div style={S.row}>
              <span style={S.label}>Name</span>
              <span style={S.value}>{activeProvider.name}</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Type</span>
              <span style={S.value}>{activeProvider.type}</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Status</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={S.badge(activeProvider.health.connected ? "#16a34a" : "#ef4444")} />
                <span style={S.value}>
                  {activeProvider.health.connected ? "Connected" : "Offline"}
                </span>
              </span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Latency</span>
              <span style={S.value}>{activeProvider.health.latencyMs.toFixed(0)} ms</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Models</span>
              <span style={S.value}>{activeProvider.modelCount}</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Endpoint</span>
            </div>
            <div style={S.codeBlock}>{activeProvider.health.endpoint}</div>
            {activeProvider.health.lastError && (
              <div style={{ marginTop: 4 }}>
                <span style={{ ...S.label, color: "#ef4444" }}>Last Error</span>
                <div style={{ ...S.codeBlock, color: "#ef4444", maxHeight: 80 }}>
                  {activeProvider.health.lastError}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ ...S.value, color: "#999", textAlign: "center", padding: "8px 0" }}>
            No provider selected
          </div>
        )}
      </div>

      {/* Plugins */}
      <div style={S.section}>
        <div style={S.sectionTitle}>
          Plugins ({enabledPlugins.length}/{plugins.length} enabled)
        </div>
        {plugins.length === 0 ? (
          <div style={{ color: "#999", fontSize: 11, textAlign: "center", padding: "4px 0" }}>
            No plugins loaded
          </div>
        ) : (
          <>
            {plugins.map((p) => (
              <div key={p.id} style={S.pluginItem}>
                <span style={S.badge(p.enabled && p.state !== "error" ? "#16a34a" : "#d1d5db")} />
                <span style={{ flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: "#999" }}>
                  {p.state === "error" ? "❌" : p.enabled ? "on" : "off"}
                </span>
              </div>
            ))}
            {errorPlugins.length > 0 && (
              <div style={{ marginTop: 6, color: "#ef4444", fontSize: 10 }}>
                {errorPlugins.length} plugin(s) with errors
              </div>
            )}
          </>
        )}
      </div>

      {/* Mode List Summary */}
      <div style={S.section}>
        <div style={S.sectionTitle}>All Modes ({modes.length})</div>
        {modes.map((m) => (
          <div key={m.id} style={S.row}>
            <span style={{ ...S.label, fontWeight: activeModeId === m.id ? 600 : 400 }}>
              {m.label}
              {activeModeId === m.id ? " ●" : ""}
            </span>
            <span style={{ ...S.value, fontSize: 10, color: "#999" }}>
              {m.activePlugins.length} plugins
            </span>
          </div>
        ))}
      </div>

      {/* Provider Summary */}
      <div style={S.section}>
        <div style={S.sectionTitle}>All Providers ({providers.length})</div>
        {providers.map((p) => (
          <div key={p.providerId} style={S.row}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={S.badge(p.health.connected ? "#16a34a" : "#d1d5db")} />
              <span style={{ ...S.label, fontWeight: activeProviderId === p.providerId ? 600 : 400 }}>
                {p.name}
              </span>
            </span>
            <span style={{ ...S.value, fontSize: 10, color: "#999" }}>
              {p.modelCount} models
            </span>
          </div>
        ))}
      </div>

      {/* Diagnostics Footer */}
      <div style={{ ...S.section, borderTop: "1px solid var(--color-border, #e0e0e0)", paddingTop: 12 }}>
        <div style={S.sectionTitle}>Quick Diagnostics</div>
        <div style={S.row}>
          <span style={S.label}>Modes</span>
          <span style={S.value}>{modes.length}</span>
        </div>
        <div style={S.row}>
          <span style={S.label}>Providers</span>
          <span style={S.value}>
            {providers.length} ({providers.filter((p) => p.health.connected).length} online)
          </span>
        </div>
        <div style={S.row}>
          <span style={S.label}>Plugins</span>
          <span style={S.value}>
            {enabledPlugins.length} active / {plugins.length} total
          </span>
        </div>
        <div style={S.row}>
          <span style={S.label}>Messages</span>
          <span style={S.value}>{messageCount}</span>
        </div>
      </div>
    </div>
  );
};

export default JarvisRightPanel;
