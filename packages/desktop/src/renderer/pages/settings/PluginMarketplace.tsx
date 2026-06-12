import React, { useEffect, useState } from "react";
import { Button, Input, Message, Tag, Spin } from "@arco-design/web-react";
import { Search, Refresh, Play, Pause, Delete } from "@icon-park/react";
import SettingsPageWrapper from "./components/SettingsPageWrapper";

const LAB_ZH: Record<string, string> = {
  "Enabled":"已启用","Disabled":"已禁用","Uninstall":"卸载","Enable":"启用","Disable":"禁用",
  "Installed":"已安装","Author":"作者","Version":"版本",
  "Plugin installed":"插件已安装","Plugin uninstalled":"插件已卸载","Plugin Marketplace":"插件市场",
  "Search plugins...":"搜索插件...","No plugins installed.":"暂无已安装插件。",
  "Refresh":"刷新","Refreshed":"已刷新",
};
function zh(t: string): string { return LAB_ZH[t] || t; }

interface PluginInfo { id:string;name:string;version:string;author:string;description:string;enabled:boolean;installed:boolean;capabilities:string[];permissions:string[];dependencies:string[] }

const PluginMarketplace=()=>{
  const [search,setSearch]=useState("");
  const [plugins,setPlugins]=useState<PluginInfo[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const api = (window as any).electronAPI;

  const loadInstalled = async () => {
    setLoading(true);
    setError(null);
    try {
      if (api && api.getInstalledPlugins) {
        const res = await api.getInstalledPlugins();
        if (res && res.success && Array.isArray(res.plugins)) {
          const ids = new Set(typeof res.plugins[0]==="string" ? res.plugins : res.plugins.map((p:any)=>p.id||p));
          // Build plugin list with manifest info if available
          const list: PluginInfo[] = [];
          for (const id of ids) {
            try {
              const verRes = await api.getPluginVersion(id);
              list.push({
                id, name: id.replace("com.jarvis.",""), version: verRes?.version||"0.0.0",
                author:"", description:"", enabled:true, installed:true,
                capabilities:[], permissions:[], dependencies:[]
              });
            } catch { list.push({id,name:id.replace("com.jarvis.",""),version:"0.0.0",author:"",description:"",enabled:true,installed:true,capabilities:[],permissions:[],dependencies:[]}); }
          }
          setPlugins(list);
        }
      }
    } catch(e) {
      setError(String(e));
    }
    setLoading(false);
  };

  useEffect(()=>{ loadInstalled(); },[]);

  const toggleEnable = async (p: PluginInfo) => {
    if (!api) return;
    try {
      const result = p.enabled ? await api.disablePlugin(p.id) : await api.enablePlugin(p.id);
      if (result && result.success) {
        setPlugins(prev=>prev.map(x=>x.id===p.id?{...x,enabled:!x.enabled}:x));
        Message.success(p.enabled ? zh("Disabled") : zh("Enabled"));
      } else {
        Message.error("Failed: "+(result?.error||"unknown"));
      }
    } catch(e) { Message.error(String(e)); }
  };

  const uninstall = async (p: PluginInfo) => {
    if (!api) return;
    try {
      const result = await api.uninstallPlugin(p.id, false);
      if (result && result.success) {
        setPlugins(prev=>prev.filter(x=>x.id!==p.id));
        Message.success(zh("Plugin uninstalled"));
      } else {
        Message.error("Failed: "+(result?.error||"unknown"));
      }
    } catch(e) { Message.error(String(e)); }
  };

  const filtered = search
    ? plugins.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : plugins;

  return (
    <SettingsPageWrapper title={zh("Plugin Marketplace")} subtitle="已安装的插件">
      <div className="space-y-16px">
        <div className="flex items-center gap-12px">
          <Input prefix={<Search/>} placeholder={zh("Search plugins...")} value={search} onChange={setSearch} className="flex-1" allowClear/>
          <Button icon={<Refresh/>} onClick={loadInstalled} loading={loading}>{zh("Refresh")}</Button>
        </div>
        {loading ? <div className="text-center py-40px"><Spin/></div>
        : error ? <div className="text-13px text-red py-24px text-center">{error}</div>
        : filtered.length===0 ? <div className="text-13px text-t-tertiary py-24px text-center">{zh("No plugins installed.")}</div>
        : <div className="space-y-8px">
          {filtered.map(p=>(
            <div key={p.id} className="flex items-center justify-between bg-fill-1 rd-8px p-12px">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-8px">
                  <span className="text-14px font-600">{p.name}</span>
                  <Tag size="small" color={p.enabled?"green":"gray"}>{p.enabled?zh("Enabled"):zh("Disabled")}</Tag>
                  <span className="text-11px text-t-tertiary">v{p.version}</span>
                </div>
                <div className="text-12px text-t-secondary mt-2px">{p.id}</div>
              </div>
              <div className="flex items-center gap-8px shrink-0">
                <Button size="small" type={p.enabled?"outline":"primary"} icon={p.enabled?<Pause/>:<Play/>} onClick={()=>toggleEnable(p)}>{p.enabled?zh("Disable"):zh("Enable")}</Button>
                <Button size="small" type="outline" status="danger" icon={<Delete/>} onClick={()=>uninstall(p)}>{zh("Uninstall")}</Button>
              </div>
            </div>
          ))}
        </div>}
      </div>
    </SettingsPageWrapper>
  );
};

export default PluginMarketplace;
