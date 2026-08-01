"use client";

import { useEffect, useRef, useState } from "react";
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
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(
    () => !!(value.cc?.trim() || value.bcc?.trim())
  );
  const [showToEdit, setShowToEdit] = useState(false);

  const attachments = value.attachments ?? [];
  const canAiDraft = value.mode === "reply" || value.mode === "followup";
  const canSend =
    !!value.to.trim() && (!!value.body.trim() || attachments.length > 0);

  useEffect(() => {
    if (open) {
      setExpanded(true);
      setAttachError(null);
      setShowToEdit(value.mode === "compose" || value.mode === "forward");
      if (value.cc?.trim() || value.bcc?.trim()) setShowCcBcc(true);
      const t = setTimeout(() => taRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open, value.threadId, value.mode, value.cc, value.bcc]);

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
    const toDisplay =
      value.to.trim() ||
      (value.mode === "forward" ? "Add recipient" : "Recipient");
    const toInitial = (value.to.trim()[0] || "?").toUpperCase();

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
          >
            {sending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Headers — Gmail style rows */}
          <div className="px-4 pt-2 space-y-0 border-b border-white/[0.06]">
            <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.05]">
              <span className="text-[13px] text-white/40 w-12 shrink-0">From</span>
              <span className="text-[14px] text-white/75 truncate">me</span>
            </div>

            <div className="flex items-center gap-2 py-2 border-b border-white/[0.05]">
              <ReplyCorner mode={value.mode} />
              <button
                type="button"
                onClick={() => setShowToEdit((v) => !v)}
                className="flex-1 min-w-0 flex items-center gap-2 text-left"
              >
                {!showToEdit && value.to.trim() && value.mode !== "compose" ? (
                  <span className="inline-flex items-center gap-2 max-w-full rounded-full bg-white/[0.08] pl-1 pr-2.5 py-1 ring-1 ring-white/[0.1]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2d5a45] text-[11px] font-semibold text-emerald-100">
                      {toInitial}
                    </span>
                    <span className="text-[13px] text-white/85 truncate max-w-[12rem]">
                      {toDisplay.split(/[,<]/)[0].trim().replace(/"/g, "") ||
                        toDisplay}
                    </span>
                  </span>
                ) : (
                  <span className="text-[14px] text-white/35 truncate">
                    {value.mode === "forward" ? "To" : "Recipient"}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowCcBcc((v) => !v)}
                className="p-1.5 rounded-full text-white/40 hover:bg-white/10"
                aria-label="More recipients"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {(showToEdit || value.mode === "compose" || value.mode === "forward") && (
              <label className="flex items-center gap-3 py-2 border-b border-white/[0.05]">
                <span className="text-[13px] text-white/40 w-12 shrink-0">To</span>
                <input
                  value={value.to}
                  onChange={(e) => onChange({ ...value, to: e.target.value })}
                  placeholder="recipient@email.com"
                  className="flex-1 min-w-0 bg-transparent text-[14px] text-white/90 placeholder:text-white/25 focus:outline-none"
                  autoComplete="email"
                />
              </label>
            )}

            {showCcBcc && (
              <>
                <label className="flex items-center gap-3 py-2 border-b border-white/[0.05]">
                  <span className="text-[13px] text-white/40 w-12 shrink-0">Cc</span>
                  <input
                    value={value.cc ?? ""}
                    onChange={(e) => onChange({ ...value, cc: e.target.value })}
                    className="flex-1 min-w-0 bg-transparent text-[14px] text-white/90 focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-3 py-2 border-b border-white/[0.05]">
                  <span className="text-[13px] text-white/40 w-12 shrink-0">Bcc</span>
                  <input
                    value={value.bcc ?? ""}
                    onChange={(e) => onChange({ ...value, bcc: e.target.value })}
                    className="flex-1 min-w-0 bg-transparent text-[14px] text-white/90 focus:outline-none"
                  />
                </label>
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

            {(error || attachError) && (
              <p className="mt-2 text-xs text-rose-300">{error || attachError}</p>
            )}

            {/* AI draft actions — always visible for reply */}
            {canAiDraft && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={drafting}
                  onClick={onAiDraft}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#5b4a8a]/45 ring-1 ring-[#5b4a8a]/50 text-[13px] font-medium text-violet-100 hover:bg-[#5b4a8a]/60 disabled:opacity-50"
                >
                  {drafting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {value.body.trim() ? "Regen AI draft" : "AI Draft"}
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
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Field
                label="To"
                value={value.to}
                onChange={(to) => onChange({ ...value, to })}
              />
            </div>
            {!showCcBcc && (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="shrink-0 text-[11px] font-medium text-white/40 hover:text-violet-200 px-1.5 py-1"
              >
                Cc/Bcc
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <Field
                label="Cc"
                value={value.cc ?? ""}
                onChange={(cc) => onChange({ ...value, cc })}
                placeholder="optional"
              />
              <Field
                label="Bcc"
                value={value.bcc ?? ""}
                onChange={(bcc) => onChange({ ...value, bcc })}
                placeholder="optional"
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

          {(error || attachError) && (
            <p className="text-xs text-rose-300">{error || attachError}</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button size="sm" disabled={sending || !canSend} onClick={onSend}>
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
