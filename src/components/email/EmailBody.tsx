"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmailAttachment } from "@/types";
import {
  extractInlineAttachmentNames,
  preferPlainEmailBody,
  sanitizeEmailHtmlForPreview,
  toPlainText,
} from "@/lib/email-html";
import { Download, FileIcon, Paperclip } from "lucide-react";

interface EmailBodyProps {
  body: string;
  bodyHtml?: string;
  preview?: string;
  attachments?: EmailAttachment[];
}

function formatBytes(n?: number): string {
  if (n == null || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailBody({ body, bodyHtml, preview, attachments }: EmailBodyProps) {
  const plain = toPlainText(body) || toPlainText(preview ?? "");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(120);

  const inlineFiles = useMemo(
    () => extractInlineAttachmentNames(bodyHtml ?? ""),
    [bodyHtml]
  );

  const usePlain = preferPlainEmailBody(bodyHtml, plain);

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body) return;
    // Hide broken remote/cid images after load
    doc.querySelectorAll("img").forEach((img) => {
      const hide = () => {
        img.style.display = "none";
        resizeIframe();
      };
      img.addEventListener("error", hide, { once: true });
      if (img.complete && img.naturalWidth === 0) hide();
    });
    const height = Math.max(
      doc.documentElement.scrollHeight,
      doc.body.scrollHeight,
      60
    );
    setIframeHeight(height + 2);
  }, []);

  useEffect(() => {
    if (usePlain || !bodyHtml?.trim()) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let removeWheel: (() => void) | undefined;

    const attach = () => {
      resizeIframe();
      const doc = iframe.contentDocument;
      if (!doc) return;

      doc.querySelectorAll("img").forEach((img) => {
        if (!img.complete) img.addEventListener("load", resizeIframe, { once: true });
      });

      const onWheel = (e: WheelEvent) => {
        const parent = iframe.closest("[data-email-scroll]") as HTMLElement | null;
        if (!parent) return;
        e.preventDefault();
        parent.scrollTop += e.deltaY;
      };
      doc.addEventListener("wheel", onWheel, { passive: false });
      removeWheel = () => doc.removeEventListener("wheel", onWheel);
    };

    iframe.addEventListener("load", attach);
    if (iframe.contentDocument?.body) attach();

    return () => {
      iframe.removeEventListener("load", attach);
      removeWheel?.();
    };
  }, [bodyHtml, usePlain, resizeIframe]);

  const attachmentPanel = (
    <AttachmentPanel attachments={attachments} inlineNames={inlineFiles} />
  );

  if (!usePlain && bodyHtml?.trim()) {
    const cleaned = sanitizeEmailHtmlForPreview(bodyHtml);
    const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<base target="_blank" rel="noopener noreferrer" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    overflow: hidden !important;
    background: transparent;
  }
  /* Light paper — marketing HTML (Shopify/GitHub/Zoho) ships white cards;
     forcing light text on that made body unreadable. */
  body {
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 14.5px;
    line-height: 1.55;
    padding: 16px 18px 18px;
    color: #1c1e24;
    background: #ffffff;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  a { color: #1a56db; }
  img {
    max-width: 100% !important;
    height: auto !important;
    border-radius: 8px;
  }
  img[src^="cid:"], img[src=""], img:not([src]) {
    display: none !important;
  }
  hr {
    border: 0;
    border-top: 1px solid rgba(0,0,0,0.12);
    margin: 14px 0;
  }
  table { max-width: 100% !important; }
  body > table, body > center > table, body > div > table {
    width: 100% !important;
    max-width: 100% !important;
  }
  p { margin: 0 0 0.75em; }
  * { box-sizing: border-box; }
</style>
</head>
<body>${cleaned}</body>
</html>`;

    return (
      <div className="min-w-0 w-full space-y-2">
        <div className="rounded-xl overflow-hidden ring-1 ring-white/[0.1] bg-white">
          <iframe
            ref={iframeRef}
            title="Email content"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            srcDoc={doc}
            onLoad={resizeIframe}
            scrolling="no"
            style={{ height: iframeHeight }}
            className="w-full max-w-full block border-0 bg-white"
          />
        </div>
        {attachmentPanel}
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-2">
      <div className="rounded-xl bg-[#141a24] ring-1 ring-white/[0.08] px-4 sm:px-5 py-4 text-[14.5px] text-white/80 leading-[1.6] whitespace-pre-wrap break-words">
        {plain || "No content."}
      </div>
      {attachmentPanel}
    </div>
  );
}

function AttachmentPanel({
  attachments,
  inlineNames,
}: {
  attachments?: EmailAttachment[];
  inlineNames: string[];
}) {
  const real = attachments ?? [];
  if (!real.length && !inlineNames.length) return null;

  const count = real.length || inlineNames.length;

  return (
    <div className="rounded-xl ring-1 ring-white/[0.08] bg-white/[0.03] px-3 py-2.5">
      <p className="text-[11px] font-medium text-white/45 mb-2">
        {count} attachment{count === 1 ? "" : "s"}
      </p>
      <ul className="flex flex-wrap gap-2">
        {real.map((a) => {
          const href =
            a.attachmentId && a.messageId
              ? `/api/gmail/attachment?messageId=${encodeURIComponent(a.messageId)}&attachmentId=${encodeURIComponent(a.attachmentId)}&filename=${encodeURIComponent(a.filename)}&mimeType=${encodeURIComponent(a.mimeType)}`
              : undefined;
          const size = formatBytes(a.size);
          return (
            <li key={`${a.messageId}-${a.attachmentId || a.filename}`}>
              {href ? (
                <a
                  href={href}
                  download={a.filename}
                  className="inline-flex items-center gap-2 max-w-full rounded-lg bg-[#1a2230] ring-1 ring-white/[0.1] px-3 py-2 text-[12px] text-white/80 hover:bg-[#222b3c] hover:text-white transition-colors"
                  title={`Download ${a.filename}`}
                >
                  <FileIcon size={14} className="text-sky-300/80 shrink-0" />
                  <span className="truncate max-w-[14rem]">{a.filename}</span>
                  {size ? (
                    <span className="text-white/35 tabular-nums shrink-0">{size}</span>
                  ) : null}
                  <Download size={12} className="text-white/35 shrink-0" />
                </a>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 max-w-full rounded-lg bg-white/[0.05] ring-1 ring-white/[0.08] px-2.5 py-1.5 text-[12px] text-white/65"
                  title={a.filename}
                >
                  <Paperclip size={12} className="text-white/35 shrink-0" />
                  <span className="truncate">{a.filename}</span>
                </span>
              )}
            </li>
          );
        })}
        {!real.length
          ? inlineNames.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 max-w-full rounded-lg bg-white/[0.05] ring-1 ring-white/[0.08] px-2.5 py-1.5 text-[12px] text-white/65"
                title={name}
              >
                <Paperclip size={12} className="text-white/35 shrink-0" />
                <span className="truncate">{name}</span>
              </li>
            ))
          : null}
      </ul>
    </div>
  );
}
