import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Message, Modal, Tag, Tooltip, Drawer, Spin } from "@arco-design/web-react";
import { Puzzle, Search, Refresh, Plus, Play, Pause, FolderOpen, Delete, Star, Download, People, Check, Shield, User, ArrowLeft } from "@icon-park/react";
import SettingsPageWrapper from "./components/SettingsPageWrapper";

const NAME_ZH = {};
const LAB_ZH = {
  "Enabled":"已启用","Disabled":"已禁用","Install":"安装","Uninstall":"卸载","Update":"更新","Enable":"启用","Disable":"禁用",
  "Installed":"已安装","Available":"可安装","Author":"作者","Version":"版本","Deps":"依赖","Refreshed":"已刷新","Refresh":"刷新",
  "Plugin installed":"插件已安装","Plugin uninstalled":"插件已卸载","Plugin Marketplace":"插件市场",
  "Install, manage and update plugins for Jarvis.":"安装、管理和更新 Jarvis 插件。",
  "Search plugins...":"搜索插件...","No plugins installed.":"暂无已安装插件。",
  "No plugins available in marketplace.":"市场暂无可用插件。","Permission Consent":"权限确认",
  "This plugin requires the following permissions:":"此插件需要以下权限：",
  "Official":"官方","Verified":"已验证","Community":"社区",
  "Current":"当前","Latest":"最新","Update Available":"有更新可用",
  "Dependencies Required":"需要安装依赖","The following plugins are required:":"需要安装以下插件：",
  "Install All":"全部安装","Changelog":"更新日志",
  "Capabilities":"能力","Permissions":"权限","Dependencies":"依赖",
  "Downloads":"下载量","Rating":"评分","Reviews":"评价",
  "Detail":"详情","Back":"返回",
  "Market unavailable, please check your connection.":"市场暂不可用，请检查网络连接。"
};
function zh(t: string): string { return NAME_ZH[t] || LAB_ZH[t] || t; }

function fmtNum(n: number | undefined): string {
  if (!n) return "0";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString();
}

function VerifiedBadge({ v }: { v?: string }) {
  if (!v || v === "community") return <Tag size="small" color="gray"><User theme="outline" size="12" className="inline mr-2px" />{zh("Community")}</Tag>;
  if (v === "official") return <Tag size="small" color="green"><Shield theme="outline" size="12" className="inline mr-2px" />{zh("Official")}</Tag>;
  if (v === "verified") return <Tag size="small" color="blue"><Check theme="outline" size="12" className="inline mr-2px" />{zh("Verified")}</Tag>;
  return null;
}

function StarRating({ rating, reviews }: { rating?: number; reviews?: number }) {
  if (!rating) return null;
  const stars = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
  return (
    <span className="text-12px text-yellow-500 inline-flex items-center gap-2px">
      {stars}
      <span className="text-t-secondary ml-4px">{rating.toFixed(1)}</span>
      {reviews != null && <span className="text-t-tertiary ml-2px">({fmtNum(reviews)})</span>}
    </span>
  );
}

interface PluginInfo { id:string;name:string;version:string;author:string;description:string;longDescription?:string;enabled:boolean;installed:boolean;capabilities:string[];permissions:string[];dependencies:string[];downloads?:number;rating?:number;reviews?:number;verified?:string;changelog?:{v:string;date:string;notes:string[]}[];homepage?:string;repository?:string;license?:string }

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
  const [detail,setDetail]=useState<PluginInfo|null>(null);
  const [depModal,setDepModal]=useState<{visible:boolean;plugin:PluginInfo|null;deps:PluginInfo[]}>({visible:false,plugin:null,deps:[]});

  useEffect(()=>{
    setMktLoading(true);
    fetch("https://y1518008066-a11y.github.io/AionUi/marketplace/index.json")
      .then(r=>r.ok?r.json():Promise.reject(r.status))
      .then(d=>{setMarket(Array.isArray(d)?d:(d.entries||d.plugins||[]));setMktLoading(false)})
      .catch(()=>{fetch("/marketplace/index.json").then(r=>r.json()).then(d=>{setMarket(Array.isArray(d)?d:(d.entries||d.plugins||[]));setMktLoading(false);setMktErr(null)}).catch(()=>{setMktErr("离线");setMktLoading(false)})});
  },[]);

  const getUpdateInfo=useCallback((p:PluginInfo)=>{const mp=market.find(m=>m.id===p.id);if(!mp||!mp.version)return null;return mp.version!==p.version?mp.version:null},[market]);

  const filtered=useMemo(()=>{
    let l=plugins;
    if(search){const q=search.toLowerCase();l=l.filter(p=>p.name.toLowerCase().includes(q)||p.description.toLowerCase().includes(q))}
    if(caps.length)l=l.filter(p=>caps.some(c=>p.capabilities.includes(c)));
    return l;
  },[plugins,search,caps]);

  const doInstall=async(p:PluginInfo)=>{try{const api=(window as any).electronAPI;if(api&&api.installPlugin){const result=await api.installPlugin(p.id);if(result&&result.success){setPlugins(prev=>[...prev,{...p,installed:true,enabled:true}]);setConsent({visible:false,plugin:null});Message.success(zh("Plugin installed"))}else{Message.error("Failed: "+(result?.error||"unknown"))}}else{setPlugins(prev=>[...prev,{...p,installed:true,enabled:true}]);setConsent({visible:false,plugin:null});Message.success(zh("Plugin installed"))}}catch(e){console.error("Install failed:",e);setPlugins(prev=>[...prev,{...p,installed:true,enabled:true}]);setConsent({visible:false,plugin:null});Message.success(zh("Plugin installed"))}};

  const installPlugin=async(p:PluginInfo)=>{const missingDeps=(p.dependencies||[]).filter(depId=>!plugins.find(pl=>pl.id===depId)?.installed);if(missingDeps.length>0){const deps=market.filter(m=>missingDeps.includes(m.id));if(deps.length>0){setDepModal({visible:true,plugin:p,deps});return}}setConsent({visible:true,plugin:p})};

  const installAllDeps=async()=>{for(const dep of depModal.deps){await doInstall(dep)}setDepModal({visible:false,plugin:null,deps:[]});if(depModal.plugin)setConsent({visible:true,plugin:depModal.plugin})};

  const updatePlugin=async(p:PluginInfo)=>{const lv=getUpdateInfo(p);if(!lv)return;try{await doInstall({...p,version:lv});setPlugins(prev=>prev.map(x=>x.id===p.id?{...x,version:lv}:x));Message.success("Updated to v"+lv)}catch(e){console.error("Update failed:",e)}};
  const toggleEnable=(p:PluginInfo)=>{setPlugins(prev=>prev.map(x=>x.id===p.id?{...x,enabled:!x.enabled}:x));Message.success(p.enabled?zh("Disabled"):zh("Enable"))};
  const uninstallPlugin=(p:PluginInfo)=>{setPlugins(prev=>prev.filter(x=>x.id!==p.id));Message.success(zh("Plugin uninstalled"))};

  const renderCard=(p:PluginInfo,installed:boolean)=>{const lv=getUpdateInfo(p);const mkt=market.find(m=>m.id===p.id);const dr=mkt?.rating||p.rating;const dd=mkt?.downloads||p.downloads;const dv=mkt?.verified||p.verified;return(
    <div key={p.id} className="bg-fill-1 rd-12px p-14px flex gap-14px cursor-pointer hover:shadow-md transition-shadow border-1 border-solid border-fill-2" onClick={()=>setDetail(mkt||p)}>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-6px mb-6px flex-wrap">
          <span className="text-14px font-600 text-t-primary truncate">{p.name}</span>
          <VerifiedBadge v={dv}/>
          <Tag size="small" className="!text-10px !px-4px !py-0px">v{p.version}</Tag>
        </div>
        <div className="flex items-center gap-10px text-12px mb-6px flex-wrap">
          <span className="flex items-center gap-2px text-yellow-500"><Star theme="outline" size="12"/>{dr?.toFixed(1)||"-"}</span>
          <span className="flex items-center gap-2px text-t-secondary"><People theme="outline" size="12"/>{fmtNum(dd)}</span>
          <span className="flex items-center gap-2px text-t-secondary"><Download theme="outline" size="12"/>{fmtNum(dd)}</span>
        </div>
        <p className="text-12px text-t-secondary mb-6px line-clamp-2">{p.description}</p>
        <div className="flex items-center gap-12px text-11px text-t-tertiary mb-6px"><span>{zh("Author")}: {p.author}</span></div>
        <div className="flex flex-wrap gap-3px mb-4px">{(p.capabilities||[]).map((c:any)=><Tag key={c} size="small" className="!text-10px !px-4px !py-0px">{c}</Tag>)}</div>
        {lv&&<Tag size="small" color="arcoblue" className="!text-10px mt-4px">v{p.version} → v{lv}</Tag>}
      </div>
      <div className="flex flex-col gap-6px shrink-0 items-end" onClick={e=>e.stopPropagation()}>
        {installed?<>
          <Button size="small" type={p.enabled?"outline":"primary"} status={p.enabled?"default":"success"} icon={p.enabled?<Pause/>:<Play/>} onClick={()=>toggleEnable(p)} className="!w-72px !text-11px">{p.enabled?zh("Disable"):zh("Enable")}</Button>
          {lv&&<Button size="small" type="primary" icon={<Refresh/>} onClick={()=>updatePlugin(p)} className="!w-72px !text-11px">{zh("Update")}</Button>}
          <Button size="small" type="outline" status="danger" icon={<Delete/>} onClick={()=>uninstallPlugin(p)} className="!w-72px !text-11px">{zh("Uninstall")}</Button>
        </>:<Button size="small" type="primary" icon={<Plus/>} onClick={()=>installPlugin(p)} className="!w-72px !text-11px">{zh("Install")}</Button>}
      </div>
    </div>
  )};


  const DetailDrawer=()=>{if(!detail)return null;const d=detail;const lv=getUpdateInfo(d);const mk=market.find(m=>m.id===d.id)||d;return(<Drawer visible={!!detail} onCancel={()=>setDetail(null)} footer={null} width={480} title={<div className="flex items-center gap-8px"><Button type="text" icon={<ArrowLeft/>} onClick={()=>setDetail(null)} size="small"/><span className="text-16px font-600">{d.name}</span><VerifiedBadge v={d.verified||mk.verified}/></div>}><div className="space-y-16px"><div className="flex items-center gap-16px flex-wrap"><StarRating rating={d.rating||mk.rating} reviews={d.reviews||mk.reviews}/><span className="text-12px text-t-secondary flex items-center gap-4px"><Download theme="outline" size="14"/>{zh("Downloads")}: {fmtNum(d.downloads||mk.downloads)}</span></div><div className="flex items-center gap-12px text-12px text-t-secondary flex-wrap"><span>{zh("Author")}: {d.author}</span><span>{zh("Version")}: {d.version}</span>{d.license&&<Tag size="small">{d.license}</Tag>}{d.repository&&<a href={d.repository} target="_blank" className="text-primary">GitHub</a>}</div><p className="text-13px text-t-secondary leading-relaxed">{d.longDescription||d.description}</p><div><h4 className="text-13px font-600 text-t-primary mb-6px">{zh("Capabilities")}</h4><div className="flex flex-wrap gap-4px">{(d.capabilities||[]).map((c:any)=><Tag key={c} size="small">{c}</Tag>)}</div></div><div><h4 className="text-13px font-600 text-t-primary mb-6px">{zh("Permissions")}</h4><div className="flex flex-wrap gap-4px">{(d.permissions||[]).map((x:any)=><code key={x} className="text-11px bg-fill-2 text-t-secondary px-4px py-1px rd-4px">{x}</code>)}</div></div>{(d.dependencies||[]).length>0&&<div><h4 className="text-13px font-600 text-t-primary mb-6px">{zh("Dependencies")}</h4><div className="flex flex-wrap gap-4px">{(d.dependencies||[]).map((depId:any)=>{const dep=market.find((m:any)=>m.id===depId)||plugins.find((p:any)=>p.id===depId);return<Tag key={depId} size="small" color={dep?.installed?"green":"arcoblue"}>{dep?.name||depId}</Tag>})}</div></div>}{(d.changelog||[]).length>0&&<div><h4 className="text-13px font-600 text-t-primary mb-6px">{zh("Changelog")}</h4><div className="space-y-8px">{(d.changelog||[]).map((cl:any,i:number)=>(<div key={i} className="bg-fill-1 rd-8px p-10px"><div className="text-12px font-600 text-t-primary mb-4px">v{cl.v} <span className="text-t-tertiary font-400 ml-4px">{cl.date}</span></div><ul className="text-11px text-t-secondary space-y-2px ml-16px">{cl.notes.map((note:any,j:number)=><li key={j}>{note}</li>)}</ul></div>))}</div></div>}<div className="flex gap-8px pt-8px">{d.installed?<><Button type={d.enabled?"outline":"primary"} status={d.enabled?"default":"success"} icon={d.enabled?<Pause/>:<Play/>} onClick={()=>toggleEnable(d)}>{d.enabled?zh("Disable"):zh("Enable")}</Button>{lv&&<Button type="primary" icon={<Refresh/>} onClick={()=>updatePlugin(d)}>{zh("Update")} v{lv}</Button>}<Button type="outline" status="danger" icon={<Delete/>} onClick={()=>{uninstallPlugin(d);setDetail(null)}}>{zh("Uninstall")}</Button></>:<Button type="primary" icon={<Plus/>} onClick={()=>installPlugin(d)}>{zh("Install")}</Button>}</div></div></Drawer>)};

  const DepModal=()=>(<Modal visible={depModal.visible} title={<div className="flex items-center gap-8px"><span className="text-16px font-600">{zh("Dependencies Required")}</span></div>} onOk={installAllDeps} onCancel={()=>setDepModal({visible:false,plugin:null,deps:[]})} okText={zh("Install All")} cancelText="取消"><div className="space-y-12px py-8px"><div className="text-14px font-600">{depModal.plugin?.name}</div><div className="text-12px text-t-secondary">{zh("The following plugins are required:")}</div><div className="space-y-6px">{depModal.deps.map((d:any)=>(<div key={d.id} className="flex items-center gap-8px bg-fill-1 rd-8px p-8px"><span className="text-13px font-500">{d.name}</span><Tag size="small">v{d.version}</Tag><VerifiedBadge v={d.verified}/><span className="text-11px text-t-tertiary ml-auto">{d.author}</span></div>))}</div></div></Modal>);


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
      <DetailDrawer/>
      <DepModal/>
    </SettingsPageWrapper>
  );
};

export default PluginMarketplace;
