/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Vision Layer — Type Definitions
 *
 * Defines the structured output types for screen analysis.
 * These types are provider-agnostic — any vision provider (LM Studio,
 * OpenAI, Anthropic, Gemini) should map its response into these shapes.
 */

// ---------------------------------------------------------------------------
// Screen element types
// ---------------------------------------------------------------------------

/** A bounding box on screen (pixel coordinates). */
type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** A UI element detected on screen. */
type ScreenElement = {
  /** Element type classification. */
  type: "button" | "input" | "link" | "image" | "icon" | "text" | "menu" | "dialog" | "tab" | "list" | "other";

  /** Human-readable label or text content. */
  label: string;

  /** Bounding box (may be absent if provider cannot return geometry). */
  bbox?: BoundingBox;

  /** Confidence score 0..1. */
  confidence: number;

  /** Extra metadata (aria-label, tooltip, etc.). */
  metadata?: Record<string, string>;
};

/** Extracted text region on screen. */
type TextRegion = {
  /** The recognized text. */
  text: string;

  /** Bounding box (may be absent). */
  bbox?: BoundingBox;

  /** Confidence score 0..1. */
  confidence: number;
};

/** A visual region description (e.g. "top-left toolbar"). */
type VisualRegion = {
  /** Human-readable region name. */
  name: string;

  /** Natural language description of what's in this region. */
  description: string;

  /** Approximate bounding box (may be absent). */
  bbox?: BoundingBox;
};

// ---------------------------------------------------------------------------
// Analysis result types
// ---------------------------------------------------------------------------

/** Structured result of a screen analysis. */
type ScreenAnalysis = {
  /** Unique id for this analysis. */
  id: string;

  /** Source screenshot metadata. */
  source: {
    width: number;
    height: number;
    /** Path to the screenshot file (local). */
    path: string;
    /** Timestamp when screenshot was captured. */
    capturedAt: number;
  };

  /** High-level summary of the screen. */
  summary: string;

  /** Detected UI elements. */
  elements: ScreenElement[];

  /** Extracted text regions. */
  textRegions: TextRegion[];

  /** Visual regions / layout description. */
  regions: VisualRegion[];

  /** Raw text content visible on screen (for search / indexing). */
  allText: string;

  /** Provider that performed the analysis. */
  provider: {
    id: string;
    name: string;
    model: string;
  };

  /** Latency in milliseconds. */
  latencyMs: number;

  /** Whether this analysis came from cache. */
  fromCache: boolean;

  /** Timestamp of analysis. */
  analyzedAt: number;

  /** Raw provider response (for debugging). */
  raw?: string;
};

/** A vision-capable provider descriptor. */
type VisionProviderInfo = {
  /** Provider id. */
  id: string;

  /** Display name. */
  name: string;

  /** Whether this provider currently supports vision. */
  supportsVision: boolean;

  /** Available vision models. */
  visionModels: string[];

  /** Whether the provider is currently connected / healthy. */
  connected: boolean;

  /** Last health check latency. */
  latencyMs: number;

  /** Last error (if any). */
  lastError?: string;
};

/** Options for screen analysis. */
type AnalyzeOptions = {
  /** Provider id to use (auto-detect if omitted). */
  providerId?: string;

  /** Model name to use (provider default if omitted). */
  model?: string;

  /** Custom system prompt for the vision model. */
  systemPrompt?: string;

  /** Whether to use cached result if available. */
  useCache?: boolean;

  /** Maximum cache age in milliseconds (default: 30000). */
  maxCacheAgeMs?: number;

  /** Maximum tokens for the vision model response. */
  maxTokens?: number;

  /** Timeout in milliseconds (default: 30000). */
  timeoutMs?: number;
};

/** Health status for the vision layer. */
type VisionHealth = {
  /** Whether any vision provider is available. */
  available: boolean;

  /** List of vision-capable providers. */
  providers: VisionProviderInfo[];

  /** Active provider id (null if none). */
  activeProviderId: string | null;

  /** Cache statistics. */
  cache: {
    size: number;
    hits: number;
    misses: number;
  };

  /** Last analysis timestamp. */
  lastAnalysis: number | null;

  /** Total analyses performed. */
  totalAnalyses: number;

  /** Last error (if any). */
  lastError?: string;
};

// ---------------------------------------------------------------------------
// Vision provider interface
// ---------------------------------------------------------------------------

/** Interface for a vision-capable AI provider. */
type IVisionProvider = {
  readonly id: string;
  readonly name: string;
  readonly supportsVision: boolean;

  /** Check connectivity and vision capability. */
  checkHealth(): Promise<VisionProviderInfo>;

  /** List available vision models. */
  listVisionModels(): Promise<string[]>;

  /**
   * Analyze a screenshot image.
   * @param imageBase64 - Base64-encoded PNG/JPEG image data.
   * @param options - Analysis options.
   * @returns Structured screen analysis.
   */
  analyze(imageBase64: string, options?: AnalyzeOptions): Promise<ScreenAnalysis>;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  BoundingBox,
  ScreenElement,
  TextRegion,
  VisualRegion,
  ScreenAnalysis,
  VisionProviderInfo,
  AnalyzeOptions,
  VisionHealth,
  IVisionProvider,
};
