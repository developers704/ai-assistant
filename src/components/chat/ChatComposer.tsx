"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Send, Sparkles } from "lucide-react";
import { CHAT_SUGGESTIONS } from "@/components/chat/ChatWelcome";

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  voiceControl?: React.ReactNode;
}

export function ChatComposer({ onSend, disabled, voiceControl }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
      setQuickOpen(false);
    }
  };

  const pickQuick = (text: string) => {
    setQuickOpen(false);
    onSend(text);
  };

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
              className="px-3 py-1.5 rounded-full text-xs text-ink-secondary bg-white/8 ring-1 ring-white/10 hover:bg-white/12 hover:text-ink transition-colors disabled:opacity-50"
            >
              {text.length > 42 ? `${text.slice(0, 42)}…` : text}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="chat-composer-shell flex items-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-[1.35rem] px-2 py-2 sm:px-2.5 sm:py-2.5">
          <button
            type="button"
            aria-label="Quick actions"
            onClick={() => setQuickOpen((o) => !o)}
            className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:text-ink hover:bg-white/10 transition-colors"
          >
            <Plus size={20} strokeWidth={1.75} />
          </button>

          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask your assistant anything..."
            disabled={disabled}
            enterKeyHint="send"
            className="flex-1 min-w-0 min-h-[42px] sm:min-h-[44px] bg-transparent px-2 sm:px-3 text-[15px] sm:text-sm text-ink placeholder:text-ink-muted/80 focus:outline-none disabled:opacity-50"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            {voiceControl}
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              aria-label="Send message"
              className={cn(
                "flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-full transition-all duration-200",
                value.trim() && !disabled
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_4px_16px_rgba(139,92,246,0.35)] hover:from-violet-400 hover:to-fuchsia-500"
                  : "bg-white/8 text-ink-muted ring-1 ring-white/10"
              )}
            >
              <Send size={20} strokeWidth={2} />
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
            Alexa can make mistakes. Consider checking important information.
          </p>
        </div>
      </form>
    </div>
  );
}
