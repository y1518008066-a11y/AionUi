/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Vision Layer — Module Entry
 *
 * Public API for the vision layer.
 */

export { ScreenAnalyzer } from "./analyzer";
export { AnalysisCache } from "./cache";
export { LMStudioVisionProvider, createLMStudioVisionProvider, VISION_MODEL_PATTERNS } from "./provider";

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
} from "./types";
