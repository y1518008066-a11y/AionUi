const fs = require("fs");
let c = fs.readFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx","utf8");

// Fix garbled lines by replacing with English fallback
c = c.replace(/鍔犺浇涓?/g, "Loading...");
c = c.replace(/甯傚満鏆備笉鍙/g, "Marketplace unavailable");

// Also fix the JSX syntax error on line 252
// The issue is probably a missing closing brace somewhere
// Let me check around line 250
const lines = c.split("\n");
for (let i = 248; i < Math.min(260, lines.length); i++) {
  console.log((i+1) + ": " + lines[i]);
}