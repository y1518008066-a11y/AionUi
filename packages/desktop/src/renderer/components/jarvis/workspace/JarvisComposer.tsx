/**
 * Jarvis Composer — Input box with attachments, screenshot, voice hooks.
 *
 * Connects screenshot to ComputerUse adapter via BackendManager.
 * File attachments work natively. Voice is a future hook.
 */

import React, { useState, useRef, useCallback } from "react";

type Props = {
  onSend: (text: string, attachments?: File[]) => Promise<void>;
  onStop?: () => void;
  isStreaming: boolean;
  /** Called when screenshot is requested. */
  onScreenshot?: () => void;
};

const S = {
  container: {
    borderTop: "1px solid var(--color-border, #e0e0e0)",
    padding: "12px 24px",
    backgroundColor: "var(--color-bg-primary, #fff)",
  },
  row: { display: "flex", gap: 8, alignItems: "flex-end" },
  input: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--color-border, #d1d5db)",
    fontSize: 14,
    fontFamily: "inherit",
    resize: "none" as const,
    minHeight: 40,
    maxHeight: 160,
    outline: "none",
    backgroundColor: "var(--color-bg-secondary, #f9fafb)",
    color: "var(--color-text-primary, #333)",
  },
  btn: (variant: "primary" | "default") => ({
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    backgroundColor: variant === "primary"
      ? "var(--color-primary, #4f46e5)"
      : "var(--color-bg-secondary, #e5e7eb)",
    color: variant === "primary"
      ? "#fff"
      : "var(--color-text-primary, #333)",
    whiteSpace: "nowrap" as const,
  }),
  iconBtn: {
    padding: "10px",
    borderRadius: 8,
    border: "1px solid var(--color-border, #d1d5db)",
    cursor: "pointer",
    backgroundColor: "var(--color-bg-secondary, #f9fafb)",
    fontSize: 16,
  },
  hint: { fontSize: 10, color: "#999", marginTop: 4, paddingLeft: 4 },
};

const JarvisComposer: React.FC<Props> = ({ onSend, onStop, isStreaming, onScreenshot }) => {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isStreaming) return;

    const currentText = text;
    const currentAttachments = [...attachments];
    setText("");
    setAttachments([]);

    try {
      await onSend(currentText, currentAttachments.length > 0 ? currentAttachments : undefined);
    } catch {
      // Error handled by workspace
    }

    textareaRef.current?.focus();
  }, [text, attachments, isStreaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttach = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => {
      if (input.files) {
        setAttachments((prev) => [...prev, ...Array.from(input.files!)]);
      }
    };
    input.click();
  };

  const handleScreenshot = () => {
    if (onScreenshot) {
      onScreenshot();
    } else {
      console.log("[JarvisComposer] Screenshot hook — no handler registered");
    }
  };

  return (
    <div style={S.container}>
      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {attachments.map((f, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 4,
                backgroundColor: "#e5e7eb",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              📎 {f.name}
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={S.row}>
        <button style={S.iconBtn} onClick={handleAttach} title="Attach files">
          📎
        </button>
        <button style={S.iconBtn} onClick={handleScreenshot} title="Screenshot">
          📷
        </button>
        <button style={{ ...S.iconBtn, opacity: 0.4 }} title="Voice (coming soon)">
          🎤
        </button>

        <textarea
          ref={textareaRef}
          style={S.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Jarvis anything... (Enter to send, Shift+Enter for new line)"
          rows={1}
        />

        {isStreaming ? (
          <button style={S.btn("default")} onClick={onStop}>
            ■ Stop
          </button>
        ) : (
          <button
            style={S.btn("primary")}
            onClick={handleSend}
            disabled={!text.trim() && attachments.length === 0}
          >
            Send
          </button>
        )}
      </div>

      <div style={S.hint}>
        Press Enter to send · Shift+Enter for new line · / for commands
      </div>
    </div>
  );
};

export default JarvisComposer;
