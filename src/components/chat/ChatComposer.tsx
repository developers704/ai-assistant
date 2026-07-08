"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, Plus, Sparkles } from "lucide-react";
import { CHAT_SUGGESTIONS } from "@/components/chat/ChatWelcome";

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  voiceControl?: React.ReactNode;
}

const MAX_ROWS_PX = 168;

export function ChatComposer({ onSend, disabled, voiceControl }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_ROWS_PX)}px`;
  }, []);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    setQuickOpen(false);
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const pickQuick = (text: string) => {
    setQuickOpen(false);
    onSend(text);
  };

  const canSend = Boolean(value.trim()) && !disabled;

  return (
    <div className="px-3 sm:px-5 pt-2 pb-3 sm:pb-4 safe-area-bottom">
      {quickOpen && (
        <div className="mb-2 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
          {CHAT_SUGGESTIONS.slice(0, 4).map(({ text }) => (
            <button
              key={text}
              type="button"
              disabled={disabled}
              onClick={() => pickQuick(text)}
              className="px-3 py-1.5 rounded-full text-xs text-ink-secondary bg-white/8 ring-1 ring-white/10 hover:bg-white/12 hover:text-ink hover:ring-violet-400/30 transition-colors disabled:opacity-50"
            >
              {text.length > 42 ? `${text.slice(0, 42)}…` : text}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="chat-composer-2026 flex items-end gap-1.5 sm:gap-2 rounded-[1.5rem] px-2 py-2 sm:px-2.5 sm:py-2.5">
          <button
            type="button"
            aria-label="Quick actions"
            onClick={() => setQuickOpen((o) => !o)}
            className={cn(
              "hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
              quickOpen
                ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30 rotate-45"
                : "text-ink-muted hover:text-ink hover:bg-white/10"
            )}
          >
            <Plus size={20} strokeWidth={1.75} className="transition-transform duration-200" />
          </button>

          <textarea
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoGrow();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Alexa anything…"
            disabled={disabled}
            enterKeyHint="send"
            className="flex-1 min-w-0 resize-none bg-transparent px-2 sm:px-3 py-2.5 text-[15px] sm:text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none disabled:opacity-50 leading-relaxed max-h-[168px]"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            {voiceControl}
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                "flex h-11 w-11 sm:h-11 sm:w-11 items-center justify-center rounded-full transition-all duration-200",
                canSend
                  ? "chat-send-live text-white"
                  : "bg-white/6 text-ink-muted/60 ring-1 ring-white/10"
              )}
            >
              <ArrowUp size={20} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-between mt-2 px-1">
          <button
            type="button"
            onClick={() => setQuickOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-violet-300 transition-colors"
          >
            <Sparkles size={13} />
            Quick actions
          </button>
          <p className="text-[11px] text-ink-muted/80">
            <kbd className="px-1 py-0.5 rounded bg-white/8 ring-1 ring-white/10 text-[10px] font-sans">Enter</kbd>{" "}
            to send ·{" "}
            <kbd className="px-1 py-0.5 rounded bg-white/8 ring-1 ring-white/10 text-[10px] font-sans">Shift+Enter</kbd>{" "}
            for a new line · Alexa can make mistakes.
          </p>
        </div>
      </form>
    </div>
  );
}
