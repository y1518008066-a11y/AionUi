/**
 * Jarvis Sidebar — Modes, Providers, Plugins
 */

import React, { useState } from "react";
import type { ModeInfo } from "../JarvisModeConfig";
import type { ProviderInfo } from "../ProviderCenterUI";
import type { PluginInfo } from "../JarvisPluginManager";

type Props = {
  modes: ModeInfo[];
  activeModeId: string | null;
  providers: ProviderInfo[];
  activeProviderId: string | null;
  plugins: PluginInfo[];
  onSwitchMode: (modeId: string) => Promise<void>;
  onSwitchProvider: (providerId: string) => Promise<void>;
};

const S = {
  container: { padding: "0 8px", overflowY: "auto" as const, flex: 1 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#999", padding: "4px 8px", margin: "8px 0 4px" },
  item: (active: boolean) => ({
    padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13,
    backgroundColor: active ? "var(--color-primary-light, rgba(79,70,229,0.1))" : "transparent",
    color: active ? "var(--color-primary, #4f46e5)" : "var(--color-text-primary, #333)",
    fontWeight: active ? 600 : 400,
    marginBottom: 2,
    display: "flex", alignItems: "center", gap: 8,
  }),
  dot: (online: boolean) => ({
    width: 6, height: 6, borderRadius: 3, flexShrink: 0,
    backgroundColor: online ? "#16a34a" : "#d1d5db",
  }),
  badge: { fontSize: 10, color: "#999", marginLeft: "auto" },
};

const JarvisSidebar: React.FC<Props> = ({ modes, activeModeId, providers, activeProviderId, plugins, onSwitchMode, onSwitchProvider }) => {
  const [section, setSection] = useState<"modes" | "providers" | "plugins">("modes");

  return (
    <div style={S.container}>
      {/* Section tabs */}
      <div style={{ display: "flex", gap: 2, padding: "0 4px", marginBottom: 8 }}>
        {(["modes", "providers", "plugins"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            style={{
              flex: 1, padding: "5px 0", border: "none", borderRadius: 4, cursor: "pointer",
              fontSize: 11, fontWeight: section === s ? 600 : 400,
              backgroundColor: section === s ? "var(--color-primary, #4f46e5)" : "transparent",
              color: section === s ? "#fff" : "#999",
            }}
          >
            {s === "modes" ? "Modes" : s === "providers" ? "Providers" : "Plugins"}
          </button>
        ))}
      </div>

      {section === "modes" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Modes</div>
          {modes.map((m) => (
            <div key={m.id} style={S.item(activeModeId === m.id)} onClick={() => onSwitchMode(m.id)}>
              <span>{m.label}</span>
              {activeModeId === m.id && <span style={S.badge}>active</span>}
            </div>
          ))}
        </div>
      )}

      {section === "providers" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Providers</div>
          {providers.map((p) => (
            <div key={p.providerId} style={S.item(activeProviderId === p.providerId)} onClick={() => onSwitchProvider(p.providerId)}>
              <span style={S.dot(p.health.connected)} />
              <span>{p.name}</span>
              {activeProviderId === p.providerId && <span style={S.badge}>active</span>}
            </div>
          ))}
        </div>
      )}

      {section === "plugins" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Plugins ({plugins.filter((p) => p.enabled).length} enabled)</div>
          {plugins.map((p) => (
            <div key={p.id} style={S.item(p.enabled)}>
              <span style={S.dot(p.enabled && p.state !== "error")} />
              <span>{p.name}</span>
              <span style={S.badge}>{p.enabled ? "on" : "off"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JarvisSidebar;
