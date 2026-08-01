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
  const [iframeHeight, setIframeHeight] = useState(160);

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body) return;
    const height = Math.max(
      doc.documentElement.scrollHeight,
      doc.body.scrollHeight,
      80
    );
    setIframeHeight(height + 4);
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

  // Prefer plain text when HTML is empty noise; dark UI for plain
  const htmlLooksUseful =
    !!bodyHtml?.trim() &&
    !/^\s*<[^>]+>\s*$/i.test(bodyHtml.trim()) &&
    bodyHtml.replace(/<[^>]+>/g, "").trim().length > 0;

  if (htmlLooksUseful && bodyHtml) {
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
    background: #f4f5f7;
  }
  body {
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 14.5px;
    line-height: 1.6;
    padding: 18px 20px;
    color: #1a1f2c;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  img { max-width: 100% !important; height: auto !important; }
  body > table, body > center > table, body > div > table {
    width: 100% !important; max-width: 100% !important;
  }
  table { max-width: 100% !important; }
  a { color: #3b5bdb; }
  pre, code { white-space: pre-wrap; word-break: break-word; }
  * { box-sizing: border-box; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

    return (
      <div className="min-w-0 w-full rounded-xl overflow-hidden ring-1 ring-white/[0.08] bg-[#f4f5f7]">
        <iframe
          ref={iframeRef}
          title="Email content"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcDoc={doc}
          onLoad={resizeIframe}
          scrolling="no"
          style={{ height: iframeHeight }}
          className="w-full max-w-full block border-0"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] px-4 sm:px-5 py-4 text-[14px] text-white/75 leading-relaxed whitespace-pre-wrap break-words">
      {plain || "No content."}
    </div>
  );
}
