/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Jarvis Plugin Manager UI
 *
 * Displays installed plugins with capabilities, permissions, health,
 * and provides enable/disable/reload/uninstall operations.
 *
 * All operations go through PluginManager — never direct runtime manipulation.
 */

import React, { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PluginInfo = {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  state: string;
  capabilities: string[];
  permissions: string[];
  dependencies: string[];
  loadTimeMs: number;
  lastError: string | null;
};

type JarvisPluginManagerProps = {
  /** PluginManager instance injected from the host app. */
  pluginManager: PluginManagerAPI | null;

  /** Called when the plugin list changes. */
  onPluginsChanged?: () => void;
};

/** Minimal API surface that PluginManager exposes to the UI. */
type PluginManagerAPI = {
  list(): PluginInfo[];
  enable(pluginId: string): Promise<boolean>;
  disable(pluginId: string): Promise<boolean>;
  reload(pluginId: string): Promise<boolean>;
  uninstall(pluginId: string): Promise<{ ok: boolean }>;
  getStatus(pluginId: string): PluginInfo | null;
  getDiagnostics(): Promise<{
    installedCount: number;
    enabledCount: number;
    disabledCount: number;
    errorCount: number;
  }>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const JarvisPluginManager: React.FC<JarvisPluginManagerProps> = ({
  pluginManager,
  onPluginsChanged,
}) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled" | "error">("all");
  const [diag, setDiag] = useState<{
    installedCount: number;
    enabledCount: number;
    disabledCount: number;
    errorCount: number;
  } | null>(null);

  const refreshPlugins = useCallback(() => {
    if (!pluginManager) return;
    const list = pluginManager.list();
    setPlugins(list);
    pluginManager.getDiagnostics().then(setDiag).catch(() => {});
  }, [pluginManager]);

  useEffect(() => {
    refreshPlugins();
  }, [refreshPlugins]);

  const handleEnable = async (pluginId: string) => {
    if (!pluginManager) return;
    setLoading((prev) => ({ ...prev, [pluginId]: true }));
    setError(null);
    try {
      await pluginManager.enable(pluginId);
      refreshPlugins();
      onPluginsChanged?.();
    } catch (err) {
      setError(`Failed to enable ${pluginId}: ${err}`);
    } finally {
      setLoading((prev) => ({ ...prev, [pluginId]: false }));
    }
  };

  const handleDisable = async (pluginId: string) => {
    if (!pluginManager) return;
    setLoading((prev) => ({ ...prev, [pluginId]: true }));
    setError(null);
    try {
      await pluginManager.disable(pluginId);
      refreshPlugins();
      onPluginsChanged?.();
    } catch (err) {
      setError(`Failed to disable ${pluginId}: ${err}`);
    } finally {
      setLoading((prev) => ({ ...prev, [pluginId]: false }));
    }
  };

  const handleReload = async (pluginId: string) => {
    if (!pluginManager) return;
    setLoading((prev) => ({ ...prev, [pluginId]: true }));
    setError(null);
    try {
      await pluginManager.reload(pluginId);
      refreshPlugins();
      onPluginsChanged?.();
    } catch (err) {
      setError(`Failed to reload ${pluginId}: ${err}`);
    } finally {
      setLoading((prev) => ({ ...prev, [pluginId]: false }));
    }
  };

  const filteredPlugins = plugins.filter((p) => {
    if (filter === "enabled") return p.enabled;
    if (filter === "disabled") return !p.enabled && p.state !== "error";
    if (filter === "error") return p.state === "error";
    return true;
  });

  const selected = selectedPlugin ? plugins.find((p) => p.id === selectedPlugin) : null;

  // -------------------------------------------------------------------
  // Styles (inline to avoid CSS bundling complexity)
  // -------------------------------------------------------------------
  const styles: Record<string, React.CSSProperties> = {
    container: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "var(--color-text-primary, #1a1a2e)",
      maxWidth: 1024,
      margin: "0 auto",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    title: { fontSize: 20, fontWeight: 600, margin: 0 },
    tabs: { display: "flex", gap: 8, marginBottom: 16 },
    tab: (active: boolean) => ({
      padding: "6px 14px",
      borderRadius: 6,
      border: "none",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      backgroundColor: active ? "var(--color-primary, #4f46e5)" : "var(--color-bg-secondary, #f0f0f5)",
      color: active ? "#fff" : "var(--color-text-secondary, #666)",
    }),
    panel: { display: "flex", gap: 16, minHeight: 400 },
    list: {
      flex: "0 0 280px",
      borderRight: "1px solid var(--color-border, #e0e0e0)",
      overflowY: "auto" as const,
      maxHeight: 500,
    },
    listItem: (active: boolean, enabled: boolean) => ({
      padding: "10px 12px",
      cursor: "pointer",
      backgroundColor: active
        ? "var(--color-primary-light, rgba(79,70,229,0.1))"
        : "transparent",
      borderLeft: active ? "3px solid var(--color-primary, #4f46e5)" : "3px solid transparent",
      opacity: enabled ? 1 : 0.6,
      fontSize: 13,
    }),
    pluginName: { fontWeight: 600, margin: 0, fontSize: 14 },
    pluginVersion: { fontSize: 11, color: "var(--color-text-tertiary, #999)", margin: "2px 0 0" },
    detail: { flex: 1, padding: "0 16px" },
    detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    detailName: { fontSize: 18, fontWeight: 600, margin: 0 },
    badge: (enabled: boolean) => ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 600,
      backgroundColor: enabled ? "rgba(34,197,94,0.15)" : "rgba(156,163,175,0.15)",
      color: enabled ? "#16a34a" : "#6b7280",
    }),
    field: { marginBottom: 12 },
    fieldLabel: { fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary, #999)", textTransform: "uppercase" as const, marginBottom: 2 },
    fieldValue: { fontSize: 13, margin: 0 },
    tagList: { display: "flex", flexWrap: "wrap" as const, gap: 4, marginTop: 2 },
    tag: (color: string) => ({
      display: "inline-block",
      padding: "2px 6px",
      borderRadius: 4,
      fontSize: 11,
      backgroundColor: color + "15",
      color: color,
      fontWeight: 500,
    }),
    actions: { display: "flex", gap: 8, marginTop: 20 },
    btn: (variant: "primary" | "danger" | "default") => ({
      padding: "8px 16px",
      borderRadius: 6,
      border: "none",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 600,
      backgroundColor:
        variant === "primary" ? "var(--color-primary, #4f46e5)" :
        variant === "danger" ? "#ef4444" : "var(--color-bg-secondary, #e5e7eb)",
      color: variant === "default" ? "var(--color-text-primary, #1a1a2e)" : "#fff",
    }),
    stats: {
      display: "flex",
      gap: 16,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      padding: "12px 16px",
      borderRadius: 8,
      backgroundColor: "var(--color-bg-secondary, #f8f8fc)",
      textAlign: "center" as const,
    },
    statNumber: { fontSize: 24, fontWeight: 700, margin: 0 },
    statLabel: { fontSize: 11, color: "var(--color-text-tertiary, #999)", margin: "2px 0 0" },
    errorBanner: {
      padding: "8px 12px",
      borderRadius: 6,
      backgroundColor: "rgba(239,68,68,0.1)",
      color: "#ef4444",
      fontSize: 13,
      marginBottom: 12,
    },
    emptyState: {
      textAlign: "center" as const,
      padding: 40,
      color: "var(--color-text-tertiary, #999)",
      fontSize: 14,
    },
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Plugin Marketplace & Management</h2>
      </div>

      {diag && (
        <div style={styles.stats}>
          <div style={styles.statCard}>
            <p style={styles.statNumber}>{diag.installedCount}</p>
            <p style={styles.statLabel}>Installed</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statNumber}>{diag.enabledCount}</p>
            <p style={styles.statLabel}>Enabled</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statNumber}>{diag.disabledCount}</p>
            <p style={styles.statLabel}>Disabled</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statNumber}>{diag.errorCount}</p>
            <p style={styles.statLabel}>Errors</p>
          </div>
        </div>
      )}

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.tabs}>
        {(["all", "enabled", "disabled", "error"] as const).map((f) => (
          <button
            key={f}
            style={styles.tab(filter === f)}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button style={{ ...styles.btn("default"), marginLeft: "auto" }} onClick={refreshPlugins}>
          ↻ Refresh
        </button>
      </div>

      <div style={styles.panel}>
        {/* Plugin List */}
        <div style={styles.list}>
          {filteredPlugins.length === 0 ? (
            <div style={styles.emptyState}>
              {filter === "all" ? "No plugins discovered." : `No ${filter} plugins.`}
            </div>
          ) : (
            filteredPlugins.map((p) => (
              <div
                key={p.id}
                style={styles.listItem(selectedPlugin === p.id, p.enabled)}
                onClick={() => setSelectedPlugin(p.id)}
              >
                <p style={styles.pluginName}>{p.name}</p>
                <p style={styles.pluginVersion}>v{p.version} — {p.state}</p>
              </div>
            ))
          )}
        </div>

        {/* Plugin Detail */}
        <div style={styles.detail}>
          {selected ? (
            <>
              <div style={styles.detailHeader}>
                <h3 style={styles.detailName}>{selected.name}</h3>
                <span style={styles.badge(selected.enabled)}>
                  {selected.enabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>

              <div style={styles.field}>
                <p style={styles.fieldLabel}>ID</p>
                <p style={styles.fieldValue}>{selected.id}</p>
              </div>
              <div style={styles.field}>
                <p style={styles.fieldLabel}>Version</p>
                <p style={styles.fieldValue}>{selected.version}</p>
              </div>
              <div style={styles.field}>
                <p style={styles.fieldLabel}>Author</p>
                <p style={styles.fieldValue}>{selected.author || "—"}</p>
              </div>
              <div style={styles.field}>
                <p style={styles.fieldLabel}>Description</p>
                <p style={styles.fieldValue}>{selected.description || "—"}</p>
              </div>

              <div style={styles.field}>
                <p style={styles.fieldLabel}>Capabilities</p>
                <div style={styles.tagList}>
                  {selected.capabilities.length > 0
                    ? selected.capabilities.map((c) => (
                        <span key={c} style={styles.tag("#6366f1")}>{c}</span>
                      ))
                    : <span style={{ fontSize: 13, color: "#999" }}>None</span>
                  }
                </div>
              </div>

              <div style={styles.field}>
                <p style={styles.fieldLabel}>Permissions</p>
                <div style={styles.tagList}>
                  {selected.permissions.length > 0
                    ? selected.permissions.map((p) => (
                        <span key={p} style={styles.tag("#f59e0b")}>{p}</span>
                      ))
                    : <span style={{ fontSize: 13, color: "#999" }}>None</span>
                  }
                </div>
              </div>

              <div style={styles.field}>
                <p style={styles.fieldLabel}>Dependencies</p>
                <p style={styles.fieldValue}>
                  {selected.dependencies.length > 0
                    ? selected.dependencies.join(", ")
                    : "None"}
                </p>
              </div>

              <div style={styles.field}>
                <p style={styles.fieldLabel}>Health</p>
                <p style={styles.fieldValue}>
                  Load time: {selected.loadTimeMs}ms
                  {selected.lastError && (
                    <span style={{ color: "#ef4444", marginLeft: 12 }}>
                      Error: {selected.lastError}
                    </span>
                  )}
                  {!selected.lastError && (
                    <span style={{ color: "#16a34a", marginLeft: 12 }}>✓ Healthy</span>
                  )}
                </p>
              </div>

              <div style={styles.actions}>
                {selected.enabled ? (
                  <button
                    style={styles.btn("danger")}
                    onClick={() => handleDisable(selected.id)}
                    disabled={loading[selected.id]}
                  >
                    {loading[selected.id] ? "..." : "Disable"}
                  </button>
                ) : (
                  <button
                    style={styles.btn("primary")}
                    onClick={() => handleEnable(selected.id)}
                    disabled={loading[selected.id]}
                  >
                    {loading[selected.id] ? "..." : "Enable"}
                  </button>
                )}
                <button
                  style={styles.btn("default")}
                  onClick={() => handleReload(selected.id)}
                  disabled={loading[selected.id]}
                >
                  {loading[selected.id] ? "..." : "Reload"}
                </button>
              </div>
            </>
          ) : (
            <div style={styles.emptyState}>
              Select a plugin to view details and manage it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JarvisPluginManager;
export type { PluginManagerAPI, PluginInfo };
