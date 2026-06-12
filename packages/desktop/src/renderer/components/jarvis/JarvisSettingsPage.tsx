/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Jarvis Plugin & Mode Settings Page
 *
 * Combines the Plugin Manager, Mode Configuration, and Provider Center
 * into a single settings page with tabbed navigation.
 */

import React, { useState, useEffect, useCallback } from "react";
import JarvisPluginManager from "./JarvisPluginManager";
import type { PluginManagerAPI } from "./JarvisPluginManager";
import JarvisModeConfig from "./JarvisModeConfig";
import type { ModeInfo, AvailablePlugin } from "./JarvisModeConfig";
import ProviderCenterUI from "./ProviderCenterUI";
import type { ProviderInfo, ModelInfo } from "./ProviderCenterUI";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type JarvisSettingsPageProps = {
  /** PluginManager instance from the host app. */
  pluginManager: PluginManagerAPI;

  /** Mode data for configuration. */
  modes: ModeInfo[];

  /** Active mode id. */
  activeModeId: string | null;

  /** Called when mode plugin configuration is saved. */
  onSaveModeConfig: (modeId: string, plugins: string[]) => void;

  /** Called when user switches mode. */
  onSwitchMode?: (modeId: string) => void;

  /** Provider data for the Provider Center tab. */
  providers: ProviderInfo[];
  activeProviderId: string | null;

  /** Provider operations. */
  onActivateProvider: (providerId: string) => Promise<void>;
  onRefreshModels: (providerId: string) => Promise<ModelInfo[]>;
  onHealthCheck: (providerId: string) => Promise<void>;
  onAddProvider?: () => void;
  onEditProvider?: (providerId: string) => void;
  onRemoveProvider?: (providerId: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const JarvisSettingsPage: React.FC<JarvisSettingsPageProps> = ({
  pluginManager,
  modes,
  activeModeId,
  onSaveModeConfig,
  onSwitchMode,
  providers,
  activeProviderId,
  onActivateProvider,
  onRefreshModels,
  onHealthCheck,
  onAddProvider,
  onEditProvider,
  onRemoveProvider,
}) => {
  const [activeTab, setActiveTab] = useState<"plugins" | "modes" | "providers" | "diagnostics">("plugins");

  // Build availablePlugin list from PluginManager
  const [availablePlugins, setAvailablePlugins] = useState<AvailablePlugin[]>([]);

  const refreshAvailablePlugins = useCallback(() => {
    const all = pluginManager.list();
    setAvailablePlugins(
      all.map((p) => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        installed: true,
      }))
    );
  }, [pluginManager]);

  useEffect(() => {
    refreshAvailablePlugins();
  }, [refreshAvailablePlugins]);

  // -------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------
  const styles: Record<string, React.CSSProperties> = {
    container: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "var(--color-text-primary, #1a1a2e)",
      maxWidth: 1024,
      margin: "0 auto",
    },
    title: { fontSize: 24, fontWeight: 700, margin: "0 0 8px" },
    subtitle: { fontSize: 14, color: "var(--color-text-secondary, #666)", margin: "0 0 20px" },
    tabs: { display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid var(--color-border, #e0e0e0)", flexWrap: "wrap" as const },
    tab: (active: boolean) => ({
      padding: "10px 20px",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: active ? 600 : 400,
      borderBottom: active ? "2px solid var(--color-primary, #4f46e5)" : "2px solid transparent",
      marginBottom: -2,
      backgroundColor: "transparent",
      border: "none",
      color: active ? "var(--color-primary, #4f46e5)" : "var(--color-text-secondary, #666)",
    }),
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Jarvis Management</h1>
      <p style={styles.subtitle}>
        Manage installed plugins, configure mode plugin sets, providers, and view diagnostics.
      </p>

      <div style={styles.tabs}>
        <button style={styles.tab(activeTab === "plugins")} onClick={() => setActiveTab("plugins")}>
          Installed Plugins
        </button>
        <button style={styles.tab(activeTab === "modes")} onClick={() => setActiveTab("modes")}>
          Mode Configuration
        </button>
        <button style={styles.tab(activeTab === "providers")} onClick={() => setActiveTab("providers")}>
          Provider Center
        </button>
        <button style={styles.tab(activeTab === "diagnostics")} onClick={() => setActiveTab("diagnostics")}>
          Diagnostics
        </button>
      </div>

      {activeTab === "plugins" && (
        <JarvisPluginManager
          pluginManager={pluginManager}
          onPluginsChanged={refreshAvailablePlugins}
        />
      )}

      {activeTab === "providers" && (
        <ProviderCenterUI
          providers={providers}
          activeProviderId={activeProviderId}
          onActivate={onActivateProvider}
          onRefreshModels={onRefreshModels}
          onHealthCheck={onHealthCheck}
          onAddProvider={onAddProvider}
          onEditProvider={onEditProvider}
          onRemoveProvider={onRemoveProvider}
        />
      )}

      {activeTab === "modes" && (
        <JarvisModeConfig
          modes={modes}
          availablePlugins={availablePlugins}
          activeModeId={activeModeId}
          onModePluginsChange={onSaveModeConfig}
          onSwitchMode={onSwitchMode}
        />
      )}

      {activeTab === "diagnostics" && (
        <DiagnosticsPanel
          pluginManager={pluginManager}
          modes={modes}
          activeModeId={activeModeId}
          providers={providers}
          activeProviderId={activeProviderId}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Diagnostics Panel
// ---------------------------------------------------------------------------

const DiagnosticsPanel: React.FC<{
  pluginManager: PluginManagerAPI;
  modes: ModeInfo[];
  activeModeId: string | null;
  providers: ProviderInfo[];
  activeProviderId: string | null;
}> = ({ pluginManager, modes, activeModeId, providers, activeProviderId }) => {
  const styles: Record<string, React.CSSProperties> = {
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 15, fontWeight: 600, margin: "0 0 8px" },
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
    th: {
      textAlign: "left" as const, padding: "8px 12px",
      borderBottom: "2px solid var(--color-border, #e0e0e0)",
      fontWeight: 600, fontSize: 11,
      color: "var(--color-text-tertiary, #999)",
      textTransform: "uppercase" as const,
    },
    td: { padding: "8px 12px", borderBottom: "1px solid var(--color-border, #e0e0e0)" },
    badge: (ok: boolean) => ({
      display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
      backgroundColor: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
      color: ok ? "#16a34a" : "#ef4444",
    }),
  };

  const plugins = pluginManager.list();

  return (
    <div>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>System Overview</h3>
        <table style={styles.table}>
          <tbody>
            <tr><td style={styles.td}><strong>Active Mode</strong></td><td style={styles.td}>{activeModeId || "none"}</td></tr>
            <tr><td style={styles.td}><strong>Active Provider</strong></td><td style={styles.td}>{activeProviderId || "none"}</td></tr>
            <tr><td style={styles.td}><strong>Registered Modes</strong></td><td style={styles.td}>{modes.length}</td></tr>
            <tr><td style={styles.td}><strong>Configured Providers</strong></td><td style={styles.td}>{providers.length}</td></tr>
            <tr><td style={styles.td}><strong>Installed Plugins</strong></td><td style={styles.td}>{plugins.length}</td></tr>
            <tr><td style={styles.td}><strong>Enabled Plugins</strong></td><td style={styles.td}>{plugins.filter((p) => p.enabled).length}</td></tr>
          </tbody>
        </table>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Provider Health</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Provider</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Latency</th>
              <th style={styles.th}>Models</th>
              <th style={styles.th}>Requests</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.providerId}>
                <td style={styles.td}>
                  <strong>{p.name}</strong>
                  {p.active && " (active)"}
                </td>
                <td style={styles.td}>{p.type}</td>
                <td style={styles.td}>
                  <span style={styles.badge(p.health.connected)}>
                    {p.health.connected ? "ONLINE" : "OFFLINE"}
                  </span>
                </td>
                <td style={styles.td}>{p.health.latencyMs}ms</td>
                <td style={styles.td}>{p.health.modelCount}</td>
                <td style={styles.td}>{p.requestCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Plugin Health</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Plugin</th>
              <th style={styles.th}>Version</th>
              <th style={styles.th}>State</th>
              <th style={styles.th}>Health</th>
              <th style={styles.th}>Load Time</th>
            </tr>
          </thead>
          <tbody>
            {plugins.map((p) => (
              <tr key={p.id}>
                <td style={styles.td}>{p.name}</td>
                <td style={styles.td}>{p.version}</td>
                <td style={styles.td}><span style={styles.badge(p.enabled)}>{p.enabled ? "ENABLED" : p.state.toUpperCase()}</span></td>
                <td style={styles.td}><span style={styles.badge(!p.lastError)}>{p.lastError ? "ERROR" : "HEALTHY"}</span></td>
                <td style={styles.td}>{p.loadTimeMs}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JarvisSettingsPage;
export type { ModeInfo, AvailablePlugin };
