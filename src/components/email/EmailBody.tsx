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
  const [iframeHeight, setIframeHeight] = useState(320);

  const resizeIframe = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    const height = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight) + 24;
    setIframeHeight(Math.max(height, 280));
  }, []);

  if (bodyHtml && bodyHtml.trim()) {
    const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<base target="_blank" rel="noopener noreferrer" />
<style>
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.55;
    margin: 0;
    padding: 16px;
    color: #1e293b;
    background: #ffffff;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  img { max-width: 100% !important; height: auto !important; }
  table { max-width: 100% !important; }
  a { color: #2563eb; }
  pre, code { white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

    return (
      <div className="space-y-2">
        <iframe
          ref={iframeRef}
          title="Email content"
          sandbox=""
          srcDoc={doc}
          onLoad={resizeIframe}
          style={{ height: iframeHeight }}
          className="w-full rounded-xl border border-white/15 bg-white ring-1 ring-white/10 block"
        />
        {plain && (
          <details className="text-xs text-ink-muted">
            <summary className="cursor-pointer hover:text-ink-secondary py-1">View plain text</summary>
            <pre className="mt-2 text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed rounded-xl bg-black/15 p-4 ring-1 ring-white/5 max-h-48 overflow-y-auto">
              {plain}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed rounded-xl bg-black/15 p-4 ring-1 ring-white/5">
      {plain || "No content."}
    </div>
  );
}
