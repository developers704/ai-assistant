"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { AiRewriteTone } from "@/lib/valliani-mail/ai-draft";

export function ComposeAiBar({
  isNewMail,
  hasBody,
  drafting,
  onAiDraft,
  onRewrite,
  compact,
}: {
  isNewMail: boolean;
  hasBody: boolean;
  drafting?: boolean;
  onAiDraft: () => void;
  onRewrite: (tone: AiRewriteTone) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-2"}`}>
      <button
        type="button"
        disabled={drafting || (isNewMail && !hasBody)}
        onClick={onAiDraft}
        title={
          isNewMail && !hasBody
            ? "Write a rough message first"
            : isNewMail
              ? "Paraphrase into a professional email"
              : "Generate AI reply"
        }
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#5b4a8a]/45 ring-1 ring-[#5b4a8a]/50 text-[12px] font-medium text-violet-100 hover:bg-[#5b4a8a]/60 disabled:opacity-50"
      >
        {drafting ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Sparkles size={13} />
        )}
        {isNewMail
          ? hasBody
            ? "AI Draft · make professional"
            : "AI Draft"
          : hasBody
            ? "Regen AI draft"
            : "AI Draft"}
      </button>
      {hasBody ? (
        <>
          <ToneBtn
            label="Shorter"
            disabled={!!drafting}
            onClick={() => onRewrite("shorter")}
          />
          <ToneBtn
            label="Formal"
            disabled={!!drafting}
            onClick={() => onRewrite("formal")}
          />
          <ToneBtn
            label="Casual"
            disabled={!!drafting}
            onClick={() => onRewrite("casual")}
          />
        </>
      ) : null}
    </div>
  );
}

function ToneBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 px-2.5 rounded-full bg-white/[0.06] ring-1 ring-white/10 text-[11px] text-white/60 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
