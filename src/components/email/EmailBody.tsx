"use client";

import { useCallback, useRef, useState } from "react";
import { toPlainText } from "@/lib/email-html";

interface EmailBodyProps {
  body: string;
  bodyHtml?: string;
  preview?: string;
}

export function EmailBody({ body, bodyHtml, preview }: EmailBodyProps) {
  const plain = toPlainText(body) || toPlainText(preview ?? "");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(280);

  const resizeIframe = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    const height = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight) + 16;
    setIframeHeight(Math.max(height, 200));
  }, []);

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
    overflow-x: hidden;
    -webkit-text-size-adjust: 100%;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 15px;
    line-height: 1.5;
    padding: 12px 14px;
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
  table { max-width: 100% !important; width: auto !important; }
  td, th { word-break: break-word; }
  a { color: #2563eb; word-break: break-all; }
  pre, code { white-space: pre-wrap; word-break: break-word; }
  * { max-width: 100%; box-sizing: border-box; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

    return (
      <div className="space-y-2 min-w-0">
        <iframe
          ref={iframeRef}
          title="Email content"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcDoc={doc}
          onLoad={resizeIframe}
          style={{ height: iframeHeight, minHeight: 200 }}
          className="w-full max-w-full rounded-xl border border-white/15 bg-white ring-1 ring-white/10 block"
        />
        {plain && (
          <details className="text-xs text-ink-muted">
            <summary className="cursor-pointer hover:text-ink-secondary py-2">View plain text</summary>
            <pre className="mt-1 text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed rounded-xl bg-black/15 p-3 ring-1 ring-white/5 max-h-48 overflow-y-auto">
              {plain}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed rounded-xl bg-black/15 p-3 sm:p-4 ring-1 ring-white/5 break-words">
      {plain || "No content."}
    </div>
  );
}
