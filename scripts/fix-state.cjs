const fs = require("fs");
let c = fs.readFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", "utf8");
c = c.replace("useState<PluginInfo[]>(MOCK_PLUGINS)", "useState<PluginInfo[]>(BUILTIN_PLUGINS)");
c = c.replace("useState<PluginInfo[]>(MOCK_MARKETPLACE)", "useState<PluginInfo[]>(BUILTIN_MARKETPLACE)");
fs.writeFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", c, "utf8");
console.log("Done");