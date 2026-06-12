/**
 * Jarvis Workspace Conversation Persistence
 *
 * Provides localStorage-backed persistence for Jarvis workspace messages.
 * Keyed by conversation id, supports create/read/delete/list operations.
 * Does not modify existing conversation infrastructure.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    status: "pending" | "running" | "completed" | "failed";
    result?: unknown;
    durationMs?: number;
  }>;
  streaming?: boolean;
  agentStatus?: "idle" | "thinking" | "acting" | "streaming" | "completed" | "error";
};

type JarvisConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  modeId: string | null;
  providerId: string | null;
};

type JarvisConversationSummary = Pick<
  JarvisConversation,
  "id" | "title" | "createdAt" | "updatedAt" | "modeId" | "providerId"
> & { messageCount: number };

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "jarvis/conversations";
const CONV_INDEX_KEY = "jarvis/conversation-index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const readJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

const convKey = (id: string) => `${STORAGE_PREFIX}/${id}`;

// ---------------------------------------------------------------------------
// Persistence API
// ---------------------------------------------------------------------------

/** Save (create or update) a conversation. */
const saveConversation = (conv: JarvisConversation): void => {
  const now = Date.now();
  const toSave: JarvisConversation = {
    ...conv,
    updatedAt: now,
    createdAt: conv.createdAt || now,
  };
  writeJson(convKey(conv.id), toSave);

  // Update index
  const index = readJson<JarvisConversationSummary[]>(CONV_INDEX_KEY) ?? [];
  const existing = index.findIndex((c) => c.id === conv.id);
  const summary: JarvisConversationSummary = {
    id: toSave.id,
    title: toSave.title,
    createdAt: toSave.createdAt,
    updatedAt: toSave.updatedAt,
    modeId: toSave.modeId,
    providerId: toSave.providerId,
    messageCount: toSave.messages.length,
  };
  if (existing >= 0) {
    index[existing] = summary;
  } else {
    index.unshift(summary);
  }
  writeJson(CONV_INDEX_KEY, index);
};

/** Load a single conversation by id. */
const loadConversation = (id: string): JarvisConversation | null => {
  return readJson<JarvisConversation>(convKey(id));
};

/** Delete a conversation by id. */
const deleteConversation = (id: string): void => {
  localStorage.removeItem(convKey(id));
  const index = readJson<JarvisConversationSummary[]>(CONV_INDEX_KEY) ?? [];
  writeJson(
    CONV_INDEX_KEY,
    index.filter((c) => c.id !== id)
  );
};

/** List all saved conversation summaries (most recent first). */
const listConversations = (): JarvisConversationSummary[] => {
  return readJson<JarvisConversationSummary[]>(CONV_INDEX_KEY) ?? [];
};

/** Generate a unique conversation id. */
const generateConversationId = (): string => {
  return `jarvis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export {
  saveConversation,
  loadConversation,
  deleteConversation,
  listConversations,
  generateConversationId,
};
export type { JarvisConversation, JarvisConversationSummary, ChatMessage };
