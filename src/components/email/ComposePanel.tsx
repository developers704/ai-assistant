"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Loader2,
  Send,
  Sparkles,
  X,
  RefreshCw,
  Minimize2,
  Type,
  Paperclip,
  FileIcon,
  ChevronLeft,
  ChevronDown,
  Forward,
  Reply,
} from "lucide-react";
import {
  filterRecipientSuggestions,
  formatRecipientChip,
  type EmailRecipientSuggestion,
} from "@/lib/email-recipients";
import { bodyMentionsAttachment } from "@/lib/email-utils";

export type ComposeAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Raw base64 (no data: URL prefix) for Gmail MIME. */
  dataBase64: string;
};

export type ComposeState = {
  mode: "reply" | "compose" | "followup" | "forward";
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  /** Gmail draft id when editing a saved draft. */
  draftId?: string;
  attachments?: ComposeAttachment[];
};

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB each
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 8;

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function readFileAsAttachment(file: File): Promise<ComposeAttachment> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    dataBase64: btoa(binary),
  };
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinRecipients(list: string[]): string {
  return list.join(", ");
}

function modeTitle(mode: ComposeState["mode"]): string {
  if (mode === "compose") return "New message";
  if (mode === "followup") return "Follow-up";
  if (mode === "forward") return "Forward";
  return "Reply";
}

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
  variant = "dock",
  recipientSuggestions = [],
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
  /** dock = desktop bottom panel; fullscreen = Gmail-style mobile compose */
  variant?: "dock" | "fullscreen";
  /** Known addresses from sent/received mail + contacts */
  recipientSuggestions?: EmailRecipientSuggestion[];
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(
    () => !!(value.cc?.trim() || value.bcc?.trim())
  );

  const attachments = value.attachments ?? [];
  const isNewMail = value.mode === "compose" || value.mode === "forward";
  const canAiDraft = true;
  const aiDraftNeedsBody = isNewMail;
  const missingAttachment =
    attachments.length === 0 && bodyMentionsAttachment(value.body);
  const missingSubject = !value.subject.trim();
  const canSend =
    parseRecipients(value.to).length > 0 &&
    !missingSubject &&
    !missingAttachment &&
    (!!value.body.trim() || attachments.length > 0);
  const sendBlockReason = missingSubject
    ? "Add a subject before sending."
    : missingAttachment
      ? "You mentioned an attachment — attach a file before sending."
      : null;

  useEffect(() => {
    if (!open) return;
    setExpanded(true);
    setAttachError(null);
    if (value.cc?.trim() || value.bcc?.trim()) setShowCcBcc(true);
    // Only steal focus when opening / switching thread — not on every Cc/Bcc keystroke
    const t = setTimeout(() => taRef.current?.focus(), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: don't re-focus on cc/bcc edits
  }, [open, value.threadId, value.mode]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setAttachError(null);
    setAttaching(true);
    try {
      const current = value.attachments ?? [];
      let total = current.reduce((s, a) => s + a.size, 0);
      const next = [...current];

      for (const file of Array.from(files)) {
        if (next.length >= MAX_FILES) {
          setAttachError(`Max ${MAX_FILES} attachments.`);
          break;
        }
        if (file.size > MAX_FILE_BYTES) {
          setAttachError(`“${file.name}” is over 8 MB.`);
          continue;
        }
        if (total + file.size > MAX_TOTAL_BYTES) {
          setAttachError("Attachments exceed 20 MB total.");
          break;
        }
        const att = await readFileAsAttachment(file);
        next.push(att);
        total += file.size;
      }
      onChange({ ...value, attachments: next });
    } catch {
      setAttachError("Could not read file.");
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    onChange({
      ...value,
      attachments: (value.attachments ?? []).filter((a) => a.id !== id),
    });
  };

  if (!open) return null;

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      multiple
      className="hidden"
      onChange={(e) => void addFiles(e.target.files)}
    />
  );

  if (variant === "fullscreen") {
    return (
      <div className="flex flex-col flex-1 min-h-0 h-full bg-[#121018] safe-area-bottom">
        {/* Gmail mobile compose top bar */}
        <div className="shrink-0 flex items-center gap-0.5 px-1.5 py-1.5 border-b border-white/[0.07] safe-area-top">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full text-white/75 hover:bg-white/10"
            aria-label="Back"
            title="Close — unfinished mail is saved to Drafts"
          >
            <ChevronLeft size={22} />
          </button>
          <p className="flex-1 text-[15px] font-medium text-white/80 truncate px-1">
            {modeTitle(value.mode)}
          </p>
          {fileInput}
          <button
            type="button"
            disabled={attaching || attachments.length >= MAX_FILES}
            onClick={() => fileRef.current?.click()}
            className="p-2.5 rounded-full text-white/65 hover:bg-white/10 disabled:opacity-40"
            aria-label="Attach"
          >
            {attaching ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Paperclip size={20} />
            )}
          </button>
          <button
            type="button"
            disabled={sending || !canSend}
            onClick={onSend}
            className="p-2.5 rounded-full text-[#c4b5e0] hover:bg-white/10 disabled:opacity-35"
            aria-label="Send"
            title={sendBlockReason ?? "Send"}
          >
            {sending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 pt-2 space-y-0 border-b border-white/[0.06]">
            <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.05]">
              <span className="text-[13px] text-white/40 w-12 shrink-0">From</span>
              <span className="text-[14px] text-white/75 truncate">me</span>
            </div>

            <div className="flex items-start gap-2 py-2 border-b border-white/[0.05]">
              <div className="flex items-center gap-1.5 pt-1.5 shrink-0">
                <ReplyCorner mode={value.mode} />
                <span className="text-[13px] text-white/40 w-8">To</span>
              </div>
              <div className="flex-1 min-w-0">
                <RecipientChips
                  value={value.to}
                  onChange={(to) => onChange({ ...value, to })}
                  placeholder="Add recipient"
                  bare
                  suggestions={recipientSuggestions}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCcBcc((v) => !v)}
                className="p-1.5 rounded-full text-white/40 hover:bg-white/10 shrink-0 mt-0.5"
                aria-label="Cc / Bcc"
                title="Cc / Bcc"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {showCcBcc && (
              <>
                <div className="flex items-start gap-3 py-2 border-b border-white/[0.05]">
                  <span className="text-[13px] text-white/40 w-12 shrink-0 pt-1.5">
                    Cc
                  </span>
                  <RecipientChips
                    value={value.cc ?? ""}
                    onChange={(cc) => onChange({ ...value, cc })}
                    placeholder="Add Cc"
                    bare
                    suggestions={recipientSuggestions}
                  />
                </div>
                <div className="flex items-start gap-3 py-2 border-b border-white/[0.05]">
                  <span className="text-[13px] text-white/40 w-12 shrink-0 pt-1.5">
                    Bcc
                  </span>
                  <RecipientChips
                    value={value.bcc ?? ""}
                    onChange={(bcc) => onChange({ ...value, bcc })}
                    placeholder="Add Bcc"
                    bare
                    suggestions={recipientSuggestions}
                  />
                </div>
              </>
            )}

            <label className="flex items-center gap-3 py-2.5">
              <span className="text-[13px] text-white/40 w-12 shrink-0">Subject</span>
              <input
                value={value.subject}
                onChange={(e) => onChange({ ...value, subject: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-[14px] text-white/90 focus:outline-none"
              />
            </label>
          </div>

          <div className="px-4 pt-3 pb-6 flex flex-col min-h-[50vh]">
            {drafting && !value.body.trim() ? (
              <div className="flex items-center gap-2 text-[13px] text-[#c4b5e0]/90 mb-3">
                <Loader2 size={14} className="animate-spin" />
                AI is drafting your reply…
              </div>
            ) : null}

            <textarea
              ref={taRef}
              value={value.body}
              onChange={(e) => onChange({ ...value, body: e.target.value })}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (canSend) onSend();
                }
              }}
              placeholder={
                drafting
                  ? "Drafting…"
                  : value.mode === "forward"
                    ? "Add a message…"
                    : "Compose email"
              }
              className="w-full flex-1 min-h-[40vh] bg-transparent text-[15px] text-white/90 placeholder:text-white/30 focus:outline-none resize-none leading-relaxed"
            />

            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-xl bg-white/[0.05] ring-1 ring-white/[0.08] px-3 py-2 text-[12px]"
                  >
                    <FileIcon size={14} className="text-white/40 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-white/80">
                      {a.name}
                    </span>
                    <span className="text-white/35 tabular-nums shrink-0">
                      {formatSize(a.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="p-1 rounded text-white/35 hover:text-rose-300"
                      aria-label={`Remove ${a.name}`}
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {(error || attachError || sendBlockReason) && (
              <p className="mt-2 text-xs text-rose-300">
                {error || attachError || sendBlockReason}
              </p>
            )}

            {canAiDraft && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    drafting || (aiDraftNeedsBody && !value.body.trim())
                  }
                  onClick={onAiDraft}
                  title={
                    aiDraftNeedsBody && !value.body.trim()
                      ? "Write a rough message first"
                      : isNewMail
                        ? "Paraphrase into a professional email"
                        : "Generate AI reply"
                  }
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#5b4a8a]/45 ring-1 ring-[#5b4a8a]/50 text-[13px] font-medium text-violet-100 hover:bg-[#5b4a8a]/60 disabled:opacity-50"
                >
                  {drafting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {isNewMail
                    ? value.body.trim()
                      ? "AI Draft · make professional"
                      : "AI Draft"
                    : value.body.trim()
                      ? "Regen AI draft"
                      : "AI Draft"}
                </button>
                {value.body.trim() ? (
                  <>
                    <button
                      type="button"
                      disabled={drafting}
                      onClick={() => onRewrite("shorter")}
                      className="h-9 px-3 rounded-full bg-white/[0.06] ring-1 ring-white/10 text-[12px] text-white/60 disabled:opacity-50"
                    >
                      Shorter
                    </button>
                    <button
                      type="button"
                      disabled={drafting}
                      onClick={() => onRewrite("formal")}
                      className="h-9 px-3 rounded-full bg-white/[0.06] ring-1 ring-white/10 text-[12px] text-white/60 disabled:opacity-50"
                    >
                      Formal
                    </button>
                    <button
                      type="button"
                      disabled={drafting}
                      onClick={() => onRewrite("casual")}
                      className="h-9 px-3 rounded-full bg-white/[0.06] ring-1 ring-white/10 text-[12px] text-white/60 disabled:opacity-50"
                    >
                      Casual
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop docked panel
  return (
    <div className="shrink-0 border-t border-white/[0.08] bg-[#0e1420] safe-area-bottom">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-white/[0.06]">
        <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
          {modeTitle(value.mode)}
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
        <div className="px-3 sm:px-4 py-3 space-y-2 max-h-[min(56vh,480px)] overflow-y-auto">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <RecipientChips
                label="To"
                value={value.to}
                onChange={(to) => onChange({ ...value, to })}
                placeholder="name@email.com, then Enter"
                suggestions={recipientSuggestions}
              />
            </div>
            {!showCcBcc && (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="shrink-0 text-[11px] font-medium text-white/40 hover:text-violet-200 px-1.5 py-2 mt-0.5"
              >
                Cc/Bcc
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <RecipientChips
                label="Cc"
                value={value.cc ?? ""}
                onChange={(cc) => onChange({ ...value, cc })}
                placeholder="Add Cc · Enter"
                suggestions={recipientSuggestions}
              />
              <RecipientChips
                label="Bcc"
                value={value.bcc ?? ""}
                onChange={(bcc) => onChange({ ...value, bcc })}
                placeholder="Add Bcc · Enter"
                suggestions={recipientSuggestions}
              />
            </>
          )}

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
            className="w-full rounded-xl bg-black/25 ring-1 ring-white/10 px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 focus:outline-none focus:ring-[#5b4a8a]/50 resize-y min-h-[140px]"
          />

          {attachments.length > 0 && (
            <ul className="space-y-1.5">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] px-2.5 py-1.5 text-[12px]"
                >
                  <FileIcon size={14} className="text-white/40 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-white/80">
                    {a.name}
                  </span>
                  <span className="text-white/35 tabular-nums shrink-0">
                    {formatSize(a.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    className="p-1 rounded text-white/35 hover:text-rose-300 hover:bg-white/5"
                    aria-label={`Remove ${a.name}`}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(error || attachError || sendBlockReason) && (
            <p className="text-xs text-rose-300">
              {error || attachError || sendBlockReason}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button
              size="sm"
              disabled={sending || !canSend}
              onClick={onSend}
              title={sendBlockReason ?? "Send"}
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span className="ml-1">Send</span>
            </Button>

            {fileInput}
            <button
              type="button"
              disabled={attaching || attachments.length >= MAX_FILES}
              onClick={() => fileRef.current?.click()}
              title="Attach files"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-white/55 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-white/85 disabled:opacity-40"
            >
              {attaching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Paperclip size={14} />
              )}
              <span className="hidden sm:inline">Attach</span>
              {attachments.length > 0 ? (
                <span className="tabular-nums text-white/40">
                  {attachments.length}
                </span>
              ) : null}
            </button>

            {canAiDraft && (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  drafting || (aiDraftNeedsBody && !value.body.trim())
                }
                onClick={onAiDraft}
                title={
                  isNewMail
                    ? "Paraphrase into a professional email"
                    : "Generate AI reply"
                }
              >
                {drafting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span className="ml-1">
                  {isNewMail ? "AI Draft" : "AI Draft"}
                </span>
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
              title="Close — unfinished mail is saved to Drafts"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReplyCorner({ mode }: { mode: ComposeState["mode"] }) {
  return (
    <span className="text-white/40 shrink-0 p-0.5" aria-hidden>
      {mode === "forward" ? <Forward size={16} /> : <Reply size={16} />}
    </span>
  );
}

function RecipientChips({
  label,
  value,
  onChange,
  placeholder,
  bare,
  suggestions = [],
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** No outer ring — for fullscreen rows */
  bare?: boolean;
  suggestions?: EmailRecipientSuggestion[];
}) {
  const [draft, setDraft] = useState("");
  const [openMenu, setOpenMenu] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chips = parseRecipients(value);

  const matches = useMemo(
    () => filterRecipientSuggestions(suggestions, draft, chips, 8),
    [suggestions, draft, chips]
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [draft]);

  const commit = (raw: string) => {
    const parts = parseRecipients(raw);
    if (!parts.length) return;
    const next = [...chips];
    for (const p of parts) {
      const exists = next.some((c) => c.toLowerCase() === p.toLowerCase());
      if (!exists) next.push(p);
    }
    onChange(joinRecipients(next));
    setDraft("");
    setOpenMenu(false);
  };

  const pickSuggestion = (s: EmailRecipientSuggestion) => {
    commit(formatRecipientChip(s));
    inputRef.current?.focus();
  };

  const removeAt = (idx: number) => {
    onChange(joinRecipients(chips.filter((_, i) => i !== idx)));
  };

  const shell = bare
    ? "relative flex flex-wrap items-center gap-1.5 min-w-0 w-full py-0.5"
    : "relative flex flex-wrap items-center gap-1.5 rounded-xl bg-black/25 ring-1 ring-white/10 px-3 py-1.5 min-h-[2.5rem]";

  return (
    <div
      ref={wrapRef}
      className={shell}
      onClick={() => inputRef.current?.focus()}
      role="group"
      aria-label={label || "Recipients"}
    >
      {label ? (
        <span className="text-[11px] text-white/40 w-14 shrink-0 font-medium self-center">
          {label}
        </span>
      ) : null}
      {chips.map((chip, idx) => {
        const initial = (chip.match(/[a-zA-Z0-9]/)?.[0] || "?").toUpperCase();
        const short = chip.length > 36 ? `${chip.slice(0, 34)}…` : chip;
        return (
          <span
            key={`${chip}-${idx}`}
            className="inline-flex items-center gap-1 max-w-full rounded-full bg-white/[0.1] pl-1 pr-1 py-0.5 ring-1 ring-white/[0.12]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2d5a45] text-[10px] font-semibold text-emerald-100 shrink-0">
              {initial}
            </span>
            <span className="text-[12px] text-white/85 truncate max-w-[11rem]" title={chip}>
              {short}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(idx);
              }}
              className="p-0.5 rounded-full text-white/40 hover:text-white/90 hover:bg-white/10"
              aria-label={`Remove ${chip}`}
            >
              <X size={12} />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpenMenu(true);
        }}
        onFocus={() => setOpenMenu(true)}
        onKeyDown={(e) => {
          if (openMenu && matches.length) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              if (matches[activeIdx]) {
                e.preventDefault();
                pickSuggestion(matches[activeIdx]);
                return;
              }
            }
            if (e.key === "Escape") {
              setOpenMenu(false);
              return;
            }
          }
          if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
            if (draft.trim()) {
              e.preventDefault();
              commit(draft.replace(/,$/, ""));
            }
          } else if (e.key === "Backspace" && !draft && chips.length) {
            removeAt(chips.length - 1);
          }
        }}
        onBlur={() => {
          // Allow suggestion mousedown to fire first
          window.setTimeout(() => {
            if (!wrapRef.current?.contains(document.activeElement)) {
              if (draft.trim()) commit(draft);
              setOpenMenu(false);
            }
          }, 120);
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/[,;\n]/.test(text)) {
            e.preventDefault();
            commit(`${draft} ${text}`);
          }
        }}
        placeholder={chips.length ? "Add another…" : placeholder || "Add recipient"}
        className="flex-1 min-w-[8rem] bg-transparent text-sm text-white/90 placeholder:text-white/25 focus:outline-none py-1"
        autoComplete="off"
        inputMode="email"
        role="combobox"
        aria-expanded={openMenu && matches.length > 0}
        aria-autocomplete="list"
      />

      {openMenu && matches.length > 0 ? (
        <ul
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl bg-[#161c28] ring-1 ring-white/12 shadow-xl py-1"
          role="listbox"
        >
          {matches.map((s, i) => (
            <li key={s.email} role="option" aria-selected={i === activeIdx}>
              <button
                type="button"
                className={
                  i === activeIdx
                    ? "w-full text-left px-3 py-2 bg-white/[0.08]"
                    : "w-full text-left px-3 py-2 hover:bg-white/[0.06]"
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickSuggestion(s);
                }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <p className="text-[13px] text-white/90 truncate">
                  {s.name || s.email}
                </p>
                {s.name ? (
                  <p className="text-[11px] text-white/40 truncate">{s.email}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-black/25 ring-1 ring-white/10 px-3 py-1.5">
      <span className="text-[11px] text-white/40 w-14 shrink-0 font-medium">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-sm font-medium text-white/90 placeholder:text-white/25 focus:outline-none"
      />
    </label>
  );
}
