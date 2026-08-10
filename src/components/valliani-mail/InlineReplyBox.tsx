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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RecipientField,
  type ComposeDraft,
} from "@/components/valliani-mail/ComposePanel";
import {
  ComposeBodyEditor,
  ComposeFormatToolbar,
} from "@/components/valliani-mail/ComposeBodyEditor";
import { ComposeAiBar } from "@/components/valliani-mail/ComposeAiBar";
import {
  htmlToPlain,
  isComposeBodyEmpty,
} from "@/lib/valliani-mail/compose-html";
import { bodyMentionsAttachment } from "@/lib/email-utils";
import type { AiRewriteTone } from "@/lib/valliani-mail/ai-draft";
import {
  filesToMailAttachments,
  formatAttachmentBytes,
  MAX_COMPOSE_ATTACHMENTS,
} from "@/lib/valliani-mail/attachments";

/** Gmail / Valliani-app style inline reply under the open message. */
export function InlineReplyBox({
  draft,
  onChange,
  onSend,
  onDiscard,
  onExpand,
  onAiDraft,
  onRewrite,
  busy,
  drafting,
  error,
}: {
  draft: ComposeDraft;
  onChange: (next: ComposeDraft) => void;
  onSend: () => void;
  onDiscard: () => void;
  onExpand?: () => void;
  onAiDraft?: () => void;
  onRewrite?: (tone: AiRewriteTone) => void;
  busy?: boolean;
  drafting?: boolean;
  error?: string;
}) {
  const [modeMenu, setModeMenu] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState("");
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = editorWrapRef.current?.querySelector(
      ".compose-body-editor"
    ) as HTMLElement | null;
    el?.focus();
  }, [draft.replyToUid, draft.mode]);

  const isReplyAll = draft.mode === "replyAll";
  const attachments = draft.attachments ?? [];
  const plainBody = htmlToPlain(draft.body);
  const missingSubject = !draft.subject.trim();
  const missingAttachment =
    attachments.length === 0 && bodyMentionsAttachment(plainBody);
  const canSend =
    !!draft.to.trim() &&
    !missingSubject &&
    !missingAttachment &&
    (!isComposeBodyEmpty(draft.body) || attachments.length > 0);
  const sendBlockReason = missingSubject
    ? "Add a subject before sending."
    : missingAttachment
      ? "You mentioned an attachment — attach a file before sending."
      : null;

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setAttaching(true);
    setAttachError("");
    try {
      const result = await filesToMailAttachments(files, attachments);
      onChange({ ...draft, attachments: result.attachments });
      if (result.error) setAttachError(result.error);
    } catch {
      setAttachError("Couldn’t add attachment");
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAttachment(index: number) {
    onChange({
      ...draft,
      attachments: attachments.filter((_, i) => i !== index),
    });
  }

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
          <div className="flex-1 min-w-0">
            <RecipientField
              value={draft.to}
              onChange={(to) => onChange({ ...draft, to })}
              placeholder="Add recipients…"
              compact
            />
          </div>
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

        <div className="px-3 pt-2 pb-1" ref={editorWrapRef}>
          <ComposeBodyEditor
            key={`inline-${draft.replyToUid ?? 0}-${draft.mode}`}
            value={draft.body}
            onChange={(body) => onChange({ ...draft, body })}
            placeholder="Write a reply…"
            minHeightClass="min-h-[7rem]"
          />
          {attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 pb-2">
              {attachments.map((a, i) => (
                <li
                  key={`${a.filename}-${i}`}
                  className="inline-flex items-center gap-1.5 max-w-full rounded-lg bg-white/5 ring-1 ring-white/10 px-2 py-1 text-[11px] text-white/75"
                >
                  <Paperclip size={11} className="shrink-0 text-sky-300/80" />
                  <span className="truncate max-w-[10rem]" title={a.filename}>
                    {a.filename}
                  </span>
                  {a.size != null ? (
                    <span className="text-white/35 shrink-0">
                      {formatAttachmentBytes(a.size)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="p-0.5 rounded text-white/40 hover:text-white/80"
                    aria-label={`Remove ${a.filename}`}
                    onClick={() => removeAttachment(i)}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {draft.quote?.trim() ? (
            <div className="pb-2">
              <button
                type="button"
                className="inline-flex items-center justify-center h-6 min-w-8 rounded-full bg-white/5 px-2 text-[11px] text-white/45 hover:bg-white/10"
                onClick={() => setShowQuote((v) => !v)}
                aria-label={
                  showQuote ? "Hide quoted message" : "Show quoted message"
                }
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

        {error || attachError || sendBlockReason ? (
          <div className="mx-3 mb-2 rounded-lg bg-rose-500/15 ring-1 ring-rose-400/25 px-2.5 py-1.5 text-xs text-rose-100">
            {error || attachError || sendBlockReason}
          </div>
        ) : null}

        {onAiDraft && onRewrite ? (
          <div className="px-3 pb-2">
            <ComposeAiBar
              isNewMail={false}
              hasBody={!!plainBody}
              drafting={drafting}
              onAiDraft={onAiDraft}
              onRewrite={onRewrite}
              compact
            />
          </div>
        ) : null}

        <div className="flex items-center gap-1 px-2 py-2 border-t border-white/[0.06]">
          <button
            type="button"
            disabled={busy || drafting || !canSend}
            onClick={onSend}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold",
              "bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500"
            )}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Send
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <ComposeFormatToolbar
            leading={
              <button
                type="button"
                disabled={
                  busy ||
                  drafting ||
                  attaching ||
                  attachments.length >= MAX_COMPOSE_ATTACHMENTS
                }
                onClick={() => fileRef.current?.click()}
                className="p-1.5 rounded-lg text-sky-300/90 hover:bg-white/10 hover:text-sky-200 disabled:opacity-35"
                aria-label="Attach files"
                title="Attach files"
              >
                {attaching ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Paperclip size={15} />
                )}
              </button>
            }
          />
          <div className="flex-1" />
          <button
            type="button"
            disabled={busy || drafting}
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
