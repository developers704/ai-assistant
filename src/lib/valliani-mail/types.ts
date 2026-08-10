export type MailAuthUser = {
  email: string;
  name: string;
  domain: string;
  quota: number;
  isAdmin: boolean;
  isGlobalAdmin: boolean;
};

export type MailAuthResponse = {
  accessToken: string;
  mailToken: string;
  user: MailAuthUser;
};

export type MailFolder = {
  path: string;
  name: string;
  specialUse?: string;
  listed: boolean;
  subscribed: boolean;
};

export type MailFolderSummary = {
  path: string;
  name: string;
  specialUse?: string;
  total: number;
  unread: number;
};

export type MailSummary = {
  totalMessages: number;
  totalUnread: number;
  folders: MailFolderSummary[];
};

export type MailAddress = {
  name: string;
  address: string;
  label: string;
  avatarUrl: string;
};

export type MailAttachment = {
  filename: string;
  contentType?: string;
  size?: number;
  contentId?: string;
  /** Part / attachment id from mail API (for download endpoint). */
  id?: string;
  /** Zero-based part index when API lists attachments in order. */
  index?: number;
  /** Raw file bytes from getMessage (base64 or data-URL). */
  contentBase64?: string;
  /** Optional HTTPS URL returned on the message payload. */
  downloadUrl?: string;
};

export type MailMessage = {
  uid: number;
  subject: string;
  from: MailAddress[];
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  date: string | null;
  flags: string[];
  size?: number;
  preview: string;
  bodyText: string;
  bodyHtml: string;
  hasHtml: boolean;
  isHydrated: boolean;
  attachments: MailAttachment[];
  hasAttachments: boolean;
  avatarUrl: string;
  sourceFolder: string;
  messageId: string;
  inReplyTo: string;
  references: string[];
  replyTo: MailAddress[];
};

export type MailMessagePage = {
  messages: MailMessage[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export const ALL_MAIL_FOLDER = "__all__";
export const STARRED_FOLDER = "__starred__";

export function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  return Number.parseInt(String(value ?? ""), 10) || 0;
}

export function parseMailAddress(value: unknown): MailAddress {
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    const address = String(o.address ?? "").trim();
    const label = String(o.label ?? "").trim();
    const avatarUrl = String(
      o.avatarUrl ?? o.avatar_url ?? o.profilePic ?? o.picture ?? o.avatar ?? ""
    ).trim();
    return {
      name,
      address,
      label: label || formatAddressLabel(name, address),
      avatarUrl,
    };
  }
  const raw = String(value ?? "").trim();
  const match = /^(.*)<([^>]+)>$/.exec(raw);
  if (match) {
    const name = (match[1] ?? "").trim().replaceAll('"', "");
    const address = (match[2] ?? "").trim();
    return {
      name,
      address,
      label: formatAddressLabel(name, address),
      avatarUrl: "",
    };
  }
  return { name: "", address: raw, label: raw, avatarUrl: "" };
}

function formatAddressLabel(name: string, address: string): string {
  if (name && address) return `${name} <${address}>`;
  return address || name;
}

export function parseAddressList(value: unknown): MailAddress[] {
  if (Array.isArray(value)) return value.map(parseMailAddress);
  if (value == null || value === "") return [];
  return [parseMailAddress(value)];
}

export function prettyFolderName(value: string): string {
  const lower = value.toLowerCase();
  if (lower === "__all__") return "All Mail";
  if (lower === "__starred__") return "Favorites";
  if (lower === "__scheduled__") return "Scheduled";
  if (lower === "__snoozed__") return "Snoozed";
  if (lower === "inbox") return "Inbox";
  if (lower.includes("sent")) return "Sent Mails";
  if (lower.includes("draft")) return "Drafts";
  if (lower.includes("snooze")) return "Snoozed";
  if (lower.includes("junk") || lower.includes("spam")) return "Spam";
  if (lower.includes("trash")) return "Trash";
  if (lower.includes("archive")) return "Archive";
  if (lower.includes("all")) return "All Mail";
  return value || "Folder";
}

/** Flutter MailApiService folder rank for sidebar order. */
export function folderSortRank(path: string): number {
  const p = path.toLowerCase();
  if (p === "inbox") return 0;
  if (p.includes("sent")) return 1;
  if (p === "__all__" || p.includes("all")) return 2;
  if (p.includes("draft")) return 3;
  if (p.includes("archive")) return 4;
  if (p.includes("junk") || p.includes("spam")) return 5;
  if (p.includes("trash")) return 6;
  return 9;
}

export function sortFolders(folders: MailFolder[]): MailFolder[] {
  return [...folders].sort((a, b) => {
    const ra = folderSortRank(a.path);
    const rb = folderSortRank(b.path);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export function parseMailFolder(json: Record<string, unknown>): MailFolder {
  const path = String(json.path ?? json.name ?? "");
  return {
    path,
    name: prettyFolderName(String(json.name ?? path)),
    specialUse: json.specialUse != null ? String(json.specialUse) : undefined,
    listed: json.listed !== false,
    subscribed: json.subscribed === true,
  };
}

export function parseMailSummary(json: Record<string, unknown>): MailSummary {
  const folders = ((json.folders as unknown[]) ?? [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      path: String(e.path ?? ""),
      name: prettyFolderName(String(e.name ?? e.path ?? "")),
      specialUse: e.specialUse != null ? String(e.specialUse) : undefined,
      total: asInt(e.total ?? e.exists),
      unread: asInt(e.unread ?? e.unseen),
    }));
  return {
    totalMessages: asInt(json.totalMessages),
    totalUnread: asInt(json.totalUnread),
    folders,
  };
}

export function parseMailAuthUser(json: Record<string, unknown>): MailAuthUser {
  const source =
    json.user && typeof json.user === "object"
      ? (json.user as Record<string, unknown>)
      : json;
  return {
    email: String(source.email ?? source.username ?? ""),
    name: String(source.name ?? source.displayName ?? ""),
    domain: String(source.domain ?? ""),
    quota: asInt(source.quota),
    isAdmin: source.isAdmin === true || source.isadmin === 1,
    isGlobalAdmin: source.isGlobalAdmin === true || source.isglobaladmin === 1,
  };
}

/** Detect leaked Quoted-Printable (`=20`, emoji `=F0=9F…`, soft breaks). */
export function looksLikeQuotedPrintable(text: string): boolean {
  return /=[0-9A-Fa-f]{2}/.test(text) || /=\r?\n/.test(text);
}

/**
 * Decode Quoted-Printable to UTF-8 text.
 * Fixes list snippets like `Hi Raza,=20 Thanks =F0=9F=91=8D`.
 */
export function decodeQuotedPrintable(input: string): string {
  if (!input) return "";
  const soft = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < soft.length; i++) {
    if (soft[i] === "=" && /^[0-9A-Fa-f]{2}/.test(soft.slice(i + 1, i + 3))) {
      bytes.push(parseInt(soft.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    bytes.push(soft.charCodeAt(i) & 0xff);
  }
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
  } catch {
    return soft;
  }
}

/** Decode QP when present; strip MIME-boundary leakage from snippets. */
export function normalizeMailPlainText(raw: string): string {
  let text = String(raw ?? "");
  if (!text) return "";
  if (looksLikeQuotedPrintable(text)) text = decodeQuotedPrintable(text);

  // Multipart DSN snippets sometimes start with mime boundaries / headers
  if (
    /^--[0-9A-Za-z_-]{8,}/.test(text.trim()) ||
    /^Content-Type:\s*multipart/i.test(text.trim())
  ) {
    text = text
      .replace(/--[0-9A-Za-z_-]+/g, " ")
      .replace(/Content-Type:[^\n;]+;?/gi, " ")
      .replace(/boundary=["']?[^"'\s;]+["']?/gi, " ")
      .replace(/charset=["']?[^"'\s;]+["']?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return text
    .replace(/\u0000/g, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}

export function parseMailMessage(
  json: Record<string, unknown>,
  opts?: { hydrated?: boolean }
): MailMessage {
  const attachments = ((json.attachments as unknown[]) ?? [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e, i) => {
      const rawB64 =
        e.contentBase64 ??
        e.content_base64 ??
        e.base64 ??
        e.content ??
        e.data ??
        e.body;
      const rawUrl =
        e.downloadUrl ?? e.download_url ?? e.url ?? e.href ?? e.link;
      const rawId =
        e.id ??
        e.attachmentId ??
        e.attachment_id ??
        e.partId ??
        e.part_id ??
        e.part;
      const rawIndex =
        e.index ?? e.partIndex ?? e.part_index ?? e.attachmentIndex;
      return {
        filename: String(
          e.filename ??
            e.name ??
            e.originalName ??
            e.original_name ??
            "attachment"
        ),
        contentType:
          e.contentType != null ||
          e.content_type != null ||
          e.mimeType != null ||
          e.mime_type != null
            ? String(
                e.contentType ?? e.content_type ?? e.mimeType ?? e.mime_type
              )
            : undefined,
        size:
          e.size != null || e.sizeBytes != null || e.size_bytes != null
            ? asInt(e.size ?? e.sizeBytes ?? e.size_bytes)
            : undefined,
        contentId:
          e.contentId != null || e.content_id != null || e.cid != null
            ? String(e.contentId ?? e.content_id ?? e.cid)
            : undefined,
        id: rawId != null && String(rawId).trim() ? String(rawId) : undefined,
        index:
          rawIndex != null && Number.isFinite(Number(rawIndex))
            ? asInt(rawIndex)
            : i,
        contentBase64:
          rawB64 != null && String(rawB64).trim()
            ? String(rawB64)
            : undefined,
        downloadUrl:
          rawUrl != null && String(rawUrl).trim()
            ? String(rawUrl).trim()
            : undefined,
      };
    });

  const previewRaw = String(json.preview ?? json.snippet ?? "");
  const bodyTextRaw = String(json.bodyText ?? "");

  return {
    uid: asInt(json.uid),
    subject: String(json.subject ?? ""),
    from: parseAddressList(json.from),
    to: parseAddressList(json.to),
    cc: parseAddressList(json.cc),
    bcc: parseAddressList(json.bcc),
    date: json.date != null ? String(json.date) : null,
    flags: ((json.flags as unknown[]) ?? []).map((e) => String(e)),
    size: typeof json.size === "number" ? json.size : undefined,
    preview: normalizeMailPlainText(previewRaw),
    bodyText: normalizeMailPlainText(bodyTextRaw),
    bodyHtml: String(json.bodyHtml ?? ""),
    hasHtml: json.hasHtml === true,
    isHydrated:
      opts?.hydrated === true ||
      json.isHydrated === true ||
      json.is_hydrated === true ||
      json.hydrated === true,
    attachments,
    hasAttachments:
      json.hasAttachments === true ||
      json.has_attachments === true ||
      attachments.length > 0,
    avatarUrl: String(
      json.avatarUrl ??
        json.avatar_url ??
        json.senderAvatarUrl ??
        json.profilePic ??
        json.picture ??
        json.avatar ??
        ""
    ),
    sourceFolder: String(
      json.sourceFolder ?? json.source_folder ?? json.folder ?? ""
    ),
    messageId: String(json.messageId ?? json.message_id ?? ""),
    inReplyTo: String(json.inReplyTo ?? json.in_reply_to ?? ""),
    references: Array.isArray(json.references)
      ? json.references.map((r) => String(r))
      : [],
    replyTo: parseAddressList(json.replyTo ?? json.reply_to),
  };
}

export function isSeen(flags: string[]): boolean {
  return flags.some((f) => f.toLowerCase() === "\\seen");
}

export function isFlagged(flags: string[]): boolean {
  return flags.some((f) => f.toLowerCase() === "\\flagged");
}

export function cleanSubject(subject: string): string {
  const clean = subject.trim();
  return clean || "(No subject)";
}

export function senderLabel(message: MailMessage): string {
  if (!message.from.length) return "Unknown sender";
  return message.from[0]!.label || displayName(message.from[0]!) || "Unknown";
}

export function displayName(addr: MailAddress): string {
  return addr.name.trim() || addr.address.trim() || addr.label.trim() || "Unknown";
}

export function messageListPreview(message: MailMessage): string {
  const preview = normalizeMailPlainText(message.preview).replace(/\s+/g, " ").trim();
  if (preview) return preview.slice(0, 160);
  const body = normalizeMailPlainText(message.bodyText).replace(/\s+/g, " ").trim();
  if (body) return body.slice(0, 160);
  return "";
}

export function replySubject(subject: string): string {
  const clean = subject.trim();
  if (!clean) return "Re: (No subject)";
  if (/^re\s*:/i.test(clean)) return clean;
  return `Re: ${clean}`;
}

/** Strip Re:/Fwd: prefixes for thread grouping. */
export function normalizeSubjectForThread(subject: string): string {
  let s = subject.trim();
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/^(re|fw|fwd)\s*:\s*/i, "").trim();
    if (next === s) break;
    s = next;
  }
  return s.toLowerCase();
}

function stripMsgId(id: string): string {
  return id.replace(/^<|>$/g, "").trim().toLowerCase();
}

function messageIdSet(m: MailMessage): Set<string> {
  const ids = [m.messageId, m.inReplyTo, ...m.references]
    .map(stripMsgId)
    .filter(Boolean);
  return new Set(ids);
}

/** True when two messages belong to the same conversation. */
export function sameMailThread(a: MailMessage, b: MailMessage): boolean {
  if (a.uid === b.uid) {
    const af = (a.sourceFolder || "").toLowerCase();
    const bf = (b.sourceFolder || "").toLowerCase();
    if (!af || !bf || af === bf) return true;
  }
  const aIds = messageIdSet(a);
  const bIds = messageIdSet(b);
  for (const id of bIds) {
    if (aIds.has(id)) return true;
  }
  const subA = normalizeSubjectForThread(a.subject);
  const subB = normalizeSubjectForThread(b.subject);
  return Boolean(subA && subA === subB);
}

/** List row for Gmail-style conversation view (one row per thread). */
export type MailThreadListItem = MailMessage & {
  threadCount: number;
  threadUids: number[];
  threadHasUnread: boolean;
  threadHasStar: boolean;
};

/**
 * Collapse flat IMAP messages into one list row per conversation.
 * Keeps the newest message as the row (snippet / date / from).
 */
export function collapseMessagesToThreads(
  messages: MailMessage[]
): MailThreadListItem[] {
  const groups: MailMessage[][] = [];
  for (const m of messages) {
    const group = groups.find((g) => g.some((x) => sameMailThread(x, m)));
    if (group) group.push(m);
    else groups.push([m]);
  }

  const rows: MailThreadListItem[] = groups.map((group) => {
    const newest = [...group].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (db !== da) return db - da;
      return b.uid - a.uid;
    })[0]!;
    return {
      ...newest,
      hasAttachments:
        newest.hasAttachments || group.some((m) => m.hasAttachments),
      threadCount: group.length,
      threadUids: group.map((m) => m.uid),
      threadHasUnread: group.some((m) => !isSeen(m.flags)),
      threadHasStar: group.some((m) => isFlagged(m.flags)),
    };
  });

  return rows.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    if (db !== da) return db - da;
    return b.uid - a.uid;
  });
}

/** Oldest → newest for thread reading pane. */
export function sortThreadOldestFirst(messages: MailMessage[]): MailMessage[] {
  return [...messages].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    if (da !== db) return da - db;
    return a.uid - b.uid;
  });
}

/**
 * Keep the author's new text; drop trailing "On … wrote:" / `>` quote blocks.
 * Thread UI shows each message as its own card — nested quotes are noise.
 */
export function stripQuotedTail(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (
      /^On .+ wrote:\s*$/i.test(t) ||
      /^-{2,}\s*Original Message\s*-{2,}/i.test(t) ||
      /^-{5,}.*Forwarded message/i.test(t)
    ) {
      cut = i;
      while (cut > 0 && !lines[cut - 1]!.trim()) cut--;
      break;
    }
  }
  return lines.slice(0, cut).join("\n").trim();
}

/** Collapse optimistic local sends with the real Sent copy. */
export function dedupeThreadMessages(messages: MailMessage[]): MailMessage[] {
  const sorted = sortThreadOldestFirst(messages);
  const out: MailMessage[] = [];
  for (const m of sorted) {
    const bodyKey = stripQuotedTail(m.bodyText || m.preview)
      .toLowerCase()
      .replace(/\s+/g, " ");
    const fromKey = (m.from[0]?.address || "").toLowerCase();
    const mid = stripMsgId(m.messageId);
    const idx = out.findIndex((x) => {
      const xMid = stripMsgId(x.messageId);
      if (mid && xMid && mid === xMid && !mid.startsWith("local-")) return true;
      const xb = stripQuotedTail(x.bodyText || x.preview)
        .toLowerCase()
        .replace(/\s+/g, " ");
      const xf = (x.from[0]?.address || "").toLowerCase();
      if (fromKey && xf === fromKey && bodyKey && xb === bodyKey) return true;
      return false;
    });
    if (idx < 0) {
      out.push(m);
      continue;
    }
    const prev = out[idx]!;
    // Prefer real IMAP uid over optimistic local (uid < 0)
    if (m.uid > 0 && prev.uid < 0) out[idx] = m;
    else if (m.isHydrated && !prev.isHydrated) out[idx] = m;
    else if (m.bodyText.length > prev.bodyText.length && m.uid > 0) out[idx] = m;
  }
  return out;
}

export function forwardSubject(subject: string): string {
  const clean = subject.trim();
  if (!clean) return "Fwd: (No subject)";
  if (/^(fw|fwd)\s*:/i.test(clean)) return clean;
  return `Fwd: ${clean}`;
}

/** Human-readable mail date for reply/forward quotes (no raw ISO). */
export function formatMailDate(date: string | null | undefined): string {
  if (!date?.trim()) return "unknown date";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date.trim();
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function quotePlainBody(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

export function buildReplyBody(message: MailMessage): string {
  const who = message.from[0] ? displayName(message.from[0]) : "sender";
  const when = formatMailDate(message.date);
  // Quote only the new text — never re-quote already-quoted history (`> >`)
  const body = stripQuotedTail(
    normalizeMailPlainText(message.bodyText || message.preview)
  );
  if (!body) return "";
  return `\n\nOn ${when}, ${who} wrote:\n${quotePlainBody(body)}`;
}

export function buildForwardBody(message: MailMessage): string {
  const who = message.from[0] ? displayName(message.from[0]) : "";
  const when = formatMailDate(message.date);
  const body = normalizeMailPlainText(message.bodyText || message.preview);
  return `\n\n---------- Forwarded message ----------\nFrom: ${who}\nDate: ${when}\nSubject: ${message.subject}\n\n${body}`;
}

export function addressEmail(addr: MailAddress): string {
  return (addr.address || addr.label).trim();
}

export function jwtExpiresWithin(
  token: string | null | undefined,
  thresholdMs: number
): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const payload = JSON.parse(
      atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return Date.now() + thresholdMs > payload.exp * 1000;
  } catch {
    return false;
  }
}
