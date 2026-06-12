/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Vision Layer — Analysis Cache
 *
 * Caches recent ScreenAnalysis results keyed by screenshot path hash.
 * Prevents redundant analysis of the same screenshot within a TTL window.
 */

import type { ScreenAnalysis } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CacheEntry = {
  analysis: ScreenAnalysis;
  storedAt: number;
};

type CacheStats = {
  size: number;
  hits: number;
  misses: number;
};

// ---------------------------------------------------------------------------
// AnalysisCache
// ---------------------------------------------------------------------------

class AnalysisCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly _maxSize: number;
  private readonly _defaultTtlMs: number;
  private _hits = 0;
  private _misses = 0;

  constructor(maxSize = 50, defaultTtlMs = 30000) {
    this._maxSize = maxSize;
    this._defaultTtlMs = defaultTtlMs;
  }

  /**
   * Get a cached analysis by key.
   * Returns null if not found or expired.
   */
  get(key: string, maxAgeMs?: number): ScreenAnalysis | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }

    const ttl = maxAgeMs ?? this._defaultTtlMs;
    if (Date.now() - entry.storedAt > ttl) {
      this.cache.delete(key);
      this._misses++;
      return null;
    }

    this._hits++;
    return { ...entry.analysis, fromCache: true };
  }

  /**
   * Store an analysis result.
   */
  set(key: string, analysis: ScreenAnalysis): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this._maxSize) {
      const oldest = this.findOldestKey();
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(key, { analysis, storedAt: Date.now() });
  }

  /**
   * Build a cache key from a screenshot path and provider/model.
   */
  static buildKey(screenshotPath: string, providerId: string, model: string): string {
    return providerId + "::" + model + "::" + screenshotPath;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return { size: this.cache.size, hits: this._hits, misses: this._misses };
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /** Number of cached entries. */
  get size(): number {
    return this.cache.size;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private findOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.storedAt < oldestTime) {
        oldestTime = entry.storedAt;
        oldestKey = key;
      }
    }
    return oldestKey;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { AnalysisCache };
export type { CacheStats, CacheEntry };
