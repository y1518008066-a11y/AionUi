const fs = require("fs");
let c = fs.readFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", "utf8");

// Replace garbled PLUGIN_NAME_ZH and LABEL_ZH with correct Chinese
const good = `const PLUGIN_NAME_ZH: Record<string, string> = {
  "Browser": "浏览器",
  "Computer Use": "桌面操控",
  "Memory": "记忆",
  "Scheduler": "调度器",
  "Clipboard": "剪贴板",
  "Overlay": "悬浮窗",
  "Voice": "语音",
  "OCR": "文字识别",
  "Vision": "视觉分析",
  "GitHub": "GitHub",
};
const LABEL_ZH: Record<string, string> = {
  "Enabled": "已启用",
  "Disabled": "已禁用",
  "Install": "安装",
  "Uninstall": "卸载",
  "Update": "更新",
  "Enable": "启用",
  "Disable": "禁用",
  "Installed": "已安装",
  "Available": "可安装",
  "Author": "作者",
  "Version": "版本",
  "Deps": "依赖",
  "Refreshed": "已刷新",
  "Refresh": "刷新",
  "Plugin installed": "插件已安装",
  "Plugin uninstalled": "插件已卸载",
};`;

c = c.replace(/const PLUGIN_NAME_ZH[\s\S]*?Plugin uninstalled[\s\S]*?;\n/, good + "\n");
fs.writeFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", c, "utf8");
console.log("Done");