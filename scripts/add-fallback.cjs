const fs = require("fs");
let c = fs.readFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx","utf8");

// Add local fallback after fetch fails
const oldCatch = '.catch(()=>{setMktErr("离线");setMktLoading(false)});';
const newCatch = '.catch(()=>{fetch("/marketplace/index.json").then(r=>r.json()).then(d=>{setMarket(Array.isArray(d)?d:(d.entries||d.plugins||[]));setMktLoading(false);setMktErr(null)}).catch(()=>{setMktErr("离线");setMktLoading(false)})});';

c = c.replace(oldCatch, newCatch);
fs.writeFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", c, "utf8");
console.log("Done");