/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Vision Layer — Screen Analyzer
 *
 * Main pipeline for screen analysis. Orchestrates:
 * 1. Screenshot acquisition (delegated to caller)
 * 2. Provider selection
 * 3. Cache check
 * 4. Vision provider analysis
 * 5. Cache update
 * 6. Result return
 *
 * Gracefully degrades when no vision provider is available.
 */

import { readFileSync } from "fs";
import type { ScreenAnalysis, AnalyzeOptions, VisionHealth, VisionProviderInfo, IVisionProvider } from "./types";
import { AnalysisCache } from "./cache";
import { LMStudioVisionProvider } from "./provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Provider factory function. */
type VisionProviderFactory = () => IVisionProvider;

// ---------------------------------------------------------------------------
// ScreenAnalyzer
// ---------------------------------------------------------------------------

class ScreenAnalyzer {
  private readonly providers = new Map<string, IVisionProvider>();
  private readonly providerFactories = new Map<string, VisionProviderFactory>();
  private readonly cache = new AnalysisCache(50, 30000);
  private activeProviderId: string | null = null;
  private lastAnalysis: ScreenAnalysis | null = null;
  private totalAnalyses = 0;
  private lastError: string | undefined;

  constructor() {
    // Register LM Studio vision provider by default
    this.registerFactory("lmstudio-vision", () => new LMStudioVisionProvider());
  }

  // -----------------------------------------------------------------------
  // Provider management
  // -----------------------------------------------------------------------

  /**
   * Register a vision provider factory.
   * The provider is lazily instantiated on first use.
   */
  registerFactory(id: string, factory: VisionProviderFactory): void {
    this.providerFactories.set(id, factory);
  }

  /**
   * Register a pre-instantiated vision provider.
   */
  registerProvider(provider: IVisionProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Set the active provider by id.
   */
  setActiveProvider(providerId: string): void {
    this.activeProviderId = providerId;
    console.log("[Vision] Active provider set to: " + providerId);
  }

  /**
   * Get or lazily instantiate a provider.
   */
  private getProvider(providerId?: string): IVisionProvider | null {
    const id = providerId || this.activeProviderId;

    if (id) {
      // Check pre-instantiated
      const existing = this.providers.get(id);
      if (existing) return existing;

      // Try factory
      const factory = this.providerFactories.get(id);
      if (factory) {
        const instance = factory();
        this.providers.set(id, instance);
        this.activeProviderId = id;
        return instance;
      }
    }

    // Fall back to any factory
    for (const [fid, factory] of this.providerFactories) {
      const instance = factory();
      this.providers.set(fid, instance);
      this.activeProviderId = fid;
      return instance;
    }

    // Fall back to any pre-instantiated
    for (const provider of this.providers.values()) {
      this.activeProviderId = provider.id;
      return provider;
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Analysis pipeline
  // -----------------------------------------------------------------------

  /**
   * Analyze a screenshot file on disk.
   *
   * @param screenshotPath - Absolute path to a PNG screenshot.
   * @param screenshotMeta - Metadata about the screenshot (width, height, capture time).
   * @param options - Analysis options.
   */
  async analyzeFile(
    screenshotPath: string,
    screenshotMeta: { width: number; height: number; capturedAt: number },
    options?: AnalyzeOptions
  ): Promise<ScreenAnalysis> {
    const useCache = options?.useCache !== false;
    const maxCacheAgeMs = options?.maxCacheAgeMs;

    // Determine provider
    const provider = this.getProvider(options?.providerId);
    const model = options?.model || "auto";

    if (!provider) {
      return this.degradedResult(screenshotMeta, "No vision provider available. Start LM Studio or configure a cloud vision provider.");
    }

    // Check cache
    if (useCache) {
      const cacheKey = AnalysisCache.buildKey(screenshotPath, provider.id, model);
      const cached = this.cache.get(cacheKey, maxCacheAgeMs);
      if (cached) {
        console.log("[Vision] Cache hit for: " + screenshotPath);
        return { ...cached, source: { ...screenshotMeta, path: screenshotPath } };
      }
    }

    // Read and encode image
    let imageBase64: string;
    try {
      const buffer = readFileSync(screenshotPath);
      imageBase64 = buffer.toString("base64");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.degradedResult(screenshotMeta, "Failed to read screenshot file: " + msg);
    }

    // Analyze
    const t0 = performance.now();
    try {
      const analysis = await provider.analyze(imageBase64, { ...options, model });
      analysis.source = { ...screenshotMeta, path: screenshotPath };
      analysis.latencyMs = Math.round(performance.now() - t0);

      // Cache
      if (useCache) {
        const cacheKey = AnalysisCache.buildKey(screenshotPath, provider.id, analysis.provider.model);
        this.cache.set(cacheKey, analysis);
      }

      this.lastAnalysis = analysis;
      this.totalAnalyses++;
      this.lastError = undefined;

      console.log(
        "[Vision] Analysis complete. Provider: " +
          analysis.provider.name +
          " / " +
          analysis.provider.model +
          " | Latency: " +
          analysis.latencyMs +
          "ms | Elements: " +
          analysis.elements.length +
          " | Text: " +
          analysis.allText.length +
          " chars"
      );

      return analysis;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      console.error("[Vision] Analysis error:", msg);
      return this.degradedResult(screenshotMeta, "Analysis failed: " + msg);
    }
  }

  /**
   * Get the most recent analysis result.
   */
  getLatestAnalysis(): ScreenAnalysis | null {
    return this.lastAnalysis;
  }

  // -----------------------------------------------------------------------
  // Health & diagnostics
  // -----------------------------------------------------------------------

  /**
   * Get comprehensive health status.
   */
  async getHealth(): Promise<VisionHealth> {
    const providerInfos: VisionProviderInfo[] = [];

    // Check all pre-instantiated providers
    for (const provider of this.providers.values()) {
      try {
        const info = await provider.checkHealth();
        providerInfos.push(info);
      } catch {
        providerInfos.push({
          id: provider.id,
          name: provider.name,
          supportsVision: false,
          visionModels: [],
          connected: false,
          latencyMs: 0,
          lastError: "Health check threw an exception",
        });
      }
    }

    // Check factory providers (lazy instantiate to check)
    for (const [fid, factory] of this.providerFactories) {
      if (this.providers.has(fid)) continue; // already checked
      try {
        const provider = factory();
        this.providers.set(fid, provider);
        const info = await provider.checkHealth();
        providerInfos.push(info);
      } catch {
        providerInfos.push({
          id: fid,
          name: fid,
          supportsVision: false,
          visionModels: [],
          connected: false,
          latencyMs: 0,
          lastError: "Health check threw an exception",
        });
      }
    }

    const cacheStats = this.cache.getStats();

    return {
      available: providerInfos.some((p) => p.connected && p.supportsVision),
      providers: providerInfos,
      activeProviderId: this.activeProviderId,
      cache: cacheStats,
      lastAnalysis: this.lastAnalysis?.analyzedAt || null,
      totalAnalyses: this.totalAnalyses,
      lastError: this.lastError,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private degradedResult(
    meta: { width: number; height: number; capturedAt: number },
    message: string
  ): ScreenAnalysis {
    return {
      id: "vision-degraded-" + Date.now(),
      source: { ...meta, path: "" },
      summary: message,
      elements: [],
      textRegions: [],
      regions: [],
      allText: "",
      provider: { id: "none", name: "None", model: "none" },
      latencyMs: 0,
      fromCache: false,
      analyzedAt: Date.now(),
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ScreenAnalyzer };
