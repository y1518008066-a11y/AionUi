const fs = require("fs");
let c = fs.readFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", "utf8");

const reps = [
  [/plugin\.name/g, 'zh(plugin.name)'],
  [/>Enabled</g, '>{zh("Enabled")}<'],
  [/>Disabled</g, '>{zh("Disabled")}<'],
  [/t\("settings\.pluginMarketplace\.refreshed", \{ defaultValue: "Refreshed" \}\)/g, 'zh("Refreshed")'],
  [/t\("settings\.pluginMarketplace\.disabled", \{ defaultValue: "Disabled" \}\)/g, 'zh("Disabled")'],
  [/t\("settings\.pluginMarketplace\.enabled", \{ defaultValue: "Enabled" \}\)/g, 'zh("Enabled")'],
  [/t\("settings\.pluginMarketplace\.installed", \{ defaultValue: "Plugin installed" \}\)/g, 'zh("Plugin installed")'],
  [/t\("settings\.pluginMarketplace\.uninstalled", \{ defaultValue: "Plugin uninstalled" \}\)/g, 'zh("Plugin uninstalled")'],
  [/t\("settings\.pluginMarketplace\.title", \{ defaultValue: "Plugin Marketplace" \}\)/g, 'zh("Plugin Marketplace")'],
  [/t\("settings\.pluginMarketplace\.description", \{ defaultValue: "Install, manage and update plugins for Jarvis." \}\)/g, 'zh("Install, manage and update plugins for Jarvis.")'],
  [/t\("settings\.pluginMarketplace\.searchPlaceholder", \{ defaultValue: "Search plugins..." \}\)/g, 'zh("Search plugins...")'],
  [/t\("settings\.pluginMarketplace\.author", \{ defaultValue: "Author" \}\)/g, 'zh("Author")'],
  [/t\("settings\.pluginMarketplace\.version", \{ defaultValue: "Version" \}\)/g, 'zh("Version")'],
  [/t\("settings\.pluginMarketplace\.permissionConsent", \{ defaultValue: "Permission Consent" \}\)/g, 'zh("Permission Consent")'],
  [/t\("settings\.pluginMarketplace\.install", \{ defaultValue: "Install" \}\)/g, 'zh("Install")'],
  [/t\("settings\.pluginMarketplace\.uninstall", \{ defaultValue: "Uninstall" \}\)/g, 'zh("Uninstall")'],
  [/t\("settings\.pluginMarketplace\.enable", \{ defaultValue: "Enable" \}\)/g, 'zh("Enable")'],
  [/t\("settings\.pluginMarketplace\.disable", \{ defaultValue: "Disable" \}\)/g, 'zh("Disable")'],
  [/t\("settings\.pluginMarketplace\.update", \{ defaultValue: "Update" \}\)/g, 'zh("Update")'],
  [/t\("settings\.pluginMarketplace\.noInstalled", \{ defaultValue: "No plugins installed." \}\)/g, 'zh("No plugins installed.")'],
  [/t\("settings\.pluginMarketplace\.noAvailable", \{ defaultValue: "No plugins available in marketplace." \}\)/g, 'zh("No plugins available in marketplace.")'],
  [/t\("common\.confirm", \{ defaultValue: "Install" \}\)/g, 'zh("Install")'],
  [/t\("common\.cancel", \{ defaultValue: "Cancel" \}\)/g, '"È¡Ïû"'],
  [/t\("common\.refresh", \{ defaultValue: "Refresh" \}\)/g, 'zh("Refresh")'],
  [/defaultValue: "This plugin requires the following permissions:"/g, 'defaultValue: zh("This plugin requires the following permissions:")'],
];

for (const [r, rep] of reps) { c = c.replace(r, rep); }
fs.writeFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", c, "utf8");
console.log("Done");