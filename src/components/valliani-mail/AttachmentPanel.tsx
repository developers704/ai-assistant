"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MailAttachment } from "@/lib/valliani-mail/types";
import {
  attachmentHasPayload,
  attachmentKind,
  blobFromAttachment,
  canInlinePreview,
  formatAttachmentBytes,
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

function downloadViaUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "attachment";
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function AttachmentCard({
  att,
  active,
  onSelect,
}: {
  att: MailAttachment;
  active: boolean;
  onSelect: () => void;
}) {
  const kind = attachmentKind(att);
  const blob = useMemo(() => blobFromAttachment(att), [att]);
  const hasData = attachmentHasPayload(att);
  const sizeLabel = formatAttachmentBytes(att.size);
  const previewable =
    canInlinePreview(kind) || kind === "doc" || kind === "excel";

  function onDownload() {
    if (blob) {
      downloadBlob(blob, att.filename);
      return;
    }
    if (att.downloadUrl) downloadViaUrl(att.downloadUrl, att.filename);
  }

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
            disabled={!hasData}
            onClick={onSelect}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-medium ring-1",
              active
                ? "bg-sky-500/25 text-sky-100 ring-sky-400/40"
                : "bg-white/5 text-white/75 ring-white/10 hover:bg-white/10",
              !hasData && "opacity-40 cursor-not-allowed"
            )}
          >
            Preview
          </button>
        ) : null}
        <button
          type="button"
          disabled={!hasData}
          onClick={onDownload}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium",
            "bg-white/5 text-white/80 ring-1 ring-white/10 hover:bg-white/10",
            !hasData && "opacity-40 cursor-not-allowed"
          )}
        >
          <Download size={12} />
          Download
        </button>
      </div>
      {!hasData ? (
        <p className="mt-2 text-[10px] text-amber-200/70 leading-snug">
          File content wasn’t included on this message — ask the mail API to
          return base64 (or a download URL) on getMessage.
        </p>
      ) : null}
    </div>
  );
}

function PreviewPane({ att }: { att: MailAttachment }) {
  const kind = attachmentKind(att);
  const blob = useMemo(() => blobFromAttachment(att), [att]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setBlobUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setBlobUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  const src = blobUrl || att.downloadUrl || null;

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
        onClick={() => {
          if (blob) downloadBlob(blob, att.filename);
          else if (att.downloadUrl)
            downloadViaUrl(att.downloadUrl, att.filename);
        }}
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
}: {
  attachments: MailAttachment[];
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    if (attachments.length === 1) {
      const only = attachments[0];
      const kind = attachmentKind(only);
      // Auto-open inline preview for single PDF/image when bytes exist
      if (canInlinePreview(kind) && attachmentHasPayload(only)) {
        setActiveIdx(0);
        return;
      }
      if (
        (kind === "doc" || kind === "excel") &&
        attachmentHasPayload(only)
      ) {
        setActiveIdx(0);
        return;
      }
    }
    setActiveIdx(null);
  }, [attachments]);

  if (!attachments.length) return null;

  const active = activeIdx != null ? attachments[activeIdx] : null;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-[11px] font-medium text-white/45">
        {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att, i) => (
          <AttachmentCard
            key={`${att.filename}-${i}`}
            att={att}
            active={activeIdx === i}
            onSelect={() => setActiveIdx((cur) => (cur === i ? null : i))}
          />
        ))}
      </div>
      {active ? (
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
          <PreviewPane att={active} />
        </div>
      ) : null}
    </div>
  );
}
