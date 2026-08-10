"use client";

import { useEffect, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadAttachment } from "@/lib/valliani-mail/api";
import type { MailAttachment } from "@/lib/valliani-mail/types";
import {
  attachmentKind,
  blobFromAttachment,
  canInlinePreview,
  formatAttachmentBytes,
  mimeForAttachment,
  type AttachmentKind,
} from "@/lib/valliani-mail/attachments";

function KindIcon({ kind }: { kind: AttachmentKind }) {
  if (kind === "image") return <ImageIcon size={16} className="text-emerald-300" />;
  if (kind === "pdf") return <FileText size={16} className="text-rose-300" />;
  if (kind === "excel") return <FileSpreadsheet size={16} className="text-emerald-400" />;
  if (kind === "doc") return <FileType size={16} className="text-sky-300" />;
  return <FileText size={16} className="text-white/50" />;
}

function kindLabel(kind: AttachmentKind): string {
  if (kind === "image") return "Image";
  if (kind === "pdf") return "PDF";
  if (kind === "excel") return "Excel";
  if (kind === "doc") return "Word";
  return "File";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "attachment";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

function attKey(att: MailAttachment, index: number): string {
  return `${att.id ?? ""}:${att.filename}:${index}`;
}

function AttachmentCard({
  att,
  index,
  folder,
  uid,
  active,
  busy,
  error,
  onPreview,
  onDownload,
}: {
  att: MailAttachment;
  index: number;
  folder: string;
  uid: number;
  active: boolean;
  busy: boolean;
  error?: string;
  onPreview: () => void;
  onDownload: () => void;
}) {
  const kind = attachmentKind(att);
  const sizeLabel = formatAttachmentBytes(att.size);
  const previewable =
    canInlinePreview(kind) || kind === "doc" || kind === "excel";
  void folder;
  void uid;

  return (
    <div
      className={cn(
        "rounded-xl ring-1 px-3 py-2.5 min-w-[13rem] max-w-full",
        active
          ? "bg-sky-500/15 ring-sky-400/40"
          : "bg-white/[0.04] ring-white/10"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">
          <KindIcon kind={kind} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[12px] font-medium text-white/90 truncate"
            title={att.filename}
          >
            {att.filename}
          </p>
          <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">
            {kindLabel(kind)}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {previewable ? (
          <button
            type="button"
            disabled={busy}
            onClick={onPreview}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-medium ring-1",
              active
                ? "bg-sky-500/25 text-sky-100 ring-sky-400/40"
                : "bg-white/5 text-white/75 ring-white/10 hover:bg-white/10",
              busy && "opacity-60"
            )}
          >
            {busy && active ? "Loading…" : "Preview"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onDownload}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium",
            "bg-white/5 text-white/80 ring-1 ring-white/10 hover:bg-white/10",
            busy && "opacity-60"
          )}
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          Download
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-[10px] text-amber-200/80 leading-snug">{error}</p>
      ) : null}
    </div>
  );
}

function PreviewPane({
  att,
  blob,
  busy,
  error,
  onDownload,
}: {
  att: MailAttachment;
  blob: Blob | null;
  busy: boolean;
  error?: string;
  onDownload: () => void;
}) {
  const kind = attachmentKind(att);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  if (busy) {
    return (
      <div className="rounded-xl bg-black/30 ring-1 ring-white/10 px-4 py-8 flex items-center justify-center gap-2 text-sm text-white/50">
        <Loader2 size={16} className="animate-spin" />
        Loading {att.filename}…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-black/30 ring-1 ring-white/10 px-4 py-6 text-center text-sm text-amber-100/80">
        {error}
      </div>
    );
  }

  const src = url || att.downloadUrl || null;
  if (!src) {
    return (
      <div className="rounded-xl bg-black/30 ring-1 ring-white/10 px-4 py-8 text-center text-sm text-white/45">
        No file data to preview.
      </div>
    );
  }

  if (kind === "image") {
    return (
      <div className="rounded-xl overflow-hidden bg-black/40 ring-1 ring-white/10 p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={att.filename}
          className="max-h-[28rem] w-full object-contain mx-auto rounded-lg"
        />
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className="rounded-xl overflow-hidden bg-black/40 ring-1 ring-white/10 h-[min(32rem,60vh)]">
        <iframe
          title={att.filename}
          src={src}
          className="w-full h-full border-0 bg-white"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-black/30 ring-1 ring-white/10 px-4 py-6 text-center space-y-3">
      <p className="text-sm text-white/70">
        <span className="font-medium text-white/90">{att.filename}</span>
        <br />
        {kind === "excel" ? "Spreadsheet" : "Document"} preview isn’t available
        in the browser. Download to open in Word / Excel.
      </p>
      <button
        type="button"
        onClick={onDownload}
        className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-100 ring-1 ring-sky-400/30 hover:bg-sky-500/30"
      >
        <Download size={14} />
        Download {att.filename}
      </button>
    </div>
  );
}

/** Inline attachment cards + preview / download for Valliani Mail reading pane. */
export function VallianiAttachmentPanel({
  attachments,
  folder,
  uid,
}: {
  attachments: MailAttachment[];
  folder: string;
  uid: number;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [blobs, setBlobs] = useState<Record<string, Blob>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setActiveIdx(null);
    setBlobs({});
    setErrors({});
    setBusyKey(null);
  }, [uid, folder, attachments]);

  async function ensureBlob(att: MailAttachment, index: number): Promise<Blob> {
    const key = attKey(att, index);
    const existing = blobs[key] || blobFromAttachment(att);
    if (existing) {
      if (!blobs[key]) setBlobs((prev) => ({ ...prev, [key]: existing }));
      return existing;
    }
    if (att.downloadUrl?.trim()) {
      const res = await fetch(att.downloadUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      setBlobs((prev) => ({ ...prev, [key]: blob }));
      return blob;
    }
    setBusyKey(key);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      const blob = await downloadAttachment({
        folder,
        uid,
        attachment: att,
        index,
      });
      // Ensure mime is set for PDF iframe
      const typed =
        blob.type && blob.type !== "application/octet-stream"
          ? blob
          : new Blob([blob], { type: mimeForAttachment(att) });
      setBlobs((prev) => ({ ...prev, [key]: typed }));
      return typed;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Couldn’t download this file";
      setErrors((prev) => ({ ...prev, [key]: msg }));
      throw err;
    } finally {
      setBusyKey((cur) => (cur === key ? null : cur));
    }
  }

  async function handlePreview(index: number) {
    const att = attachments[index];
    if (!att) return;
    setActiveIdx(index);
    try {
      await ensureBlob(att, index);
    } catch {
      /* error stored */
    }
  }

  async function handleDownload(index: number) {
    const att = attachments[index];
    if (!att) return;
    try {
      const blob = await ensureBlob(att, index);
      downloadBlob(blob, att.filename);
    } catch {
      /* error stored */
    }
  }

  if (!attachments.length) return null;

  const active = activeIdx != null ? attachments[activeIdx] : null;
  const activeKey =
    active && activeIdx != null ? attKey(active, activeIdx) : null;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-[11px] font-medium text-white/45">
        {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att, i) => {
          const key = attKey(att, i);
          return (
            <AttachmentCard
              key={key}
              att={att}
              index={i}
              folder={folder}
              uid={uid}
              active={activeIdx === i}
              busy={busyKey === key}
              error={errors[key]}
              onPreview={() => void handlePreview(i)}
              onDownload={() => void handleDownload(i)}
            />
          );
        })}
      </div>
      {active && activeKey && activeIdx != null ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/40 truncate">
              Preview · {active.filename}
            </p>
            <button
              type="button"
              className="text-[11px] text-white/40 hover:text-white/70"
              onClick={() => setActiveIdx(null)}
            >
              Close
            </button>
          </div>
          <PreviewPane
            att={active}
            blob={blobs[activeKey] || blobFromAttachment(active)}
            busy={busyKey === activeKey}
            error={errors[activeKey]}
            onDownload={() => void handleDownload(activeIdx)}
          />
        </div>
      ) : null}
    </div>
  );
}
