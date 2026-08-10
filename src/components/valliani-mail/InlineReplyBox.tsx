"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Loader2,
  Maximize2,
  Paperclip,
  Reply,
  ReplyAll,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComposeDraft } from "@/components/valliani-mail/ComposePanel";

/** Gmail / Valliani-app style inline reply under the open message. */
export function InlineReplyBox({
  draft,
  onChange,
  onSend,
  onDiscard,
  onExpand,
  busy,
  error,
}: {
  draft: ComposeDraft;
  onChange: (next: ComposeDraft) => void;
  onSend: () => void;
  onDiscard: () => void;
  onExpand?: () => void;
  busy?: boolean;
  error?: string;
}) {
  const [modeMenu, setModeMenu] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
  }, [draft.replyToUid, draft.mode]);

  const isReplyAll = draft.mode === "replyAll";

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#0d121c] px-3 sm:px-5 py-3">
      <div
        className={cn(
          "rounded-2xl bg-[#141b27] ring-1 ring-white/12 shadow-lg shadow-black/30",
          "overflow-hidden"
        )}
      >
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06]">
          <div className="relative flex items-center gap-0.5">
            <span className="text-white/55 p-1">
              {isReplyAll ? <ReplyAll size={16} /> : <Reply size={16} />}
            </span>
            <button
              type="button"
              className="p-1 rounded-md text-white/45 hover:bg-white/10 hover:text-white/80"
              aria-label="Reply mode"
              onClick={() => setModeMenu((v) => !v)}
            >
              <ChevronDown size={14} />
            </button>
            {modeMenu ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close"
                  onClick={() => setModeMenu(false)}
                />
                <div className="absolute left-0 top-full mt-1 z-20 w-36 rounded-xl bg-[#1a2230] ring-1 ring-white/12 shadow-xl py-1 overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/5"
                    onClick={() => {
                      onChange({ ...draft, mode: "reply" });
                      setModeMenu(false);
                    }}
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/5"
                    onClick={() => {
                      onChange({ ...draft, mode: "replyAll" });
                      setModeMenu(false);
                    }}
                  >
                    Reply all
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <input
            value={draft.to}
            onChange={(e) => onChange({ ...draft, to: e.target.value })}
            className="flex-1 min-w-0 bg-transparent text-[13px] text-white/85 outline-none truncate"
            placeholder="recipient@valliani.app"
            aria-label="To"
          />
          {onExpand ? (
            <button
              type="button"
              className="p-1.5 rounded-md text-white/40 hover:bg-white/10 hover:text-white/80"
              aria-label="Expand compose"
              onClick={onExpand}
            >
              <Maximize2 size={15} />
            </button>
          ) : null}
        </div>

        <div className="px-3 pt-2 pb-1">
          <textarea
            ref={areaRef}
            value={draft.body}
            onChange={(e) => onChange({ ...draft, body: e.target.value })}
            placeholder="Write a reply…"
            rows={5}
            className="w-full resize-none bg-transparent text-[14px] text-white/90 placeholder:text-white/35 outline-none min-h-[7rem] leading-relaxed"
          />
          {draft.quote?.trim() ? (
            <div className="pb-2">
              <button
                type="button"
                className="inline-flex items-center justify-center h-6 min-w-8 rounded-full bg-white/5 px-2 text-[11px] text-white/45 hover:bg-white/10"
                onClick={() => setShowQuote((v) => !v)}
                aria-label={showQuote ? "Hide quoted message" : "Show quoted message"}
              >
                ⋯
              </button>
              {showQuote ? (
                <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] text-white/40 border-l-2 border-white/15 pl-3">
                  {draft.quote}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mx-3 mb-2 rounded-lg bg-rose-500/15 ring-1 ring-rose-400/25 px-2.5 py-1.5 text-xs text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-1 px-2 py-2 border-t border-white/[0.06]">
          <button
            type="button"
            disabled={busy || !draft.to.trim() || !draft.body.trim()}
            onClick={onSend}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold",
              "bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500"
            )}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Send
          </button>
          <span
            className="p-2 rounded-full text-white/25"
            title="Attachments coming soon"
            aria-hidden
          >
            <Paperclip size={16} />
          </span>
          <div className="flex-1" />
          <button
            type="button"
            disabled={busy}
            onClick={onDiscard}
            className="p-2 rounded-full text-white/45 hover:bg-white/10 hover:text-white/80"
            aria-label="Discard"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
