"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toPlainText } from "@/lib/email-html";

interface EmailBodyProps {
  body: string;
  bodyHtml?: string;
  preview?: string;
}

export function EmailBody({ body, bodyHtml, preview }: EmailBodyProps) {
  const plain = toPlainText(body) || toPlainText(preview ?? "");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(200);

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body) return;
    const height = Math.max(
      doc.documentElement.scrollHeight,
      doc.body.scrollHeight,
      120
    );
    setIframeHeight(height + 8);
  }, []);

  useEffect(() => {
    if (!bodyHtml?.trim()) return;
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
  }, [bodyHtml, resizeIframe]);

  if (bodyHtml && bodyHtml.trim()) {
    const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<meta name="referrer" content="no-referrer" />
<base target="_blank" rel="noopener noreferrer" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    overflow: hidden !important;
    -webkit-text-size-adjust: 100%;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 15px;
    line-height: 1.55;
    padding: 20px 28px 28px;
    color: #1e293b;
    background: #ffffff;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  img {
    max-width: 100% !important;
    height: auto !important;
    display: block;
  }
  body > table,
  body > center > table,
  body > div > table {
    width: 100% !important;
    max-width: 100% !important;
  }
  table { max-width: 100% !important; }
  td, th { word-break: break-word; }
  a { color: #2563eb; word-break: break-all; }
  pre, code { white-space: pre-wrap; word-break: break-word; }
  * { box-sizing: border-box; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

    return (
      <div className="min-w-0 w-full">
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
        {plain && (
          <details className="text-xs text-ink-muted px-4 sm:px-6 py-2 bg-[#0c1018]">
            <summary className="cursor-pointer hover:text-ink-secondary py-1">
              View plain text
            </summary>
            <pre className="mt-1 text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed rounded-xl bg-black/25 p-3 ring-1 ring-white/5 max-h-48 overflow-y-auto">
              {plain}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-white text-slate-800 text-[15px] leading-relaxed whitespace-pre-wrap break-words px-6 sm:px-8 py-6 sm:py-7">
      {plain || "No content."}
    </div>
  );
}
