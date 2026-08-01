"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Send,
  Sparkles,
  X,
  RefreshCw,
  Minimize2,
  Type,
} from "lucide-react";

export type ComposeState = {
  mode: "reply" | "compose" | "followup";
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
};

export function ComposePanel({
  open,
  value,
  onChange,
  onClose,
  onSend,
  onAiDraft,
  onRewrite,
  drafting,
  sending,
  error,
}: {
  open: boolean;
  value: ComposeState;
  onChange: (next: ComposeState) => void;
  onClose: () => void;
  onSend: () => void;
  onAiDraft: () => void;
  onRewrite: (tone: "shorter" | "formal" | "casual" | "regenerate") => void;
  drafting?: boolean;
  sending?: boolean;
  error?: string | null;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (open) {
      setExpanded(true);
      const t = setTimeout(() => taRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open, value.threadId, value.mode]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "shrink-0 border-t border-violet-400/25 bg-[#0c1220]/98 backdrop-blur-md shadow-[0_-12px_40px_rgba(0,0,0,0.45)]",
        "safe-area-bottom"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-white/10">
        <p className="text-xs font-semibold text-violet-200/90 uppercase tracking-wider">
          {value.mode === "compose"
            ? "New message"
            : value.mode === "followup"
              ? "Follow-up"
              : "Reply"}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/70"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <Minimize2 size={14} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/70"
            onClick={onClose}
            aria-label="Discard"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 sm:px-4 py-3 space-y-2 max-h-[min(52vh,420px)] overflow-y-auto">
          <Field
            label="To"
            value={value.to}
            onChange={(to) => onChange({ ...value, to })}
          />
          <Field
            label="Subject"
            value={value.subject}
            onChange={(subject) => onChange({ ...value, subject })}
          />

          <textarea
            ref={taRef}
            value={value.body}
            onChange={(e) => onChange({ ...value, body: e.target.value })}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onSend();
              }
            }}
            rows={8}
            placeholder="Write your message… (⌘/Ctrl+Enter to send)"
            className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2.5 text-sm text-ink placeholder:text-white/25 focus:outline-none focus:ring-violet-400/40 resize-y min-h-[140px]"
          />

          {error ? <p className="text-xs text-rose-300">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button
              size="sm"
              disabled={sending || !value.to.trim() || !value.body.trim()}
              onClick={onSend}
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span className="ml-1">Send</span>
            </Button>

            {value.mode !== "compose" && (
              <Button
                size="sm"
                variant="outline"
                disabled={drafting}
                onClick={onAiDraft}
              >
                {drafting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span className="ml-1">AI Draft</span>
              </Button>
            )}

            {value.body.trim() && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={drafting}
                  onClick={() => onRewrite("regenerate")}
                  className="hidden sm:inline-flex"
                >
                  <RefreshCw size={13} />
                  <span className="ml-1">Regen</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={drafting}
                  onClick={() => onRewrite("shorter")}
                  className="hidden sm:inline-flex"
                >
                  <Minimize2 size={13} />
                  <span className="ml-1">Shorter</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={drafting}
                  onClick={() => onRewrite("formal")}
                  className="hidden md:inline-flex"
                >
                  <Type size={13} />
                  <span className="ml-1">Formal</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={drafting}
                  onClick={() => onRewrite("casual")}
                  className="hidden md:inline-flex"
                >
                  Casual
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-xs text-white/40 hover:text-white/70 px-2 py-1"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-black/25 ring-1 ring-white/10 px-3 py-1.5">
      <span className="text-[11px] text-white/40 w-14 shrink-0">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent text-sm text-ink focus:outline-none"
      />
    </label>
  );
}
