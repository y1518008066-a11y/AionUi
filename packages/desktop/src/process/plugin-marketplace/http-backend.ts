/**
 * HTTP Marketplace Backend
 *
 * Fetches plugin index from a remote HTTP endpoint.
 * Supports:
 * - Online marketplace API (https://plugins.jarvis.xxx/index.json)
 * - GitHub Releases
 * - Private registries
 * - Local HTTP servers
 *
 * Cache TTL: 5 minutes (configurable)
 */

import type { MarketplaceEntry, MarketplaceSource, MarketplaceQuery } from "./types";

// ---------------------------------------------------------------------------
// HTTP Backend
// ---------------------------------------------------------------------------

class HttpMarketplaceBackend {
  readonly source: MarketplaceSource;
  private cachedEntries: MarketplaceEntry[] | null = null;
  private cacheTime: number = 0;
  private cacheTtlMs: number;

  constructor(url: string, name = "Online Marketplace", cacheTtlMs = 5 * 60 * 1000) {
    this.source = {
      type: "http",
      uri: url,
      name,
    };
    this.cacheTtlMs = cacheTtlMs;
  }

  async refresh(): Promise<void> {
    this.cachedEntries = null;
    this.cacheTime = 0;
    await this.fetchEntries();
  }

  async fetchEntries(): Promise<MarketplaceEntry[]> {
    // Return cached if still fresh
    if (this.cachedEntries && Date.now() - this.cacheTime < this.cacheTtlMs) {
      return this.cachedEntries;
    }

    try {
      console.log("[Marketplace:HTTP] Fetching from " + this.source.uri);
      const response = await fetch(this.source.uri, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(
          "[Marketplace:HTTP] Server returned " +
            response.status +
            ": " +
            response.statusText
        );
        this.cachedEntries = [];
        this.cacheTime = Date.now();
        return [];
      }

      const data: unknown = await response.json();
      const rawEntries: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : (data as any)?.entries || (data as any)?.plugins || [];

      const entries = rawEntries.map((raw) => this.normalizeEntry(raw));
      this.cachedEntries = entries;
      this.cacheTime = Date.now();
      console.log("[Marketplace:HTTP] Loaded " + entries.length + " entries.");
      return entries;
    } catch (err) {
      console.error("[Marketplace:HTTP] Fetch failed:", err);
      // Keep stale cache if available
      return this.cachedEntries || [];
    }
  }

  async search(query: MarketplaceQuery): Promise<MarketplaceEntry[]> {
    let entries = await this.fetchEntries();

    if (query.search) {
      const q = query.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.author.toLowerCase().includes(q)
      );
    }

    if (query.capabilities && query.capabilities.length > 0) {
      entries = entries.filter((e) =>
        query.capabilities!.some((c) => e.capabilities.includes(c as any))
      );
    }

    if (query.author) {
      const a = query.author.toLowerCase();
      entries = entries.filter((e) => e.author.toLowerCase().includes(a));
    }

    return entries;
  }

  async getEntry(id: string): Promise<MarketplaceEntry | null> {
    const entries = await this.fetchEntries();
    return entries.find((e) => e.id === id) || null;
  }

  async getDiagnostics(): Promise<{
    backend: string;
    entries: number;
    lastFetch: string;
    error: string | null;
  }> {
    const entries = this.cachedEntries;
    return {
      backend: this.source.uri,
      entries: entries?.length || 0,
      lastFetch: this.cacheTime ? new Date(this.cacheTime).toISOString() : "never",
      error: entries === null ? "Failed to fetch" : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Normalize raw JSON to MarketplaceEntry
  // ---------------------------------------------------------------------------

  private normalizeEntry(raw: Record<string, unknown>): MarketplaceEntry {
    return {
      id: String(raw.id || ""),
      name: String(raw.name || ""),
      version: String(raw.version || "0.0.0"),
      author: String(raw.author || "unknown"),
      description: String(raw.description || ""),
      homepage: raw.homepage ? String(raw.homepage) : undefined,
      repository: raw.repository ? String(raw.repository) : undefined,
      license: raw.license ? String(raw.license) : undefined,
      icon: raw.icon ? String(raw.icon) : undefined,
      capabilities: Array.isArray(raw.capabilities)
        ? (raw.capabilities as MarketplaceEntry["capabilities"])
        : [],
      permissions: Array.isArray(raw.permissions)
        ? (raw.permissions as MarketplaceEntry["permissions"])
        : [],
      dependencies: Array.isArray(raw.dependencies)
        ? (raw.dependencies as string[])
        : [],
      minimumJarvisVersion: String(raw.minimumJarvisVersion || "2.0.0"),
      compatibleModes: Array.isArray(raw.compatibleModes)
        ? (raw.compatibleModes as string[])
        : undefined,
      downloadUrl: String(raw.downloadUrl || raw.url || ""),
      checksum: String(raw.checksum || raw.sha256 || ""),
      sizeBytes: typeof raw.sizeBytes === "number" ? raw.sizeBytes : 0,
      publishedAt: String(raw.publishedAt || new Date().toISOString()),
      downloads: typeof raw.downloads === "number" ? raw.downloads : 0,
      rating: typeof raw.rating === "number" ? raw.rating : undefined,
      tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
      category: raw.category ? String(raw.category) : "uncategorized",
    };
  }
}

export { HttpMarketplaceBackend };