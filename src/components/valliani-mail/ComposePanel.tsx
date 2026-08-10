"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
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

export function splitRecipientList(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .flatMap((seg) => {
      const t = seg.trim();
      if (!t) return [];
      // Keep "Name <a@b.com>" as one recipient
      if (/<[^>]+@[^>]+>/.test(t)) return [t];
      // Bare emails separated by spaces → multiple
      if (/^\S+@\S+(?:\s+\S+@\S+)+$/.test(t)) {
        return t.split(/\s+/).filter(Boolean);
      }
      return [t];
    });
}

function joinRecipients(list: string[]): string {
  return list.join(", ");
}

function addRecipients(current: string, incoming: string): string {
  const existing = splitRecipientList(current);
  const next = [...existing];
  for (const addr of splitRecipientList(incoming)) {
    const key = addr.toLowerCase();
    if (!next.some((x) => x.toLowerCase() === key)) next.push(addr);
  }
  return joinRecipients(next);
}

export function ComposePanel({
  draft,
  onChange,
  onClose,
  onSend,
  onAiDraft,
  onRewrite,
  busy,
  drafting,
  error,
}: {
  draft: ComposeDraft;
  onChange: (next: ComposeDraft) => void;
  onClose: () => void;
  onSend: () => void;
  onAiDraft?: () => void;
  onRewrite?: (tone: AiRewriteTone) => void;
  busy?: boolean;
  drafting?: boolean;
  error?: string;
}) {
  const [showCc, setShowCc] = useState(!!draft.cc.trim() || !!draft.bcc.trim());
  const [toQuery, setToQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const attachments = draft.attachments ?? [];
  const plainBody = htmlToPlain(draft.body);
  const isNewMail = draft.mode === "new" || draft.mode === "forward" || !draft.mode;
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

  useEffect(() => {
    setShowCc(!!draft.cc.trim() || !!draft.bcc.trim());
  }, [draft.mode, draft.replyToUid, draft.cc, draft.bcc]);

  useEffect(() => {
    const q = toQuery.trim();
    if (q.length < 2 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      void getContactSuggestions(q)
        .then((list) => {
          const lower = q.toLowerCase();
          const already = new Set(
            splitRecipientList(draft.to).map((s) => s.toLowerCase())
          );
          setSuggestions(
            list.filter((s) => {
              const email =
                s.match(/<([^>]+)>/)?.[1]?.toLowerCase() ?? s.toLowerCase();
              return (
                email !== lower &&
                !already.has(email) &&
                !already.has(s.toLowerCase()) &&
                !s.toLowerCase().includes(`<${lower}>`)
              );
            })
          );
        })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [toQuery, draft.to]);

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
          <RecipientField
            label="To"
            value={draft.to}
            onChange={(to) => onChange({ ...draft, to })}
            query={toQuery}
            onQueryChange={setToQuery}
            placeholder="Add recipients…"
            trailing={
              !showCc ? (
                <button
                  type="button"
                  className="text-xs text-sky-300 hover:underline shrink-0"
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ ...draft, to: addRecipients(draft.to, s) });
                    setToQuery("");
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
              <RecipientField
                label="Cc"
                value={draft.cc}
                onChange={(cc) => onChange({ ...draft, cc })}
                placeholder="Add Cc…"
              />
              <RecipientField
                label="Bcc"
                value={draft.bcc}
                onChange={(bcc) => onChange({ ...draft, bcc })}
                placeholder="Add Bcc…"
              />
            </>
          ) : null}
          <Field
            label="Subject"
            value={draft.subject}
            onChange={(subject) => onChange({ ...draft, subject })}
          />
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 focus-within:ring-sky-400/50 px-3 py-3">
            <ComposeBodyEditor
              key={`${draft.mode ?? "new"}-${draft.replyToUid ?? 0}-${draft.subject}`}
              value={draft.body}
              onChange={(body) => onChange({ ...draft, body })}
              placeholder="Write your message…"
              minHeightClass="min-h-[180px]"
            />
          </div>
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
          {error || attachError || sendBlockReason ? (
            <div className="rounded-xl bg-rose-500/15 ring-1 ring-rose-400/30 px-3 py-2 text-sm text-rose-100">
              {error || attachError || sendBlockReason}
            </div>
          ) : null}
          {onAiDraft && onRewrite ? (
            <ComposeAiBar
              isNewMail={isNewMail}
              hasBody={!!plainBody}
              drafting={drafting}
              onAiDraft={onAiDraft}
              onRewrite={onRewrite}
            />
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-white/10">
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
                  attaching ||
                  attachments.length >= MAX_COMPOSE_ATTACHMENTS
                }
                onClick={() => fileRef.current?.click()}
                className="p-1.5 rounded-lg text-sky-300/90 hover:bg-white/10 disabled:opacity-35"
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
          <Button variant="ghost" onClick={onClose} disabled={busy || drafting}>
            Cancel
          </Button>
          <Button onClick={onSend} disabled={busy || drafting || !canSend}>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
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
    </div>
  );
}

/** Chip-style multi-recipient input (Enter / Tab / comma / semicolon commits). */
export function RecipientField({
  label,
  value,
  onChange,
  placeholder,
  trailing,
  query: controlledQuery,
  onQueryChange,
  compact,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  trailing?: React.ReactNode;
  query?: string;
  onQueryChange?: (q: string) => void;
  compact?: boolean;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const query = controlledQuery ?? localQuery;
  const setQuery = onQueryChange ?? setLocalQuery;
  const chips = splitRecipientList(value);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const next = addRecipients(value, raw);
    if (next !== value) onChange(next);
    setQuery("");
  }

  function removeAt(index: number) {
    onChange(joinRecipients(chips.filter((_, i) => i !== index)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Tab" || e.key === "," || e.key === ";") {
      if (query.trim()) {
        e.preventDefault();
        commit(query);
      }
      return;
    }
    if (e.key === "Backspace" && !query && chips.length) {
      e.preventDefault();
      removeAt(chips.length - 1);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text || !/[,;\n]/.test(text)) return;
    e.preventDefault();
    commit(`${query}${query && !/[,;]\s*$/.test(query) ? ", " : ""}${text}`);
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b border-white/[0.06] py-1.5",
        compact && "border-0 py-0"
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {label ? (
        <span className="text-xs text-white/40 w-14 shrink-0 pt-1.5">{label}</span>
      ) : null}
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
        {chips.map((addr, i) => (
          <span
            key={`${addr}-${i}`}
            className="inline-flex items-center gap-1 max-w-full rounded-full bg-sky-500/15 ring-1 ring-sky-400/25 pl-2.5 pr-1 py-0.5 text-[12px] text-sky-100"
          >
            <span className="truncate max-w-[14rem]" title={addr}>
              {addr}
            </span>
            <button
              type="button"
              className="p-0.5 rounded-full text-sky-200/60 hover:bg-white/10 hover:text-white"
              aria-label={`Remove ${addr}`}
              onClick={(ev) => {
                ev.stopPropagation();
                removeAt(i);
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => {
            if (query.trim()) commit(query);
          }}
          placeholder={chips.length ? "" : placeholder}
          className={cn(
            "flex-1 min-w-[8rem] bg-transparent text-sm text-white outline-none placeholder:text-white/30",
            compact && "text-[13px] text-white/85 min-w-[6rem]"
          )}
          aria-label={label || "Recipients"}
        />
      </div>
      {trailing}
    </div>
  );
}
