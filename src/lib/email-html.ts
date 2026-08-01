/** True if string looks like HTML markup rather than plain text. */
export function looksLikeHtml(text: string): boolean {
  const t = text.trim();
  return (
    /^<!DOCTYPE/i.test(t) ||
    /^<html[\s>]/i.test(t) ||
    /^<head[\s>]/i.test(t) ||
    /^<body[\s>]/i.test(t) ||
    (/<[a-z][\s\S]*>/i.test(t) && /<\/[a-z]+>/i.test(t))
  );
}

/** Strip HTML to readable plain text for previews and AI context. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");

  text = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return text;
}

/** Normalize any email fragment to plain text (handles HTML accidentally stored as body). */
export function toPlainText(content: string): string {
  if (!content) return "";
  return looksLikeHtml(content) ? htmlToPlainText(content) : content;
}

/** One-line preview safe for inbox list rows. */
export function toEmailPreview(content: string, maxLen = 160): string {
  const plain = toPlainText(content).replace(/\s+/g, " ").trim();
  if (!plain) return "";
  return plain.length <= maxLen ? plain : `${plain.slice(0, maxLen - 1)}…`;
}

/** Filenames from cid:/inline images that won't load in the iframe. */
export function extractInlineAttachmentNames(html: string): string[] {
  if (!html) return [];
  const names = new Set<string>();
  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const src = /src=["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
    const alt = /alt=["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
    const title = /title=["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
    if (/^cid:/i.test(src) || !src || src === "#") {
      const name =
        alt ||
        title ||
        /filename=["']?([^"'\s>]+)/i.exec(tag)?.[1] ||
        src.replace(/^cid:/i, "") ||
        "attachment";
      if (name && name !== "attachment") names.add(name.trim());
      else if (/^cid:/i.test(src)) names.add(src.replace(/^cid:/i, "").trim() || "inline image");
    }
  }
  return Array.from(names).slice(0, 12);
}

/**
 * Prefer dark plain-text card for simple replies/signatures.
 * Keep HTML iframe for newsletters / table layouts.
 */
export function preferPlainEmailBody(html: string | undefined, plain: string): boolean {
  if (!html?.trim()) return true;
  if (/<table\b/i.test(html) && html.length > 1200) return false;
  if (/<(style|center)\b/i.test(html) && /width\s*=\s*["']?\d{3,}/i.test(html)) {
    return false;
  }
  const text = plain.trim();
  if (!text) return false;
  // Mostly text + signature / a couple images → plain reads better in dark UI
  return text.length < 6000 && !/<table\b[^>]{0,80}width\s*=\s*["']?(600|650|700)/i.test(html);
}

/** Strip cid images and collapse empty spacing for safer HTML preview. */
export function sanitizeEmailHtmlForPreview(html: string): string {
  return html
    .replace(/<img\b[^>]*src=["']cid:[^"']*["'][^>]*>/gi, "")
    .replace(/<img\b[^>]*src=["']#["'][^>]*>/gi, "")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br/><br/>")
    .replace(/(<p[^>]*>\s*(&nbsp;|\s|<br\s*\/?>)*<\/p>\s*){2,}/gi, "<p><br/></p>")
    // Dark-on-dark: rewrite near-black inline colors so signatures stay readable
    .replace(
      /((?:^|[;\s])color\s*:\s*)(#[0-4][0-9a-f]{5}\b|#000\b|#111\b|#222\b|#333\b|black|rgb\(\s*\d{1,2}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*\)|rgba\(\s*\d{1,2}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*,[^)]+\))/gi,
      "$1#e8eaef"
    )
    .replace(
      /(<font\b[^>]*\bcolor\s*=\s*["']?)(#[0-4][0-9a-f]{5}|#000|#111|#222|#333|black)(["']?)/gi,
      "$1#e8eaef$3"
    );
}

