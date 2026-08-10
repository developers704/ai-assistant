"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { getContactSuggestions } from "@/lib/valliani-mail/api";
import type { MailAttachment } from "@/lib/valliani-mail/types";
import {
  filesToMailAttachments,
  formatAttachmentBytes,
  MAX_COMPOSE_ATTACHMENTS,
} from "@/lib/valliani-mail/attachments";

export type ComposeDraft = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  /** Hidden quoted original for replies (appended on send). */
  quote?: string;
  attachments?: MailAttachment[];
  mode?: "new" | "reply" | "replyAll" | "forward";
  replyToUid?: number;
  replyToFolder?: string;
  inReplyTo?: string;
  references?: string[];
  /** Force modal even for reply (expand from inline). */
  forceModal?: boolean;
};

export function ComposePanel({
  draft,
  onChange,
  onClose,
  onSend,
  busy,
  error,
}: {
  draft: ComposeDraft;
  onChange: (next: ComposeDraft) => void;
  onClose: () => void;
  onSend: () => void;
  busy?: boolean;
  error?: string;
}) {
  const [showCc, setShowCc] = useState(!!draft.cc.trim() || !!draft.bcc.trim());
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const attachments = draft.attachments ?? [];

  useEffect(() => {
    setShowCc(!!draft.cc.trim() || !!draft.bcc.trim());
  }, [draft.mode, draft.replyToUid, draft.cc, draft.bcc]);

  useEffect(() => {
    const q = draft.to.split(/[,;]/).pop()?.trim() ?? "";
    // Complete address already entered — don't show a duplicate chip under To
    if (q.length < 2 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      void getContactSuggestions(q)
        .then((list) => {
          const lower = q.toLowerCase();
          setSuggestions(
            list.filter((s) => {
              const email = s.match(/<([^>]+)>/)?.[1]?.toLowerCase() ?? s.toLowerCase();
              return email !== lower && !s.toLowerCase().includes(`<${lower}>`);
            })
          );
        })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [draft.to]);

  function splitList(raw: string): string[] {
    return raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4">
      <div
        className={cn(
          "w-full sm:max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden",
          "rounded-t-3xl sm:rounded-3xl bg-[#10151f] ring-1 ring-white/15 shadow-2xl"
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white flex-1">
            {draft.mode === "reply" || draft.mode === "replyAll"
              ? "Reply"
              : draft.mode === "forward"
                ? "Forward"
                : "New message"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
          <Field
            label="To"
            value={draft.to}
            onChange={(to) => onChange({ ...draft, to })}
            placeholder="recipient@valliani.app"
            trailing={
              !showCc ? (
                <button
                  type="button"
                  className="text-xs text-sky-300 hover:underline"
                  onClick={() => setShowCc(true)}
                >
                  Cc/Bcc
                </button>
              ) : null
            }
          />
          {suggestions.length > 0 ? (
            <div className="rounded-xl bg-black/40 ring-1 ring-white/10 overflow-hidden">
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="w-full text-left px-3 py-2 text-xs text-white/75 hover:bg-white/5"
                  onClick={() => {
                    const parts = splitList(draft.to);
                    parts.pop();
                    parts.push(s);
                    onChange({ ...draft, to: parts.join(", ") });
                    setSuggestions([]);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          {showCc ? (
            <>
              <Field
                label="Cc"
                value={draft.cc}
                onChange={(cc) => onChange({ ...draft, cc })}
              />
              <Field
                label="Bcc"
                value={draft.bcc}
                onChange={(bcc) => onChange({ ...draft, bcc })}
              />
            </>
          ) : null}
          <Field
            label="Subject"
            value={draft.subject}
            onChange={(subject) => onChange({ ...draft, subject })}
          />
          <textarea
            value={draft.body}
            onChange={(e) => onChange({ ...draft, body: e.target.value })}
            placeholder="Write your message…"
            rows={12}
            className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 focus:ring-sky-400/50 px-3 py-3 text-sm text-white placeholder:text-white/35 outline-none resize-y min-h-[180px]"
          />
          {attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {attachments.map((a, i) => (
                <li
                  key={`${a.filename}-${i}`}
                  className="inline-flex items-center gap-1.5 max-w-full rounded-lg bg-white/5 ring-1 ring-white/10 px-2.5 py-1.5 text-xs text-white/75"
                >
                  <Paperclip size={12} className="shrink-0 text-sky-300/80" />
                  <span className="truncate max-w-[12rem]" title={a.filename}>
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
                    onClick={() =>
                      onChange({
                        ...draft,
                        attachments: attachments.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {error || attachError ? (
            <div className="rounded-xl bg-rose-500/15 ring-1 ring-rose-400/30 px-3 py-2 text-sm text-rose-100">
              {error || attachError}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <Button
            variant="ghost"
            disabled={
              busy ||
              attaching ||
              attachments.length >= MAX_COMPOSE_ATTACHMENTS
            }
            onClick={() => fileRef.current?.click()}
          >
            {attaching ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Paperclip size={16} />
            )}
            Attach
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={onSend}
            disabled={
              busy ||
              !draft.to.trim() ||
              (!draft.body.trim() && attachments.length === 0)
            }
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-white/[0.06] py-1.5">
      <span className="text-xs text-white/40 w-14 shrink-0">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
      />
      {trailing}
    </div>
  );
}
