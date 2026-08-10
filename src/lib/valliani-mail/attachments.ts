import type { MailAttachment } from "@/lib/valliani-mail/types";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
const PDF_EXT = new Set(["pdf"]);
const DOC_EXT = new Set(["doc", "docx", "rtf", "odt"]);
const EXCEL_EXT = new Set(["xls", "xlsx", "csv", "ods"]);

export type AttachmentKind = "image" | "pdf" | "doc" | "excel" | "other";

export function attachmentExt(filename: string): string {
  const m = filename.trim().toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m?.[1] ?? "";
}

export function attachmentKind(
  att: Pick<MailAttachment, "filename" | "contentType">
): AttachmentKind {
  const ext = attachmentExt(att.filename);
  const mime = (att.contentType || "").toLowerCase();
  if (IMAGE_EXT.has(ext) || mime.startsWith("image/")) return "image";
  if (PDF_EXT.has(ext) || mime.includes("pdf")) return "pdf";
  if (
    DOC_EXT.has(ext) ||
    mime.includes("msword") ||
    mime.includes("wordprocessingml") ||
    mime.includes("rtf")
  ) {
    return "doc";
  }
  if (
    EXCEL_EXT.has(ext) ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv"
  ) {
    return "excel";
  }
  return "other";
}

export function canInlinePreview(kind: AttachmentKind): boolean {
  return kind === "image" || kind === "pdf";
}

export function mimeForAttachment(
  att: Pick<MailAttachment, "filename" | "contentType">
): string {
  if (att.contentType?.trim()) return att.contentType.trim();
  const ext = attachmentExt(att.filename);
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (ext === "csv") return "text/csv";
  return "application/octet-stream";
}

/** Strip data-URL / whitespace from base64 payload. */
export function cleanBase64(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim();
  const dataIdx = s.indexOf("base64,");
  if (dataIdx >= 0) s = s.slice(dataIdx + "base64,".length);
  s = s.replace(/\s+/g, "");
  return s || null;
}

export function blobFromAttachment(att: MailAttachment): Blob | null {
  const b64 = cleanBase64(att.contentBase64);
  if (!b64) return null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mimeForAttachment(att) });
  } catch {
    return null;
  }
}

/** True when preview/download can use either base64 bytes or a URL on the message. */
export function attachmentHasPayload(att: MailAttachment): boolean {
  return Boolean(cleanBase64(att.contentBase64) || att.downloadUrl?.trim());
}

export function formatAttachmentBytes(size?: number): string {
  if (size == null || !Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10_240 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export const MAX_COMPOSE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_COMPOSE_ATTACHMENTS = 8;
export const MAX_COMPOSE_TOTAL_BYTES = 20 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Read local files into MailAttachment payloads for sendMail. */
export async function filesToMailAttachments(
  files: FileList | File[],
  existing: MailAttachment[] = []
): Promise<{ attachments: MailAttachment[]; error?: string }> {
  const list = Array.from(files);
  if (!list.length) return { attachments: existing };

  const next = [...existing];
  let total = next.reduce((s, a) => s + (a.size ?? 0), 0);

  for (const file of list) {
    if (next.length >= MAX_COMPOSE_ATTACHMENTS) {
      return {
        attachments: next,
        error: `Max ${MAX_COMPOSE_ATTACHMENTS} attachments.`,
      };
    }
    if (file.size > MAX_COMPOSE_ATTACHMENT_BYTES) {
      return {
        attachments: next,
        error: `${file.name} is over 8 MB.`,
      };
    }
    if (total + file.size > MAX_COMPOSE_TOTAL_BYTES) {
      return {
        attachments: next,
        error: "Attachments total over 20 MB.",
      };
    }
    const contentBase64 = await fileToBase64(file);
    next.push({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      contentBase64,
    });
    total += file.size;
  }
  return { attachments: next };
}
