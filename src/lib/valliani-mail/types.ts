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
  contentBase64?: string;
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

export function parseMailMessage(
  json: Record<string, unknown>,
  opts?: { hydrated?: boolean }
): MailMessage {
  const attachments = ((json.attachments as unknown[]) ?? [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      filename: String(
        e.filename ?? e.name ?? e.originalName ?? e.original_name ?? "attachment"
      ),
      contentType:
        e.contentType != null || e.content_type != null || e.mimeType != null
          ? String(e.contentType ?? e.content_type ?? e.mimeType)
          : undefined,
      size:
        e.size != null || e.sizeBytes != null
          ? asInt(e.size ?? e.sizeBytes)
          : undefined,
      contentId: e.contentId != null ? String(e.contentId) : undefined,
      contentBase64:
        e.content != null || e.base64 != null
          ? String(e.content ?? e.base64)
          : undefined,
    }));

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
    preview: String(json.preview ?? json.snippet ?? ""),
    bodyText: String(json.bodyText ?? ""),
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
  const preview = message.preview.trim();
  if (preview) return preview.slice(0, 160);
  if (message.bodyText.trim()) return message.bodyText.trim().slice(0, 160);
  return "";
}

export function replySubject(subject: string): string {
  const clean = subject.trim();
  if (!clean) return "Re: (No subject)";
  if (/^re\s*:/i.test(clean)) return clean;
  return `Re: ${clean}`;
}

export function forwardSubject(subject: string): string {
  const clean = subject.trim();
  if (!clean) return "Fwd: (No subject)";
  if (/^(fw|fwd)\s*:/i.test(clean)) return clean;
  return `Fwd: ${clean}`;
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
