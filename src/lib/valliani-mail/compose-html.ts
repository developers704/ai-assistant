/** AI / plain drafts → contentEditable HTML. */
export function plainToComposeHtml(plain: string): string {
  return plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/** Plain text from compose HTML (browser). */
export function htmlToPlain(html: string): string {
  if (!html?.trim()) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>|<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\u00a0/g, " ")
      .trim();
  }
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.innerText || el.textContent || "").replace(/\u00a0/g, " ").trim();
}

export function isComposeBodyEmpty(html: string): boolean {
  return !htmlToPlain(html);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal cleanup before sending HTML mail. */
export function sanitizeComposeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

/** Build text + optional html payloads for sendMail. */
export function buildSendBodies(
  userHtml: string,
  quotePlain?: string
): { text: string; html?: string } {
  const userPlain = htmlToPlain(userHtml);
  const quote = quotePlain?.trim() ?? "";
  const text = [userPlain, quote].filter(Boolean).join("\n\n");
  if (!text) return { text: "" };

  const parts: string[] = [];
  if (userPlain) {
    const cleaned = sanitizeComposeHtml(userHtml.trim());
    parts.push(cleaned.includes("<") ? cleaned : escapeHtml(cleaned).replace(/\n/g, "<br>"));
  }
  if (quote) {
    parts.push(
      `<div style="margin-top:12px;padding-left:12px;border-left:2px solid #cbd5e1;color:#64748b;white-space:pre-wrap;font-family:inherit">${escapeHtml(quote)}</div>`
    );
  }
  return { text, html: parts.join("") };
}
