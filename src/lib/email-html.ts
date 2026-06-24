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
