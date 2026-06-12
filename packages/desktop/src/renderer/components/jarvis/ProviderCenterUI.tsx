/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Jarvis Provider Center UI
 *
 * Displays all configured/registered providers with health status,
 * model lists, and allows activation, health checks, and configuration.
 */

import React, { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProviderInfo = {
  providerId: string;
  name: string;
  type: string;
  enabled: boolean;
  active: boolean;
  health: {
    reachable: boolean;
    connected: boolean;
    latencyMs: number;
    endpoint: string;
    protocol: string | null;
    providerType: string;
    modelCount: number;
    lastChecked: number | null;
    lastError: string | null;
    consecutiveFailures: number;
  };
  modelCount: number;
  requestCount: number;
};

type ModelInfo = {
  id: string;
  displayName: string;
  providerId: string;
  supportsStreaming: boolean;
  contextLength: number;
};

type ProviderCenterProps = {
  /** Provider list from the backend. */
  providers: ProviderInfo[];

  /** Active provider id. */
  activeProviderId: string | null;

  /** Called when user wants to activate a provider. */
  onActivate: (providerId: string) => Promise<void>;

  /** Called when user wants to refresh models for a provider. */
  onRefreshModels: (providerId: string) => Promise<ModelInfo[]>;

  /** Called when user wants to run health check. */
  onHealthCheck: (providerId: string) => Promise<void>;

  /** Called when user wants to add a provider. */
  onAddProvider?: () => void;

  /** Called when user wants to edit a provider. */
  onEditProvider?: (providerId: string) => void;

  /** Called when user wants to remove a provider. */
  onRemoveProvider?: (providerId: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProviderCenterUI: React.FC<ProviderCenterProps> = ({
  providers,
  activeProviderId,
  onActivate,
  onRefreshModels,
  onHealthCheck,
  onAddProvider,
  onEditProvider,
  onRemoveProvider,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const selected = providers.find((p) => p.providerId === selectedProvider);

  const handleActivate = async (providerId: string) => {
    setLoading((prev) => ({ ...prev, [providerId]: true }));
    setError(null);
    try {
      await onActivate(providerId);
    } catch (err) {
      setError(`Failed to activate: ${err}`);
    } finally {
      setLoading((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const handleRefreshModels = async (providerId: string) => {
    setLoading((prev) => ({ ...prev, [`models-${providerId}`]: true }));
    try {
      const result = await onRefreshModels(providerId);
      setModels(result);
    } catch (err) {
      setError(`Failed to refresh models: ${err}`);
    } finally {
      setLoading((prev) => ({ ...prev, [`models-${providerId}`]: false }));
    }
  };

  const handleHealthCheck = async (providerId: string) => {
    setLoading((prev) => ({ ...prev, [`health-${providerId}`]: true }));
    try {
      await onHealthCheck(providerId);
    } catch (err) {
      setError(`Health check failed: ${err}`);
    } finally {
      setLoading((prev) => ({ ...prev, [`health-${providerId}`]: false }));
    }
  };

  // -------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------
  const S: Record<string, React.CSSProperties> = {
    container: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "var(--color-text-primary, #1a2a1e)",
      maxWidth: 1024,
      margin: "0 auto",
    },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    title: { fontSize: 20, fontWeight: 600, margin: 0 },
    btn: (variant: "primary" | "danger" | "default") => ({
      padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer",
      fontSize: 13, fontWeight: 600,
      backgroundColor:
        variant === "primary" ? "var(--color-primary, #4f46e5)" :
        variant === "danger" ? "#ef4444" : "var(--color-bg-secondary, #e5e7eb)",
      color: variant === "default" ? "var(--color-text-primary, #1a1a2e)" : "#fff",
    }),
    layout: { display: "flex", gap: 16, minHeight: 400 },
    list: { flex: "0 0 280px", borderRight: "1px solid var(--color-border, #e0e0e0)", overflowY: "auto" as const, maxHeight: 500 },
    listItem: (active: boolean, enabled: boolean) => ({
      padding: "10px 12px", cursor: "pointer",
      backgroundColor: active ? "var(--color-primary-light, rgba(79,70,229,0.1))" : "transparent",
      borderLeft: active ? "3px solid var(--color-primary, #4f46e5)" : "3px solid transparent",
      opacity: enabled ? 1 : 0.6,
    }),
    itemName: { fontWeight: 600, margin: 0, fontSize: 14 },
    itemMeta: { fontSize: 11, color: "var(--color-text-tertiary, #999)", margin: "2px 0 0" },
    detail: { flex: 1, padding: "0 16px" },
    detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    detailName: { fontSize: 18, fontWeight: 600, margin: 0 },
    badge: (positive: boolean) => ({
      display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
      backgroundColor: positive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
      color: positive ? "#16a34a" : "#ef4444",
    }),
    field: { marginBottom: 10 },
    fieldLabel: { fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary, #999)", textTransform: "uppercase" as const, marginBottom: 2 },
    fieldValue: { fontSize: 13, margin: 0 },
    modelList: { maxHeight: 200, overflowY: "auto" as const, border: "1px solid var(--color-border, #e0e0e0)", borderRadius: 6, marginTop: 4 },
    modelItem: { padding: "4px 8px", fontSize: 12, borderBottom: "1px solid var(--color-border, #e0e0e0)" },
    modelName: { fontWeight: 500 },
    modelMeta: { fontSize: 10, color: "var(--color-text-tertiary, #999)" },
    actions: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" as const },
    errorBanner: {
      padding: "8px 12px", borderRadius: 6, backgroundColor: "rgba(239,68,68,0.1)",
      color: "#ef4444", fontSize: 13, marginBottom: 12,
    },
    emptyState: { textAlign: "center" as const, padding: 40, color: "var(--color-text-tertiary, #999)", fontSize: 14 },
    statRow: { display: "flex", gap: 8, marginBottom: 12 },
    statCard: {
      flex: 1, padding: "8px 12px", borderRadius: 6,
      backgroundColor: "var(--color-bg-secondary, #f8f8fc)", textAlign: "center" as const,
    },
    statValue: { fontSize: 18, fontWeight: 700, margin: 0 },
    statLabel: { fontSize: 10, color: "var(--color-text-tertiary, #999)" },
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div style={S.container}>
      <div style={S.header}>
        <h2 style={S.title}>Provider Center</h2>
        {onAddProvider && (
          <button style={S.btn("primary")} onClick={onAddProvider}>
            + Add Provider
          </button>
        )}
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      <div style={S.layout}>
        {/* Provider List */}
        <div style={S.list}>
          {providers.length === 0 ? (
            <div style={S.emptyState}>No providers configured.</div>
          ) : (
            providers.map((p) => (
              <div
                key={p.providerId}
                style={S.listItem(selectedProvider === p.providerId, p.enabled)}
                onClick={() => setSelectedProvider(p.providerId)}
              >
                <p style={S.itemName}>
                  {p.name}
                  {p.active && <span style={{ ...S.badge(true), marginLeft: 6, fontSize: 9 }}>ACTIVE</span>}
                </p>
                <p style={S.itemMeta}>
                  {p.type} · {p.health.connected ? "🟢 Online" : "🔴 Offline"} · {p.health.latencyMs}ms
                </p>
              </div>
            ))
          )}
        </div>

        {/* Provider Detail */}
        <div style={S.detail}>
          {selected ? (
            <>
              <div style={S.detailHeader}>
                <h3 style={S.detailName}>{selected.name}</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={S.badge(selected.enabled)}>{selected.enabled ? "ENABLED" : "DISABLED"}</span>
                  <span style={S.badge(selected.health.connected)}>
                    {selected.health.connected ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
              </div>

              <div style={S.statRow}>
                <div style={S.statCard}>
                  <p style={S.statValue}>{selected.health.latencyMs}ms</p>
                  <p style={S.statLabel}>Latency</p>
                </div>
                <div style={S.statCard}>
                  <p style={S.statValue}>{selected.health.modelCount}</p>
                  <p style={S.statLabel}>Models</p>
                </div>
                <div style={S.statCard}>
                  <p style={S.statValue}>{selected.requestCount}</p>
                  <p style={S.statLabel}>Requests</p>
                </div>
                <div style={S.statCard}>
                  <p style={S.statValue}>{selected.health.consecutiveFailures}</p>
                  <p style={S.statLabel}>Failures</p>
                </div>
              </div>

              <div style={S.field}>
                <p style={S.fieldLabel}>Endpoint</p>
                <p style={S.fieldValue}>{selected.health.endpoint}</p>
              </div>
              <div style={S.field}>
                <p style={S.fieldLabel}>Protocol</p>
                <p style={S.fieldValue}>{selected.health.protocol || "unknown"}</p>
              </div>
              <div style={S.field}>
                <p style={S.fieldLabel}>Type</p>
                <p style={S.fieldValue}>{selected.type}</p>
              </div>

              {selected.health.lastError && (
                <div style={S.field}>
                  <p style={S.fieldLabel}>Last Error</p>
                  <p style={{ ...S.fieldValue, color: "#ef4444" }}>{selected.health.lastError}</p>
                </div>
              )}

              <div style={S.field}>
                <p style={S.fieldLabel}>
                  Available Models
                  <button
                    onClick={() => handleRefreshModels(selected.providerId)}
                    style={{
                      ...S.btn("default"), fontSize: 11, padding: "3px 8px",
                      marginLeft: 10, fontWeight: 400,
                    }}
                    disabled={loading[`models-${selected.providerId}`]}
                  >
                    {loading[`models-${selected.providerId}`] ? "..." : "↻ Refresh"}
                  </button>
                </p>
                {models.length > 0 ? (
                  <div style={S.modelList}>
                    {models.map((m) => (
                      <div key={m.id} style={S.modelItem}>
                        <span style={S.modelName}>{m.displayName || m.id}</span>
                        <span style={S.modelMeta}>
                          {" "}· {m.supportsStreaming ? "streaming" : "no-streaming"}
                          {m.contextLength > 0 ? ` · ${(m.contextLength / 1024).toFixed(0)}k ctx` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "#999" }}>No models loaded. Click refresh.</p>
                )}
              </div>

              <div style={S.actions}>
                {!selected.active && (
                  <button
                    style={S.btn("primary")}
                    onClick={() => handleActivate(selected.providerId)}
                    disabled={loading[selected.providerId]}
                  >
                    {loading[selected.providerId] ? "..." : "Activate Provider"}
                  </button>
                )}
                {selected.active && (
                  <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600, padding: "8px 0" }}>
                    ✓ Currently Active
                  </span>
                )}
                <button
                  style={S.btn("default")}
                  onClick={() => handleHealthCheck(selected.providerId)}
                  disabled={loading[`health-${selected.providerId}`]}
                >
                  {loading[`health-${selected.providerId}`] ? "..." : "🔍 Health Check"}
                </button>
                {onEditProvider && (
                  <button style={S.btn("default")} onClick={() => onEditProvider(selected.providerId)}>
                    ✎ Edit
                  </button>
                )}
                {onRemoveProvider && (
                  <button style={S.btn("danger")} onClick={() => onRemoveProvider(selected.providerId)}>
                    ✕ Remove
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={S.emptyState}>
              Select a provider to view details, models, and manage it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderCenterUI;
export type { ProviderInfo, ModelInfo };
