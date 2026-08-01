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
  Paperclip,
  FileIcon,
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
  mode: "reply" | "compose" | "followup";
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
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // ~Gmail practical limit
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(
    () => !!(value.cc?.trim() || value.bcc?.trim())
  );

  const attachments = value.attachments ?? [];

  useEffect(() => {
    if (open) {
      setExpanded(true);
      setAttachError(null);
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

  return (
    <div
      className={cn(
        "shrink-0 border-t border-white/[0.08] bg-[#0e1420] safe-area-bottom"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-white/[0.06]">
        <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
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
            <Button
              size="sm"
              disabled={
                sending ||
                !value.to.trim() ||
                (!value.body.trim() && attachments.length === 0)
              }
              onClick={onSend}
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span className="ml-1">Send</span>
            </Button>

            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void addFiles(e.target.files)}
            />
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
