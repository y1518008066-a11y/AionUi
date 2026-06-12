/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Jarvis Mode Plugin Configuration UI
 *
 * Allows users to configure which plugins are active for each mode.
 * Changes persist through JarvisConfigService and take effect on
 * the next mode switch.
 */

import React, { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModeInfo = {
  id: string;
  label: string;
  description: string;
  icon: string;
  activePlugins: string[];
  permissionLevel: string;
  builtin: boolean;
};

type AvailablePlugin = {
  id: string;
  name: string;
  enabled: boolean;
  installed: boolean;
};

type JarvisModeConfigProps = {
  /** All registered modes. */
  modes: ModeInfo[];

  /** All available plugins (installed + discovered). */
  availablePlugins: AvailablePlugin[];

  /** Active mode id. */
  activeModeId: string | null;

  /** Called when mode plugin list changes. */
  onModePluginsChange: (modeId: string, plugins: string[]) => void;

  /** Called when mode is switched. */
  onSwitchMode?: (modeId: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const JarvisModeConfig: React.FC<JarvisModeConfigProps> = ({
  modes,
  availablePlugins,
  activeModeId,
  onModePluginsChange,
  onSwitchMode,
}) => {
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [editingPlugins, setEditingPlugins] = useState<string[]>([]);

  const selectedMode = modes.find((m) => m.id === selectedModeId);

  useEffect(() => {
    if (selectedMode) {
      setEditingPlugins([...selectedMode.activePlugins]);
    }
  }, [selectedMode]);

  const handleTogglePlugin = (pluginId: string) => {
    setEditingPlugins((prev) =>
      prev.includes(pluginId)
        ? prev.filter((id) => id !== pluginId)
        : [...prev, pluginId]
    );
  };

  const handleSave = () => {
    if (selectedModeId) {
      onModePluginsChange(selectedModeId, editingPlugins);
    }
  };

  const handleReset = () => {
    if (selectedMode) {
      setEditingPlugins([...selectedMode.activePlugins]);
    }
  };

  // -------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------
  const styles: Record<string, React.CSSProperties> = {
    container: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "var(--color-text-primary, #1a2a1e)",
      maxWidth: 1024,
      margin: "0 auto",
    },
    title: { fontSize: 20, fontWeight: 600, margin: "0 0 16px" },
    layout: { display: "flex", gap: 16, minHeight: 400 },
    modeList: {
      flex: "0 0 220px",
      borderRight: "1px solid var(--color-border, #e0e0e0)",
      overflowY: "auto" as const,
    },
    modeItem: (active: boolean, isActiveMode: boolean) => ({
      padding: "10px 12px",
      cursor: "pointer",
      backgroundColor: active
        ? "var(--color-primary-light, rgba(79,70,229,0.1))"
        : "transparent",
      borderLeft: active ? "3px solid var(--color-primary, #4f46e5)" : "3px solid transparent",
      fontWeight: isActiveMode ? 600 : 400,
    }),
    modeName: { margin: 0, fontSize: 14, fontWeight: "inherit" as const },
    modeDesc: { margin: "2px 0 0", fontSize: 11, color: "var(--color-text-tertiary, #999)" },
    activeBadge: {
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 8,
      fontSize: 10,
      fontWeight: 600,
      backgroundColor: "rgba(34,197,94,0.15)",
      color: "#16a34a",
      marginLeft: 8,
    },
    configPanel: { flex: 1, padding: "0 16px" },
    configHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    configTitle: { fontSize: 18, fontWeight: 600, margin: 0 },
    permissionBadge: (level: string) => {
      const colors: Record<string, string> = {
        full: "#16a34a",
        elevated: "#f59e0b",
        standard: "#6b7280",
      };
      return {
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: (colors[level] || "#6b7280") + "15",
        color: colors[level] || "#6b7280",
      };
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--color-text-secondary, #666)",
      margin: "20px 0 8px",
      textTransform: "uppercase" as const,
    },
    pluginGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
      gap: 8,
      marginBottom: 16,
    },
    pluginCard: (selected: boolean, installed: boolean) => ({
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 10px",
      borderRadius: 6,
      border: selected
        ? "2px solid var(--color-primary, #4f46e5)"
        : "1px solid var(--color-border, #e0e0e0)",
      backgroundColor: selected
        ? "var(--color-primary-light, rgba(79,70,229,0.05))"
        : "var(--color-bg-primary, #fff)",
      cursor: "pointer",
      opacity: installed ? 1 : 0.5,
      transition: "all 0.15s",
    }),
    pluginCheckbox: (selected: boolean) => ({
      width: 18,
      height: 18,
      borderRadius: 4,
      border: selected ? "none" : "2px solid var(--color-border, #ccc)",
      backgroundColor: selected ? "var(--color-primary, #4f46e5)" : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      color: "#fff",
      fontSize: 12,
      fontWeight: 700,
    }),
    pluginCardName: { fontSize: 13, fontWeight: 500, margin: 0, flex: 1 },
    pluginCardId: { fontSize: 10, color: "var(--color-text-tertiary, #999)" },
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
    emptyState: {
      textAlign: "center" as const,
      padding: 40,
      color: "var(--color-text-tertiary, #999)",
      fontSize: 14,
    },
    infoText: {
      fontSize: 12,
      color: "var(--color-text-tertiary, #999)",
      marginTop: 8,
    },
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Mode Plugin Configuration</h2>

      <div style={styles.layout}>
        {/* Mode List */}
        <div style={styles.modeList}>
          {modes.length === 0 ? (
            <div style={styles.emptyState}>No modes registered.</div>
          ) : (
            modes.map((mode) => (
              <div
                key={mode.id}
                style={styles.modeItem(selectedModeId === mode.id, activeModeId === mode.id)}
                onClick={() => setSelectedModeId(mode.id)}
              >
                <p style={styles.modeName}>
                  {mode.label}
                  {activeModeId === mode.id && (
                    <span style={styles.activeBadge}>ACTIVE</span>
                  )}
                </p>
                <p style={styles.modeDesc}>
                  {mode.permissionLevel} · {mode.activePlugins.length} plugins
                </p>
              </div>
            ))
          )}
        </div>

        {/* Configuration Panel */}
        <div style={styles.configPanel}>
          {selectedMode ? (
            <>
              <div style={styles.configHeader}>
                <h3 style={styles.configTitle}>
                  {selectedMode.label}
                  <span style={{ ...styles.permissionBadge(selectedMode.permissionLevel), marginLeft: 12 }}>
                    {selectedMode.permissionLevel.toUpperCase()}
                  </span>
                </h3>
                {onSwitchMode && activeModeId !== selectedMode.id && (
                  <button
                    style={styles.btn("primary")}
                    onClick={() => onSwitchMode(selectedMode.id)}
                  >
                    Switch to {selectedMode.label}
                  </button>
                )}
              </div>

              <p style={{ fontSize: 13, color: "var(--color-text-secondary, #666)", margin: "0 0 16px" }}>
                {selectedMode.description}
              </p>

              <p style={styles.sectionTitle}>
                Active Plugins ({editingPlugins.length})
              </p>

              <div style={styles.pluginGrid}>
                {availablePlugins.map((plugin) => {
                  const isSelected = editingPlugins.includes(plugin.id);
                  return (
                    <div
                      key={plugin.id}
                      style={styles.pluginCard(isSelected, plugin.installed)}
                      onClick={() => plugin.installed && handleTogglePlugin(plugin.id)}
                      title={plugin.installed ? "Click to toggle" : "Not installed"}
                    >
                      <div style={styles.pluginCheckbox(isSelected)}>
                        {isSelected ? "✓" : ""}
                      </div>
                      <div>
                        <p style={styles.pluginCardName}>{plugin.name}</p>
                        <p style={styles.pluginCardId}>{plugin.id}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!selectedMode.builtin && (
                <p style={styles.infoText}>
                  ⚠ This is a custom mode. Built-in modes cannot be deleted.
                </p>
              )}

              <div style={styles.actions}>
                <button style={styles.btn("primary")} onClick={handleSave}>
                  Save Configuration
                </button>
                <button style={styles.btn("default")} onClick={handleReset}>
                  Reset Changes
                </button>
              </div>
            </>
          ) : (
            <div style={styles.emptyState}>
              Select a mode to configure its active plugins.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JarvisModeConfig;
export type { ModeInfo, AvailablePlugin };
