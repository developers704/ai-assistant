"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage, PendingAction } from "@/types";
import { Button } from "./Button";
import { Bot, User, Check, X, Mic, MicOff, Send, Pencil } from "lucide-react";
import { useSpeech } from "@/lib/hooks/useSpeech";

interface ChatBubbleProps {
  message: ChatMessage;
  onConfirm?: () => void;
  onReject?: () => void;
  onEdit?: (updates: { preview: string; subject?: string }) => Promise<boolean> | boolean;
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    let content = line;
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');
    content = content.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    if (line.startsWith("• ") || line.startsWith("- ")) {
      content = `<span class="block pl-2">${content}</span>`;
    }
    return (
      <span
        key={i}
        className="block"
        dangerouslySetInnerHTML={{ __html: content || "&nbsp;" }}
      />
    );
  });
}

export function PendingActionCard({
  action,
  onConfirm,
  onReject,
  onEdit,
}: {
  action: PendingAction;
  onConfirm?: () => void;
  onReject?: () => void;
  onEdit?: (updates: { preview: string; subject?: string }) => Promise<boolean> | boolean;
}) {
  const isEmail = action.type === "email";
  const toName = isEmail ? String(action.payload.to_name ?? action.payload.to ?? "") : "";
  const subject = isEmail ? String(action.payload.subject ?? "") : "";
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(action.preview);
  const [draftSubject, setDraftSubject] = useState(subject);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraftBody(action.preview);
      setDraftSubject(subject);
    }
  }, [action.preview, subject, editing]);

  const startEdit = () => {
    setDraftBody(action.preview);
    setDraftSubject(subject);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!onEdit) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const ok = await onEdit({
        preview: draftBody.trim(),
        subject: draftSubject.trim() || subject,
      });
      if (ok) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-4 rounded-xl bg-amber-500/12 border border-amber-400/25 ring-1 ring-amber-400/10">
      <p className="text-sm font-medium text-amber-200 mb-2">
        {isEmail ? "Email draft — review before sending" : "Confirmation required"}
      </p>
      <p className="text-sm text-ink mb-1 font-medium">{action.title}</p>
      {isEmail && !editing && (
        <div className="text-xs text-ink-muted mb-2 space-y-0.5">
          {toName && <p>To: {toName}</p>}
          {subject && <p>Subject: {subject}</p>}
        </div>
      )}
      {isEmail && editing ? (
        <div className="space-y-2 mb-3">
          <label className="block text-xs text-ink-muted">
            Subject
            <input
              type="text"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              className="input-dark mt-1 w-full min-h-[40px] px-3 py-2 rounded-xl text-sm text-ink"
            />
          </label>
          <label className="block text-xs text-ink-muted">
            Message
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={8}
              className="input-dark mt-1 w-full px-3 py-2 rounded-xl text-sm text-ink resize-y min-h-[140px]"
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary whitespace-pre-wrap mb-3 max-h-48 overflow-y-auto rounded-lg bg-black/20 p-3 ring-1 ring-white/8">
          {action.preview}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button size="sm" onClick={() => void saveEdit()} disabled={saving || !draftBody.trim()}>
              <Check size={14} /> {saving ? "Saving…" : "Save edits"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              <X size={14} /> Cancel edit
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={onConfirm} className="bg-emerald-600 hover:bg-emerald-700">
              <Check size={14} /> {isEmail ? "Send email" : "Confirm"}
            </Button>
            {isEmail && onEdit && (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil size={14} /> Edit
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onReject}>
              <X size={14} /> Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function ChatBubble({ message, onConfirm, onReject, onEdit }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className="flex-shrink-0 mt-1">
        {isUser ? (
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center ring-1 ring-white/30">
            <User size={18} className="text-white" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-[0_2px_12px_rgba(139,92,246,0.35)]">
            <Bot size={18} className="text-white" />
          </div>
        )}
      </div>
      <div className={cn("max-w-[min(88%,36rem)] space-y-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "btn-futuristic text-white rounded-tr-md shadow-elevated"
              : "glass-panel-strong text-ink rounded-tl-md"
          )}
        >
          {renderMarkdown(message.content)}
          {!isUser && message.imageUrl && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.imageUrl}
                alt="Generated jewelry"
                className="rounded-xl max-w-full max-h-80 object-contain border border-white/20"
              />
            </div>
          )}
        </div>
        {!isUser && message.pendingAction && (
          <PendingActionCard
            action={message.pendingAction}
            onConfirm={onConfirm}
            onReject={onReject}
            onEdit={onEdit}
          />
        )}
        <p className="text-xs text-ink-muted px-1">
          {new Date(message.timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Ask your assistant anything...",
  voiceControl,
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Inline realtime voice button — keeps mobile composer aligned */
  voiceControl?: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  const { listening, supported, toggleListening } = useSpeech((text) => {
    setValue((prev) => (prev ? `${prev} ${text}` : text));
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
    }
  };

  const showDictation = supported && !voiceControl;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-3 py-3 sm:px-4 sm:py-4 safe-area-bottom"
    >
      {voiceControl}

      <div className="relative flex-1 min-w-0">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={listening ? "Listening..." : placeholder}
          disabled={disabled}
          enterKeyHint="send"
          className="w-full min-h-[44px] pl-4 pr-11 sm:pr-12 py-2.5 rounded-2xl border border-white/20 bg-white/10 text-[15px] sm:text-sm text-ink backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-violet-400/35 focus:border-violet-400/40 disabled:opacity-50 placeholder:text-ink-muted"
        />
        {showDictation && (
          <button
            type="button"
            onClick={toggleListening}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            className={cn(
              "absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
              listening
                ? "bg-accent-rose text-white animate-pulse"
                : "text-ink-muted hover:text-white hover:bg-white/10"
            )}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
      </div>

      <Button
        type="submit"
        disabled={disabled || !value.trim()}
        size="icon"
        aria-label="Send message"
        className="h-11 w-11 sm:h-auto sm:w-auto sm:px-5 rounded-2xl sm:rounded-full shrink-0"
      >
        <Send size={18} className="sm:hidden" />
        <span className="hidden sm:inline">Send</span>
      </Button>
    </form>
  );
}
