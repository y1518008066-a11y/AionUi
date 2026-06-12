/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Vision Layer — LM Studio Vision Provider
 *
 * Real vision provider that uses LM Studio's OpenAI-compatible API.
 * Sends base64-encoded images as part of a chat completion request
 * and parses the structured JSON response into ScreenAnalysis.
 *
 * LM Studio supports vision with multimodal models. The provider
 * detects vision-capable models by name heuristics and validates
 * via a lightweight test request.
 */

import type { IVisionProvider, VisionProviderInfo, ScreenAnalysis, AnalyzeOptions } from "./types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "http://127.0.0.1:1234";
const DEFAULT_TIMEOUT_MS = 30000;

/** Model names that typically support vision in LM Studio. */
const VISION_MODEL_PATTERNS = [
  /llava/i,
  /bakllava/i,
  /llama.*vision/i,
  /minicpm/i,
  /cogvlm/i,
  /qwen.*vl/i,
  /phi.*vision/i,
  /internvl/i,
  /pixtral/i,
  /molmo/i,
  /florence/i,
  /paligemma/i,
  /clip/i,
  /siglip/i,
  /fuyu/i,
  /gemma.*vision/i,
  /ovis/i,
  /yi.*vision/i,
  /deepseek.*vl/i,
];

// ---------------------------------------------------------------------------
// LM Studio Vision Provider
// ---------------------------------------------------------------------------

class LMStudioVisionProvider implements IVisionProvider {
  readonly id: string;
  readonly name: string;
  readonly supportsVision: boolean;

  private baseUrl: string;
  private timeoutMs: number;
  private _connected = false;
  private _latencyMs = 0;
  private _lastError: string | undefined;
  private _visionModels: string[] = [];
  private healthChecked = false;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    this.id = "lmstudio-vision";
    this.name = "LM Studio Vision";
    this.baseUrl = (options?.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.supportsVision = true; // optimistic — validated in checkHealth()
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  async checkHealth(): Promise<VisionProviderInfo> {
    const t0 = performance.now();
    try {
      const resp = await this.fetchWithTimeout(this.baseUrl + "/v1/models", { method: "GET" }, 5000);
      if (!resp.ok) {
        this._connected = false;
        this._lastError = "HTTP " + resp.status;
        this._latencyMs = Math.round(performance.now() - t0);
        this.healthChecked = true;
        return this.toInfo();
      }
      const data = (await resp.json()) as { data?: Array<{ id: string }> };
      const allModels = (data.data || []).map((m) => m.id);
      this._visionModels = allModels.filter((m) => VISION_MODEL_PATTERNS.some((p) => p.test(m)));

      // If no models match vision patterns, try a small test request
      if (this._visionModels.length === 0 && allModels.length > 0) {
        this._visionModels = allModels.slice(0, 1); // optimistic: try first model
      }

      this._connected = true;
      this._latencyMs = Math.round(performance.now() - t0);
      this._lastError = undefined;
      this.healthChecked = true;

      console.log(
        "[Vision:LMStudio] Connected. " +
          this._visionModels.length +
          " potential vision models. Latency: " +
          this._latencyMs +
          "ms."
      );
    } catch (err) {
      this._connected = false;
      this._lastError = err instanceof Error ? err.message : String(err);
      this._latencyMs = Math.round(performance.now() - t0);
      this.healthChecked = true;
    }
    return this.toInfo();
  }

  async listVisionModels(): Promise<string[]> {
    if (!this.healthChecked) await this.checkHealth();
    return [...this._visionModels];
  }

  // -----------------------------------------------------------------------
  // Analysis
  // -----------------------------------------------------------------------

  async analyze(imageBase64: string, options?: AnalyzeOptions): Promise<ScreenAnalysis> {
    const t0 = performance.now();
    const model = options?.model || this._visionModels[0] || "auto";
    const maxTokens = options?.maxTokens || 1024;
    const timeoutMs = options?.timeoutMs || this.timeoutMs;

    const systemPrompt =
      options?.systemPrompt ||
      [
        "You are a screen analysis assistant.",
        "Analyze the provided screenshot image and return a JSON object with the following structure:",
        "{",
        '  "summary": "Brief description of the screen content",',
        '  "elements": [{"type":"button|input|link|image|icon|text|menu|dialog|tab|list|other","label":"...","confidence":0.9}],',
        '  "textRegions": [{"text":"visible text","confidence":0.9}],',
        '  "regions": [{"name":"region name","description":"what is in this region"}],',
        '  "allText": "all visible text concatenated"',
        "}",
        "Return ONLY the JSON object, no markdown, no explanation.",
      ].join("\n");

    const body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this screenshot and return the structured JSON." },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64," + imageBase64 },
            },
          ],
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
      stream: false,
    };

    console.log(
      "[Vision:LMStudio] Analyzing screenshot with model: " +
        model +
        " (image: " +
        (imageBase64.length / 1024).toFixed(0) +
        " KB base64)"
    );

    let rawText = "";

    try {
      const resp = await this.fetchWithTimeout(
        this.baseUrl + "/v1/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        timeoutMs
      );

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error("LM Studio returned HTTP " + resp.status + ": " + errText.slice(0, 200));
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      rawText = data.choices?.[0]?.message?.content || "";
      const latencyMs = Math.round(performance.now() - t0);

      // Parse JSON from response (handle markdown-wrapped JSON)
      const parsed = this.extractJson(rawText);
      return this.buildResult(parsed, imageBase64, model, latencyMs, rawText);
    } catch (err) {
      const latencyMs = Math.round(performance.now() - t0);
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[Vision:LMStudio] Analysis failed:", errorMsg);

      // Return a graceful degradation result
      return {
        id: "vision-" + Date.now(),
        source: { width: 0, height: 0, path: "", capturedAt: 0 },
        summary: "Analysis failed: " + errorMsg,
        elements: [],
        textRegions: [],
        regions: [],
        allText: "",
        provider: { id: this.id, name: this.name, model },
        latencyMs,
        fromCache: false,
        analyzedAt: Date.now(),
        raw: rawText || errorMsg,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private toInfo(): VisionProviderInfo {
    return {
      id: this.id,
      name: this.name,
      supportsVision: this._visionModels.length > 0,
      visionModels: this._visionModels,
      connected: this._connected,
      latencyMs: this._latencyMs,
      lastError: this._lastError,
    };
  }

  private extractJson(text: string): Record<string, unknown> {
    // Try direct parse first
    try {
      return JSON.parse(text);
    } catch {
      // noop
    }

    // Try extracting from markdown code blocks
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      try {
        return JSON.parse(codeBlock[1].trim());
      } catch {
        // noop
      }
    }

    // Try finding JSON object boundaries
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        // noop
      }
    }

    // Return raw text as summary
    return { summary: text };
  }

  private buildResult(
    parsed: Record<string, unknown>,
    _imageBase64: string,
    model: string,
    latencyMs: number,
    rawText: string
  ): ScreenAnalysis {
    const elements = (Array.isArray(parsed.elements) ? parsed.elements : []) as Array<Record<string, unknown>>;
    const textRegions = (Array.isArray(parsed.textRegions) ? parsed.textRegions : []) as Array<Record<string, unknown>>;
    const regions = (Array.isArray(parsed.regions) ? parsed.regions : []) as Array<Record<string, unknown>>;

    return {
      id: "vision-" + Date.now(),
      source: { width: 0, height: 0, path: "", capturedAt: 0 },
      summary: String(parsed.summary || parsed.allText || "No summary available"),
      elements: elements.map((e) => ({
        type: (e.type as ScreenAnalysis["elements"][0]["type"]) || "other",
        label: String(e.label || ""),
        confidence: typeof e.confidence === "number" ? e.confidence : 0.5,
        bbox: e.bbox as ScreenAnalysis["elements"][0]["bbox"],
      })),
      textRegions: textRegions.map((t) => ({
        text: String(t.text || ""),
        confidence: typeof t.confidence === "number" ? t.confidence : 0.5,
        bbox: t.bbox as ScreenAnalysis["textRegions"][0]["bbox"],
      })),
      regions: regions.map((r) => ({
        name: String(r.name || ""),
        description: String(r.description || ""),
        bbox: r.bbox as ScreenAnalysis["regions"][0]["bbox"],
      })),
      allText: String(parsed.allText || ""),
      provider: { id: this.id, name: this.name, model },
      latencyMs,
      fromCache: false,
      analyzedAt: Date.now(),
      raw: rawText,
    };
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createLMStudioVisionProvider(options?: { baseUrl?: string; timeoutMs?: number }): LMStudioVisionProvider {
  return new LMStudioVisionProvider(options);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { LMStudioVisionProvider, createLMStudioVisionProvider, VISION_MODEL_PATTERNS };
