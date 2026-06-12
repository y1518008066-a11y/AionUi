/**
 * Jarvis Agent Service — Production chat integration.
 *
 * Provides real-time streaming chat via direct HTTP to OpenAI-compatible APIs.
 * AgentRuntime integration is prepared but deferred until IPC bridge is available.
 *
 * Architecture:
 *   UI → JarvisAgentService.sendMessage() → fetch(/v1/chat/completions) → SSE stream → UI
 *
 * Future:
 *   UI → AgentRuntime.run() → LLMProvider → ActionEngine → Plugin → Backend
 */

import type { ChatMessage } from "./index";
import {
  saveConversation,
  loadConversation,
  listConversations,
  deleteConversation,
  generateConversationId,
} from "../../components/jarvis/workspace/jarvisPersistence";
import type { JarvisConversation } from "../../components/jarvis/workspace/jarvisPersistence";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentCallbacks = {
  onStreamChunk: (messageId: string, chunk: string) => void;
  onToolCallStart: (messageId: string, toolCall: ToolCallState) => void;
  onToolCallComplete: (messageId: string, toolCall: ToolCallState) => void;
  onStatusChange: (status: ChatMessage["agentStatus"]) => void;
  onComplete: (message: ChatMessage) => void;
  onError: (messageId: string, error: string) => void;
};

type ToolCallState = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  durationMs?: number;
};

type JarvisAgentConfig = {
  providerId: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  maxIterations: number;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: JarvisAgentConfig = {
  providerId: "lmstudio",
  model: "auto",
  baseUrl: "http://127.0.0.1:1234/v1",
  apiKey: "",
  maxIterations: 10,
  timeoutMs: 120000,
  temperature: 0.7,
  maxTokens: 4096,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class JarvisAgentService {
  private config: JarvisAgentConfig;
  private currentConversationId: string | null = null;
  private abortController: AbortController | null = null;
  private callbacks: AgentCallbacks | null = null;

  constructor(config: Partial<JarvisAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(partial: Partial<JarvisAgentConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  getConfig(): JarvisAgentConfig { return { ...this.config }; }
  setCallbacks(callbacks: AgentCallbacks): void { this.callbacks = callbacks; }

  // -----------------------------------------------------------------------
  // Conversation management
  // -----------------------------------------------------------------------

  newConversation(title?: string): string {
    const id = generateConversationId();
    this.currentConversationId = id;
    saveConversation({ id, title: title || "New conversation", messages: [], createdAt: Date.now(), updatedAt: Date.now(), modeId: null, providerId: this.config.providerId });
    return id;
  }

  loadConversation(id: string): ChatMessage[] {
    const conv = loadConversation(id);
    if (conv) { this.currentConversationId = id; return conv.messages; }
    return [];
  }

  listConversations() { return listConversations(); }
  deleteConversation(id: string): void {
    deleteConversation(id);
    if (this.currentConversationId === id) this.currentConversationId = null;
  }

  // -----------------------------------------------------------------------
  // Send message — real streaming chat
  // -----------------------------------------------------------------------

  async sendMessage(userText: string, conversationMessages: ChatMessage[], _attachments?: File[]): Promise<void> {
    const conversationId = this.currentConversationId || this.newConversation();
    this.abortController = new AbortController();
    const assistantMsgId = `msg-${Date.now()}-assistant`;
    let streamingContent = "";

    this.emitStatus("thinking");

    try {
      const llmMessages = this.buildLLMMessages(conversationMessages, userText);
      const response = await this.callLLM(llmMessages);

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${errText.substring(0, 500)}`);
      }

      if (response.body) {
        await this.processStream(response.body, (chunk, isDone) => {
          if (!isDone) { streamingContent += chunk; this.emitStream(assistantMsgId, chunk); }
        });
      } else {
        const data = await response.json();
        streamingContent = data.choices?.[0]?.message?.content || "";
        this.emitStream(assistantMsgId, streamingContent);
      }

      this.emitStatus("completed");

      const assistantMessage: ChatMessage = {
        id: assistantMsgId, role: "assistant", content: streamingContent,
        timestamp: Date.now(), agentStatus: "completed",
      };

      this.emitComplete(assistantMessage);
      this.persistConversation(conversationId, userText, assistantMessage);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[JarvisAgent] Error:", errorMsg);
      this.emitStatus("error");
      this.callbacks?.onError(assistantMsgId, errorMsg);
    } finally {
      this.abortController = null;
    }
  }

  stop(): void {
    if (this.abortController) { this.abortController.abort(); this.abortController = null; this.emitStatus("idle"); }
  }

  // -----------------------------------------------------------------------
  // Private: LLM
  // -----------------------------------------------------------------------

  private buildLLMMessages(conversationMessages: ChatMessage[], userText: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: "You are Jarvis, a helpful AI assistant. Be concise, accurate, and friendly." },
    ];
    for (const msg of conversationMessages) {
      if (msg.role === "user" || msg.role === "assistant") messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: "user", content: userText });
    return messages;
  }

  private async callLLM(messages: Array<{ role: string; content: string }>): Promise<Response> {
    const url = (this.config.baseUrl || "http://127.0.0.1:1234/v1") + "/chat/completions";
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}) },
      body: JSON.stringify({ model: this.config.model || "auto", messages, max_tokens: this.config.maxTokens, temperature: this.config.temperature, stream: true }),
      signal: this.abortController?.signal,
    });
  }

  private async processStream(body: ReadableStream<Uint8Array>, onChunk: (text: string, isDone: boolean) => void): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          if (trimmed === "data: [DONE]") { onChunk("", true); return; }
          try {
            const json = JSON.parse(trimmed.slice(6));
            const choice = json.choices?.[0];
            if (!choice) continue;
            const content = choice.delta?.content || "";
            if (content) onChunk(content, false);
            if (choice.finish_reason) { onChunk("", true); return; }
          } catch { /* skip malformed SSE */ }
        }
      }
    } finally { reader.releaseLock(); }
    onChunk("", true);
  }

  // -----------------------------------------------------------------------
  // Private: Events + Persistence
  // -----------------------------------------------------------------------

  private emitStatus(status: ChatMessage["agentStatus"]): void { this.callbacks?.onStatusChange(status); }
  private emitStream(messageId: string, chunk: string): void { this.emitStatus("streaming"); this.callbacks?.onStreamChunk(messageId, chunk); }
  private emitComplete(message: ChatMessage): void { this.callbacks?.onComplete(message); }

  private persistConversation(conversationId: string, userText: string, assistantMessage: ChatMessage): void {
    const currentConv = loadConversation(conversationId);
    if (currentConv) {
      saveConversation({
        ...currentConv,
        messages: [...currentConv.messages, { id: `msg-${Date.now()}-user`, role: "user", content: userText, timestamp: Date.now() }, assistantMessage],
        title: currentConv.title === "New conversation" ? userText.substring(0, 60) : currentConv.title,
        updatedAt: Date.now(), providerId: this.config.providerId,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _agentService: JarvisAgentService | null = null;
function getAgentService(): JarvisAgentService {
  if (!_agentService) _agentService = new JarvisAgentService();
  return _agentService;
}
function resetAgentService(): void { _agentService = null; }

export { JarvisAgentService, getAgentService, resetAgentService, DEFAULT_CONFIG };
export type { AgentCallbacks, ToolCallState, JarvisAgentConfig };
