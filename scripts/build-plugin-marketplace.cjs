const fs = require("fs");

const code = `import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Message, Modal, Tag, Tooltip } from "@arco-design/web-react";
import { Puzzle, Search, Refresh, Plus, Play, Pause, FolderOpen, Delete } from "@icon-park/react";
import SettingsPageWrapper from "./components/SettingsPageWrapper";

const NAME_ZH = {};
const LAB_ZH = {
  "Enabled":"已启用","Disabled":"已禁用","Install":"安装","Uninstall":"卸载","Update":"更新","Enable":"启用","Disable":"禁用",
  "Installed":"已安装","Available":"可安装","Author":"作者","Version":"版本","Deps":"依赖","Refreshed":"已刷新","Refresh":"刷新",
  "Plugin installed":"插件已安装","Plugin uninstalled":"插件已卸载","Plugin Marketplace":"插件市场",
  "Install, manage and update plugins for Jarvis.":"安装、管理和更新 Jarvis 插件。",
  "Search plugins...":"搜索插件...","No plugins installed.":"暂无已安装插件。",
  "No plugins available in marketplace.":"市场暂无可用插件。","Permission Consent":"权限确认",
  "This plugin requires the following permissions:":"此插件需要以下权限："
};
function zh(t){return NAME_ZH[t]||LAB_ZH[t]||t}

interface PluginInfo { id:string;name:string;version:string;author:string;description:string;enabled:boolean;installed:boolean;capabilities:string[];permissions:string[];dependencies:string[];downloads?:number;rating?:number }

const BUILTIN:PluginInfo[]=[
  {id:"com.jarvis.browser",name:"浏览器插件",version:"1.0.0",author:"Jarvis Team",description:"基于 Playwright 的真实浏览器执行层。",enabled:false,installed:true,capabilities:["browser","screen","network"],permissions:["screen:capture","network:outbound","filesystem:read","filesystem:write","process:spawn"],dependencies:[]},
  {id:"com.jarvis.computer-use",name:"桌面操控插件",version:"1.1.0",author:"Jarvis Team",description:"桌面状态感知、截图采集、窗口枚举。",enabled:false,installed:true,capabilities:["computer-use","screen"],permissions:["screen:capture","filesystem:write","network:outbound"],dependencies:[]},
  {id:"com.jarvis.memory",name:"记忆存储",version:"1.0.0",author:"Jarvis",description:"持久化键值对记忆存储。",enabled:true,installed:true,capabilities:["memory"],permissions:["filesystem:read","filesystem:write"],dependencies:[]},
  {id:"com.jarvis.scheduler",name:"任务调度器",version:"1.0.0",author:"Jarvis",description:"定时任务调度管理。",enabled:true,installed:true,capabilities:["scheduler"],permissions:["filesystem:read","filesystem:write","ui:notification"],dependencies:[]},
  {id:"com.jarvis.clipboard",name:"剪贴板",version:"1.0.0",author:"Jarvis",description:"剪贴板读写工具。",enabled:true,installed:true,capabilities:["clipboard"],permissions:["clipboard:read","clipboard:write"],dependencies:[]}
];

const CAPS=["browser","computer-use","clipboard","memory","voice","ocr","scheduler","overlay","screen","vision","desktop","network","notification","audio","ui"];

const PluginMarketplace=()=>{
  const [search,setSearch]=useState("");
  const [caps,setCaps]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [plugins,setPlugins]=useState<PluginInfo[]>(BUILTIN);
  const [market,setMarket]=useState<PluginInfo[]>([]);
  const [mktLoading,setMktLoading]=useState(false);
  const [mktErr,setMktErr]=useState<string|null>(null);
  const [consent,setConsent]=useState<{visible:boolean;plugin:PluginInfo|null}>({visible:false,plugin:null});

  useEffect(()=>{
    setMktLoading(true);
    fetch("https://y1518008066-a11y.github.io/AionUi/marketplace/index.json")
      .then(r=>r.ok?r.json():Promise.reject(r.status))
      .then(d=>{setMarket(Array.isArray(d)?d:(d.entries||d.plugins||[]));setMktLoading(false)})
      .catch(()=>{setMktErr("离线");setMktLoading(false)});
  },[]);

  const filtered=useMemo(()=>{
    let l=plugins;
    if(search){const q=search.toLowerCase();l=l.filter(p=>p.name.toLowerCase().includes(q)||p.description.toLowerCase().includes(q))}
    if(caps.length)l=l.filter(p=>caps.some(c=>p.capabilities.includes(c)));
    return l;
  },[plugins,search,caps]);

  const installPlugin=(p:PluginInfo)=>{setPlugins(prev=>[...prev,{...p,installed:true,enabled:true}]);setConsent({visible:false,plugin:null});Message.success(zh("Plugin installed"))};
  const toggleEnable=(p:PluginInfo)=>{setPlugins(prev=>prev.map(x=>x.id===p.id?{...x,enabled:!x.enabled}:x));Message.success(p.enabled?zh("Disabled"):zh("Enabled"))};
  const uninstall=(p:PluginInfo)=>{setPlugins(prev=>prev.filter(x=>x.id!==p.id));Message.success(zh("Plugin uninstalled"))};

  const renderCard=(p:PluginInfo,installed:boolean)=>(
    <div key={p.id} className={"border rd-12px p-16px bg-base hover:shadow-md transition-shadow "+(installed?"border-[var(--color-border-2)]":"border-dashed border-[var(--color-border-2)]")}>
      <div className="flex items-start justify-between gap-12px">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-8px mb-6px">
            <span className="text-16px font-600 text-t-primary truncate">{p.name}</span>
            <Tag size="small" color="arcoblue">v{p.version}</Tag>
            {installed&&<Tag size="small" color={p.enabled?"green":"gray"}>{p.enabled?zh("Enabled"):zh("Disabled")}</Tag>}
            {p.rating&&<Tag size="small" color="gold">{(Number(p.rating)||0).toFixed(1)}</Tag>}
          </div>
          <p className="text-13px text-t-secondary mb-8px line-clamp-2">{p.description}</p>
          <div className="flex items-center gap-16px text-12px text-t-tertiary mb-8px">
            <span>{zh("Author")}: {p.author}</span>
            {(p.downloads||0)>0&&<span>↓ {p.downloads}</span>}
          </div>
          <div className="flex flex-wrap gap-4px mb-8px">{(p.capabilities||[]).map(c=><Tag key={c} size="small" className="!text-10px !px-4px !py-0px">{c}</Tag>)}</div>
          <div className="flex flex-wrap gap-4px">{(p.permissions||[]).map(x=><code key={x} className="text-10px bg-fill-2 text-t-secondary px-4px py-1px rd-4px">{x}</code>)}</div>
        </div>
        <div className="flex flex-col gap-8px shrink-0">
          {installed?<>
            <Button size="small" type={p.enabled?"outline":"primary"} status={p.enabled?"default":"success"} icon={p.enabled?<Pause/>:<Play/>} onClick={()=>toggleEnable(p)} className="!w-80px">{p.enabled?zh("Disable"):zh("Enable")}</Button>
            <Button size="small" type="outline" status="danger" icon={<Delete/>} onClick={()=>uninstall(p)} className="!w-80px">{zh("Uninstall")}</Button>
          </>:<>
            <Button size="small" type="primary" icon={<Plus/>} onClick={()=>setConsent({visible:true,plugin:p})} className="!w-80px">{zh("Install")}</Button>
          </>}
        </div>
      </div>
    </div>
  );

  return (
    <SettingsPageWrapper>
      <Modal visible={consent.visible} title={<div className="flex items-center gap-8px"><span className="text-16px font-600">{zh("Permission Consent")}</span></div>}
        onOk={()=>consent.plugin&&installPlugin(consent.plugin)} onCancel={()=>setConsent({visible:false,plugin:null})}
        okText={zh("Install")} cancelText="取消">
        {consent.plugin&&<div className="space-y-12px py-8px">
          <div className="text-14px font-600">{consent.plugin.name}</div>
          <div className="text-12px text-t-secondary">{zh("This plugin requires the following permissions:")}</div>
          <div className="space-y-4px">{(consent.plugin.permissions||[]).map(perm=><div key={perm} className="flex items-center gap-6px text-13px"><span className="text-[#00B42A]">&#10003;</span><code className="text-11px bg-fill-2 px-6px py-2px rd-4px">{perm}</code></div>)}</div>
          <div className="text-12px text-t-secondary">{zh("Author")}: {consent.plugin.author}</div>
          <div className="text-12px text-t-secondary">{zh("Version")}: {consent.plugin.version}</div>
        </div>}
      </Modal>
      <div className="flex flex-col gap-16px">
        <div className="flex items-center justify-between gap-12px flex-wrap">
          <div><h2 className="text-20px font-600 text-t-primary">{zh("Plugin Marketplace")}</h2><p className="text-13px text-t-secondary mt-4px">{zh("Install, manage and update plugins for Jarvis.")}</p></div>
          <Button icon={<Refresh/>} loading={loading} onClick={async()=>{setLoading(true);await new Promise(r=>setTimeout(r,300));setLoading(false);Message.success(zh("Refreshed"))}} shape="round">{zh("Refresh")}</Button>
        </div>
        <div className="flex items-center gap-8px flex-wrap">
          <Input prefix={<Search/>} placeholder={zh("Search plugins...")} value={search} onChange={setSearch} className="!w-240px" allowClear/>
          <div className="flex flex-wrap gap-4px">{CAPS.map(c=><Tag key={c} size="small" checkable checked={caps.includes(c)} onClick={()=>setCaps(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c])} className="cursor-pointer">{c}</Tag>)}</div>
        </div>
        <div>
          <h3 className="text-16px font-600 text-t-primary mb-12px flex items-center gap-8px"><Puzzle theme="outline" size="18"/>{zh("Installed")}<Tag size="small">{filtered.length}</Tag></h3>
          {filtered.length===0?<div className="text-13px text-t-tertiary py-24px text-center">{zh("No plugins installed.")}</div>:<div className="grid grid-cols-1 md:grid-cols-2 gap-12px">{filtered.map(p=>renderCard(p,true))}</div>}
        </div>
        <div className="mt-8px">
          <h3 className="text-16px font-600 text-t-primary mb-12px flex items-center gap-8px"><FolderOpen theme="outline" size="18"/>{zh("Available")}<Tag size="small">{market.length}</Tag>{mktLoading&&<Tag size="small" color="arcoblue">加载中...</Tag>}{mktErr&&<Tag size="small" color="red">{mktErr}</Tag>}</h3>
          {market.length===0&&!mktLoading?<div className="text-13px text-t-tertiary py-24px text-center">{mktErr?"市场暂不可用，请检查网络连接。":zh("No plugins available in marketplace.")}</div>:<div className="grid grid-cols-1 md:grid-cols-2 gap-12px">{market.filter(p=>!plugins.find(l=>l.id===p.id)).map(p=>renderCard(p,false))}</div>}
        </div>
      </div>
    </SettingsPageWrapper>
  );
};

export default PluginMarketplace;
`;

fs.writeFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", code, "utf8");
console.log("Written clean complete file with marketplace");