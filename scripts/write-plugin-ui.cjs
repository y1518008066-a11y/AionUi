const fs = require("fs");

const code = `import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Message, Modal, Tag, Tooltip, Switch } from "@arco-design/web-react";
import { Puzzle, Search, Refresh, Plus, Play, Pause, FolderOpen, Delete } from "@icon-park/react";
import SettingsPageWrapper from "./components/SettingsPageWrapper";

// Plugin name Chinese mapping
const NAME_ZH: Record<string, string> = {
  "浏览器插件": "浏览器插件", "桌面操控插件": "桌面操控插件", "记忆存储": "记忆存储",
  "任务调度器": "任务调度器", "剪贴板": "剪贴板"
};
const LABEL_ZH: Record<string, string> = {
  "Enabled": "已启用", "Disabled": "已禁用", "Install": "安装", "Uninstall": "卸载",
  "Update": "更新", "Enable": "启用", "Disable": "禁用", "Installed": "已安装",
  "Available": "可安装", "Author": "作者", "Version": "版本", "Deps": "依赖",
  "Refreshed": "已刷新", "Refresh": "刷新",
  "Plugin installed": "插件已安装", "Plugin uninstalled": "插件已卸载",
  "Plugin Marketplace": "插件市场",
  "Install, manage and update plugins for Jarvis.": "安装、管理和更新 Jarvis 插件。",
  "Search plugins...": "搜索插件...",
  "No plugins installed.": "暂无已安装插件。",
  "No plugins available in marketplace.": "市场暂无可用插件。",
  "Permission Consent": "权限确认",
  "This plugin requires the following permissions:": "此插件需要以下权限：",
};
function zh(text: string): string { return NAME_ZH[text] || LABEL_ZH[text] || text; }

interface PluginInfo {
  id: string; name: string; version: string; author: string; description: string;
  enabled: boolean; installed: boolean; capabilities: string[]; permissions: string[];
  dependencies: string[]; homepage?: string; icon?: string; updateAvailable?: string;
}

// Real plugins from local plugins/ directory
const BUILTIN_PLUGINS: PluginInfo[] = [
  { id: "com.jarvis.browser", name: "浏览器插件", version: "1.0.0", author: "Jarvis Team", description: "基于 Playwright 的真实浏览器执行层。", enabled: false, installed: true, capabilities: ["browser","screen","network"], permissions: ["screen:capture","network:outbound","filesystem:read","filesystem:write","process:spawn"], dependencies: [] },
  { id: "com.jarvis.computer-use", name: "桌面操控插件", version: "1.1.0", author: "Jarvis Team", description: "桌面状态感知、截图采集、窗口枚举。", enabled: false, installed: true, capabilities: ["computer-use","screen"], permissions: ["screen:capture","filesystem:write","network:outbound"], dependencies: [] },
  { id: "com.jarvis.memory", name: "记忆存储", version: "1.0.0", author: "Jarvis", description: "持久化键值对记忆存储。", enabled: true, installed: true, capabilities: ["memory"], permissions: ["filesystem:read","filesystem:write"], dependencies: [] },
  { id: "com.jarvis.scheduler", name: "任务调度器", version: "1.0.0", author: "Jarvis", description: "定时任务调度管理。", enabled: true, installed: true, capabilities: ["scheduler"], permissions: ["filesystem:read","filesystem:write","ui:notification"], dependencies: [] },
  { id: "com.jarvis.clipboard", name: "剪贴板", version: "1.0.0", author: "Jarvis", description: "剪贴板读写工具。", enabled: true, installed: true, capabilities: ["clipboard"], permissions: ["clipboard:read","clipboard:write"], dependencies: [] },
];

const CAPABILITY_FILTERS = ["browser","computer-use","clipboard","memory","voice","ocr","scheduler","overlay","screen","vision","desktop","network","notification","audio","ui"];

const PluginMarketplace: React.FC = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [plugins, setPlugins] = useState<PluginInfo[]>(BUILTIN_PLUGINS);
  const [consentModal, setConsentModal] = useState<{ visible: boolean; plugin: PluginInfo | null }>({ visible: false, plugin: null });

  const filteredPlugins = useMemo(() => {
    let list = plugins;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (selectedCaps.length > 0) {
      list = list.filter(p => selectedCaps.some(c => p.capabilities.includes(c)));
    }
    return list;
  }, [plugins, searchQuery, selectedCaps]);

  const handleRefresh = useCallback(async () => { setLoading(true); await new Promise(r => setTimeout(r, 300)); setLoading(false); Message.success(zh("Refreshed")); }, []);
  const handleEnable = useCallback((plugin: PluginInfo) => {
    setPlugins(prev => prev.map(p => p.id === plugin.id ? { ...p, enabled: !p.enabled } : p));
    Message.success(plugin.enabled ? zh("Disabled") : zh("Enabled"));
  }, []);
  const handleUninstall = useCallback((plugin: PluginInfo) => {
    setPlugins(prev => prev.filter(p => p.id !== plugin.id));
    Message.success(zh("Plugin uninstalled"));
  }, []);

  const renderConsentModal = () => (
    <Modal visible={consentModal.visible}
      title={<div className="flex items-center gap-8px"><span className="text-16px font-600">{zh("Permission Consent")}</span></div>}
      onOk={() => { setConsentModal({ visible: false, plugin: null }); }}
      onCancel={() => setConsentModal({ visible: false, plugin: null })}
      okText={zh("Install")} cancelText="取消">
      {consentModal.plugin && (
        <div className="space-y-12px py-8px">
          <div className="text-14px font-600">{consentModal.plugin.name}</div>
          <div className="text-12px text-t-secondary">{zh("This plugin requires the following permissions:")}</div>
          <div className="space-y-4px">
            {consentModal.plugin.permissions.map(perm => (
              <div key={perm} className="flex items-center gap-6px text-13px">
                <span className="text-[#00B42A]">&#10003;</span>
                <code className="text-11px bg-fill-2 px-6px py-2px rd-4px">{perm}</code>
              </div>
            ))}
          </div>
          <div className="text-12px text-t-secondary">{zh("Author")}: {consentModal.plugin.author}</div>
          <div className="text-12px text-t-secondary">{zh("Version")}: {consentModal.plugin.version}</div>
        </div>
      )}
    </Modal>
  );

  const renderCard = (plugin: PluginInfo) => (
    <div key={plugin.id} className="border border-[var(--color-border-2)] rd-12px p-16px bg-base hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-12px">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-8px mb-6px">
            <span className="text-16px font-600 text-t-primary truncate">{plugin.name}</span>
            <Tag size="small" color="arcoblue">v{plugin.version}</Tag>
            <Tag size="small" color={plugin.enabled ? "green" : "gray"}>{plugin.enabled ? zh("Enabled") : zh("Disabled")}</Tag>
          </div>
          <p className="text-13px text-t-secondary mb-8px line-clamp-2">{plugin.description}</p>
          <div className="flex items-center gap-16px text-12px text-t-tertiary mb-8px">
            <span>{zh("Author")}: {plugin.author}</span>
          </div>
          <div className="flex flex-wrap gap-4px mb-8px">
            {plugin.capabilities.map(cap => (<Tag key={cap} size="small" className="!text-10px !px-4px !py-0px">{cap}</Tag>))}
          </div>
          <div className="flex flex-wrap gap-4px">
            {plugin.permissions.map(perm => (<code key={perm} className="text-10px bg-fill-2 text-t-secondary px-4px py-1px rd-4px">{perm}</code>))}
          </div>
        </div>
        <div className="flex flex-col gap-8px shrink-0">
          <Button size="small" type={plugin.enabled ? "outline" : "primary"}
            status={plugin.enabled ? "default" : "success"}
            icon={plugin.enabled ? <Pause /> : <Play />}
            onClick={() => handleEnable(plugin)} className="!w-80px">
            {plugin.enabled ? zh("Disable") : zh("Enable")}
          </Button>
          <Button size="small" type="outline" status="danger" icon={<Delete />}
            onClick={() => handleUninstall(plugin)} className="!w-80px">
            {zh("Uninstall")}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <SettingsPageWrapper>
      {renderConsentModal()}
      <div className="flex flex-col gap-16px">
        <div className="flex items-center justify-between gap-12px flex-wrap">
          <div>
            <h2 className="text-20px font-600 text-t-primary">{zh("Plugin Marketplace")}</h2>
            <p className="text-13px text-t-secondary mt-4px">{zh("Install, manage and update plugins for Jarvis.")}</p>
          </div>
          <Button icon={<Refresh />} loading={loading} onClick={handleRefresh} shape="round">{zh("Refresh")}</Button>
        </div>
        <div className="flex items-center gap-8px flex-wrap">
          <Input prefix={<Search />} placeholder={zh("Search plugins...")} value={searchQuery} onChange={setSearchQuery} className="!w-240px" allowClear />
          <div className="flex flex-wrap gap-4px">
            {CAPABILITY_FILTERS.map(cap => (
              <Tag key={cap} size="small" checkable checked={selectedCaps.includes(cap)}
                onClick={() => setSelectedCaps(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap])}
                className="cursor-pointer">{cap}</Tag>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-16px font-600 text-t-primary mb-12px flex items-center gap-8px">
            <Puzzle theme="outline" size="18" />
            {zh("Installed")}
            <Tag size="small">{filteredPlugins.length}</Tag>
          </h3>
          {filteredPlugins.length === 0 ? (
            <div className="text-13px text-t-tertiary py-24px text-center">{zh("No plugins installed.")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12px">{filteredPlugins.map(renderCard)}</div>
          )}
        </div>
      </div>
    </SettingsPageWrapper>
  );
};

export default PluginMarketplace;
`;

fs.writeFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", code, "utf8");
console.log("Written clean file");