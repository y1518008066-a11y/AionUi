/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Marketplace — Marketplace Abstraction
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type {
  MarketplaceEntry,
  MarketplaceSource,
  MarketplaceQuery,
  PluginManifest,
} from './types';
import { loadManifest } from '../plugin-runtime/manifest';

// ---------------------------------------------------------------------------
// Marketplace Backend Interface
// ---------------------------------------------------------------------------

interface MarketplaceBackend {
  readonly source: MarketplaceSource;
  fetchEntries(): Promise<MarketplaceEntry[]>;
  refresh(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local JSON backend
// ---------------------------------------------------------------------------

class LocalJsonBackend implements MarketplaceBackend {
  readonly source: MarketplaceSource;
  private _entries: MarketplaceEntry[] | null = null;

  constructor(filePath: string) {
    this.source = {
      type: 'local-json',
      uri: filePath,
      name: 'Local JSON Index',
    };
  }

  async refresh(): Promise<void> {
    this._entries = null;
    await this.fetchEntries();
  }

  async fetchEntries(): Promise<MarketplaceEntry[]> {
    if (this._entries) return this._entries;

    const filePath = this.source.uri;
    if (!existsSync(filePath)) {
      console.warn('[Marketplace] Local JSON index not found: ' + filePath);
      this._entries = [];
      return [];
    }

    try {
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      const rawEntries: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : data.entries || data.plugins || [];
      const result: MarketplaceEntry[] = rawEntries.map((e) => this.normalizeEntry(e));
      this._entries = result;
      console.log('[Marketplace] Loaded ' + result.length + ' entries from local JSON.');
      return result;
    } catch (err) {
      console.error('[Marketplace] Failed to load local JSON index:', err);
      this._entries = [];
      return [];
    }
  }

  private normalizeEntry(raw: Record<string, unknown>): MarketplaceEntry {
    return {
      id: String(raw.id || ''),
      name: String(raw.name || ''),
      version: String(raw.version || '0.0.0'),
      author: String(raw.author || 'unknown'),
      description: String(raw.description || ''),
      homepage: raw.homepage ? String(raw.homepage) : undefined,
      repository: raw.repository ? String(raw.repository) : undefined,
      license: raw.license ? String(raw.license) : undefined,
      icon: raw.icon ? String(raw.icon) : undefined,
      capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
      permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
      dependencies: Array.isArray(raw.dependencies) ? raw.dependencies : [],
      minimumJarvisVersion: String(raw.minimumJarvisVersion || '2.0.0'),
      compatibleModes: Array.isArray(raw.compatibleModes) ? raw.compatibleModes : undefined,
      downloadUrl: String(raw.downloadUrl || raw.url || ''),
      checksum: String(raw.checksum || ''),
      sizeBytes: typeof raw.sizeBytes === 'number' ? raw.sizeBytes : 0,
      publishedAt: String(raw.publishedAt || new Date().toISOString()),
      downloads: typeof raw.downloads === 'number' ? raw.downloads : 0,
      rating: typeof raw.rating === 'number' ? raw.rating : undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// Local Directory backend
// ---------------------------------------------------------------------------

class LocalDirectoryBackend implements MarketplaceBackend {
  readonly source: MarketplaceSource;
  private _entries: MarketplaceEntry[] | null = null;

  constructor(dirPath: string) {
    this.source = {
      type: 'local-directory',
      uri: dirPath,
      name: 'Local Plugins Directory',
    };
  }

  async refresh(): Promise<void> {
    this._entries = null;
    await this.fetchEntries();
  }

  async fetchEntries(): Promise<MarketplaceEntry[]> {
    if (this._entries) return this._entries;

    const dirPath = this.source.uri;
    if (!existsSync(dirPath)) {
      console.warn('[Marketplace] Local directory not found: ' + dirPath);
      this._entries = [];
      return [];
    }

    const entryList: MarketplaceEntry[] = [];
    const subdirs = readdirSync(dirPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const dirName of subdirs) {
      const pluginDir = join(dirPath, dirName);
      const manifestResult = loadManifest(pluginDir);

      if (manifestResult && manifestResult.validation.valid) {
        const m = manifestResult.manifest as PluginManifest;
        entryList.push({
          id: m.id,
          name: m.name,
          version: m.version,
          author: m.author,
          description: m.description,
          homepage: m.homepage,
          repository: m.repository,
          license: m.license,
          icon: m.icon,
          capabilities: m.capabilities as MarketplaceEntry['capabilities'],
          permissions: m.permissions as MarketplaceEntry['permissions'],
          dependencies: m.dependencies,
          minimumJarvisVersion: m.minimumJarvisVersion,
          compatibleModes: m.compatibleModes,
          downloadUrl: '',
          checksum: '',
          sizeBytes: 0,
          publishedAt: new Date().toISOString(),
          downloads: 0,
        });
      }
    }

    this._entries = entryList;
    console.log('[Marketplace] Scanned ' + entryList.length + ' valid plugins from local directory.');
    return entryList;
  }
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

class Marketplace {
  private backends: MarketplaceBackend[] = [];
  private entriesCache: MarketplaceEntry[] | null = null;

  addBackend(backend: MarketplaceBackend): void {
    this.backends.push(backend);
    this.entriesCache = null;
    console.log('[Marketplace] Added backend: ' + backend.source.type + ' (' + backend.source.name + ')');
  }

  async fetchAll(): Promise<MarketplaceEntry[]> {
    if (this.entriesCache) return this.entriesCache;

    const allEntries: MarketplaceEntry[] = [];
    const seen = new Set<string>();

    for (const backend of this.backends) {
      const entries = await backend.fetchEntries();
      for (const entry of entries) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id);
          allEntries.push(entry);
        }
      }
    }

    this.entriesCache = allEntries;
    return allEntries;
  }

  async getEntry(id: string): Promise<MarketplaceEntry | null> {
    const entries = await this.fetchAll();
    return entries.find((e) => e.id === id) || null;
  }

  async search(query: MarketplaceQuery = {}): Promise<MarketplaceEntry[]> {
    let entries = await this.fetchAll();

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
        query.capabilities!.some((c) => e.capabilities.includes(c))
      );
    }

    if (query.author) {
      const a = query.author.toLowerCase();
      entries = entries.filter((e) => e.author.toLowerCase().includes(a));
    }

    const sortBy = query.sortBy || 'name';
    const sortDir = query.sortDir || 'asc';
    entries.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'version': cmp = a.version.localeCompare(b.version); break;
        case 'downloads': cmp = a.downloads - b.downloads; break;
        case 'publishedAt': cmp = a.publishedAt.localeCompare(b.publishedAt); break;
        case 'rating': cmp = (a.rating || 0) - (b.rating || 0); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    const offset = query.offset || 0;
    const limit = query.limit || 50;
    return entries.slice(offset, offset + limit);
  }

  listBackends(): MarketplaceSource[] {
    return this.backends.map((b) => b.source);
  }

  async refresh(): Promise<void> {
    this.entriesCache = null;
    for (const backend of this.backends) {
      await backend.refresh();
    }
  }

  async size(): Promise<number> {
    return (await this.fetchAll()).length;
  }

  async getDiagnostics(): Promise<{ marketplaceSize: number; sources: MarketplaceSource[] }> {
    return {
      marketplaceSize: await this.size(),
      sources: this.listBackends(),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createLocalMarketplace(pluginsDir: string): Marketplace {
  const marketplace = new Marketplace();
  marketplace.addBackend(new LocalDirectoryBackend(pluginsDir));
  return marketplace;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  Marketplace,
  LocalJsonBackend,
  LocalDirectoryBackend,
  createLocalMarketplace,
};
export type { MarketplaceBackend };