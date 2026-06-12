const fs = require("fs");
let c = fs.readFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx","utf8");

// Add marketplace state + fetch
c = c.replace(
  "const [consentModal, setConsentModal]",
  `const [marketplace, setMarketplace] = useState<PluginInfo[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [consentModal, setConsentModal]`
);

c = c.replace(
  ">({ visible: false, plugin: null });",
  `>({ visible: false, plugin: null });

  useEffect(() => {
    setMarketLoading(true);
    const url = "https://y1518008066-a11y.github.io/AionUi/marketplace/index.json";
    fetch(url)
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => { setMarketplace(Array.isArray(data) ? data : (data.entries || data.plugins || [])); setMarketLoading(false); })
      .catch(() => { setMarketError("离线"); setMarketLoading(false); });
  }, []);`
);

// Update consent modal onOk
c = c.replace(
  "onOk={() => { setConsentModal({ visible: false, plugin: null }); }}",
  `onOk={() => {
      const plugin = consentModal.plugin;
      if (plugin) {
        setPlugins(prev => [...prev, { ...plugin, installed: true, enabled: true }]);
        Message.success(zh("Plugin installed"));
      }
      setConsentModal({ visible: false, plugin: null });
    }}`
);

// Add marketplace section
const marketSection = `

      {/* Marketplace */}
      <div className="mt-24px">
        <h3 className="text-16px font-600 text-t-primary mb-12px flex items-center gap-8px">
          <FolderOpen theme="outline" size="18" />
          {zh("Available")}
          <Tag size="small">{marketplace.length}</Tag>
          {marketLoading && <Tag size="small" color="arcoblue">加载中...</Tag>}
          {marketError && <Tag size="small" color="red">{marketError}</Tag>}
        </h3>
        {marketplace.length === 0 && !marketLoading ? (
          <div className="text-13px text-t-tertiary py-24px text-center">
            {marketError ? "市场暂不可用，请检查网络连接。" : zh("No plugins available in marketplace.")}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12px">
            {marketplace.filter(p => !plugins.find(l => l.id === p.id)).map(plugin => {
              const capList = Array.isArray(plugin.capabilities) ? plugin.capabilities : [];
              const permList = Array.isArray(plugin.permissions) ? plugin.permissions : [];
              return (
              <div key={plugin.id} className="border border-dashed border-[var(--color-border-2)] rd-12px p-16px bg-base hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-12px">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-8px mb-6px">
                      <span className="text-16px font-600 text-t-primary truncate">{zh(plugin.name)}</span>
                      <Tag size="small" color="arcoblue">v{plugin.version}</Tag>
                      {plugin.rating && <Tag size="small" color="gold">{(Number(plugin.rating) || 0).toFixed(1)}</Tag>}
                    </div>
                    <p className="text-13px text-t-secondary mb-8px line-clamp-2">{plugin.description}</p>
                    <div className="flex items-center gap-16px text-12px text-t-tertiary mb-8px">
                      <span>{zh("Author")}: {plugin.author}</span>
                      {plugin.downloads > 0 && <span>&#8595; {plugin.downloads}</span>}
                    </div>
                    <div className="flex flex-wrap gap-4px mb-8px">
                      {capList.map(cap => (<Tag key={cap} size="small" className="!text-10px !px-4px !py-0px">{cap}</Tag>))}
                    </div>
                    <div className="flex flex-wrap gap-4px">
                      {permList.map(perm => (<code key={perm} className="text-10px bg-fill-2 text-t-secondary px-4px py-1px rd-4px">{perm}</code>))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-8px shrink-0">
                    <Button size="small" type="primary" icon={<Plus />}
                      onClick={() => setConsentModal({ visible: true, plugin })}
                      className="!w-80px">{zh("Install")}</Button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
`;

c = c.replace("      </div>\n    </SettingsPageWrapper>", "$&" + marketSection);
// Fix: actually let me replace cleanly
c = c.replace(
  "      </div>\n    </SettingsPageWrapper>",
  "      </div>" + marketSection + "\n    </SettingsPageWrapper>"
);

fs.writeFileSync("packages/desktop/src/renderer/pages/settings/PluginMarketplace.tsx", c, "utf8");
console.log("Done");