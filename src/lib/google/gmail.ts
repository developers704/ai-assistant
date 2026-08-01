import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import type { GoogleOAuth2Client } from "./client";
import { getAuthenticatedClient } from "./client";
import type { Email } from "@/types";
import { htmlToPlainText, toEmailPreview, toPlainText } from "@/lib/email-html";
import {
  isLikelyAutomatedMail,
  withInboxBucket,
} from "@/lib/email-buckets";

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function getHeader(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

interface MimePart {
  mimeType?: string | null;
  body?: { data?: string | null };
  parts?: MimePart[];
}

function extractEmailParts(payload: MimePart | undefined): { plain: string; html: string } {
  const plainParts: string[] = [];
  const htmlParts: string[] = [];

  function walk(part: MimePart | undefined) {
    if (!part) return;
    const mime = (part.mimeType ?? "").toLowerCase();
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (mime.includes("text/plain")) plainParts.push(decoded);
      else if (mime.includes("text/html")) htmlParts.push(decoded);
      else if (!mime.startsWith("multipart/") && decoded.trim()) {
        if (decoded.trim().startsWith("<") || /<html[\s>]/i.test(decoded)) {
          htmlParts.push(decoded);
        } else {
          plainParts.push(decoded);
        }
      }
    }
    part.parts?.forEach(walk);
  }

  walk(payload);
  const html = htmlParts.join("\n").trim();
  let plain = plainParts.join("\n\n").trim();
  if (!plain && html) plain = htmlToPlainText(html);
  return { plain, html };
}

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, "").trim(), email: match[2] };
  }
  return { name: from, email: from };
}

function mapCategory(labelIds: string[] = []): Email["category"] {
  if (labelIds.includes("CATEGORY_PROMOTIONS")) return "promotional";
  if (labelIds.includes("IMPORTANT") || labelIds.includes("STARRED")) return "important";
  return "normal";
}

function parseGmailMessage(msg: gmail_v1.Schema$Message): Email | null {
  if (!msg?.id) return null;

  const labelIds = msg.labelIds ?? [];
  const headers = msg.payload?.headers;
  const fromRaw = getHeader(headers, "From");
  const toRaw = getHeader(headers, "To");
  const ccRaw = getHeader(headers, "Cc");
  const bccRaw = getHeader(headers, "Bcc");
  const { name, email } = parseFrom(fromRaw);
  const subject = getHeader(headers, "Subject") || "(No subject)";
  const { plain, html } = extractEmailParts(msg.payload as MimePart | undefined);
  const body = plain || toPlainText(msg.snippet ?? "") || "";
  const preview = toEmailPreview(body || html || msg.snippet || "");
  const bodyHtml = html || undefined;
  const receivedAt = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : new Date().toISOString();
  const isRead = !labelIds.includes("UNREAD");
  const isStarred = labelIds.includes("STARRED");
  const isImportant = labelIds.includes("IMPORTANT") || isStarred;
  const category = mapCategory(labelIds);
  const automated = isLikelyAutomatedMail(fromRaw, subject);
  const asksSomething = /\?|\b(please|can you|could you|let me know)\b/i.test(
    `${subject} ${preview} ${body}`
  );
  const needsReply =
    !automated &&
    category !== "promotional" &&
    ((!isRead && (isImportant || asksSomething)) || asksSomething);

  return withInboxBucket({
    id: msg.id,
    threadId: msg.threadId || msg.id,
    from: name,
    fromEmail: email,
    to: toRaw || undefined,
    cc: ccRaw || undefined,
    bcc: bccRaw || undefined,
    subject,
    preview,
    body: body || msg.snippet || "",
    bodyHtml,
    receivedAt,
    isImportant,
    isRead,
    isStarred,
    needsReply,
    category,
    rfcMessageId:
      getHeader(headers, "Message-ID") || getHeader(headers, "Message-Id") || undefined,
    inReplyTo: getHeader(headers, "In-Reply-To") || undefined,
    references: getHeader(headers, "References") || undefined,
    messageCount: 1,
  });
}

export function collapseThread(messages: Email[]): Email | null {
  if (messages.length === 0) return null;
  const ordered = [...messages].sort(
    (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
  );
  const latest = ordered[ordered.length - 1];
  const anyUnread = ordered.some((m) => !m.isRead);
  const anyImportant = ordered.some((m) => m.isImportant);
  const anyStarred = ordered.some((m) => m.isStarred);
  const anyNeedsReply = ordered.some((m) => m.needsReply);
  const worstCategory = ordered.some((m) => m.category === "urgent")
    ? "urgent"
    : ordered.some((m) => m.category === "important")
      ? "important"
      : ordered.some((m) => m.category === "promotional") &&
          ordered.every((m) => m.category === "promotional")
        ? "promotional"
        : latest.category;

  const threadMessages = ordered.map(({ threadMessages: _t, ...rest }) => ({
    ...rest,
    messageCount: 1,
  }));

  return withInboxBucket({
    ...latest,
    isRead: !anyUnread,
    isImportant: anyImportant || latest.isImportant,
    isStarred: anyStarred || !!latest.isStarred,
    needsReply: anyNeedsReply,
    category: worstCategory as Email["category"],
    threadId: latest.threadId || latest.id,
    threadMessages,
    messageCount: ordered.length,
    preview: latest.preview,
  });
}

export interface GmailInboxPage {
  emails: Email[];
  nextPageToken?: string;
}

export type GmailListQuery = "inbox" | "starred" | "sent" | "drafts";

function queryForFolder(folder: GmailListQuery): string {
  switch (folder) {
    case "starred":
      return "is:starred";
    case "sent":
      return "in:sent";
    case "drafts":
      return "in:drafts";
    default:
      return "in:inbox";
  }
}

export async function fetchGmailInbox(
  client: GoogleOAuth2Client,
  options: {
    maxResults?: number;
    pageToken?: string;
    folder?: GmailListQuery;
  } = {}
): Promise<GmailInboxPage> {
  const maxResults = options.maxResults ?? 25;
  const gmail = google.gmail({ version: "v1", auth: client });
  const folder = options.folder ?? "inbox";

  if (folder === "drafts") {
    return fetchGmailDrafts(client, {
      maxResults,
      pageToken: options.pageToken,
    });
  }

  const list = await gmail.users.threads.list({
    userId: "me",
    maxResults,
    pageToken: options.pageToken,
    q: queryForFolder(folder),
  });

  const threadRefs = list.data.threads ?? [];
  if (threadRefs.length === 0) {
    return { emails: [], nextPageToken: list.data.nextPageToken ?? undefined };
  }

  const threads = await Promise.all(
    threadRefs.map(async (item) => {
      if (!item.id) return null;
      const { data: thread } = await gmail.users.threads.get({
        userId: "me",
        id: item.id,
        format: "full",
      });
      return thread;
    })
  );

  const emails: Email[] = [];
  for (const thread of threads) {
    if (!thread?.id || !thread.messages?.length) continue;
    const messages = thread.messages
      .map((msg) => parseGmailMessage(msg))
      .filter((e): e is Email => e != null)
      .map((e) => ({ ...e, threadId: thread.id! }));
    const collapsed = collapseThread(messages);
    if (collapsed) emails.push(collapsed);
  }

  return { emails, nextPageToken: list.data.nextPageToken ?? undefined };
}

export async function fetchGmailThread(
  client: GoogleOAuth2Client,
  threadId: string
): Promise<Email | null> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const { data: thread } = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });
  if (!thread?.messages?.length) return null;
  const messages = thread.messages
    .map((msg) => parseGmailMessage(msg))
    .filter((e): e is Email => e != null)
    .map((e) => ({ ...e, threadId: thread.id || threadId }));
  return collapseThread(messages);
}

export type GmailThreadAction =
  | "star"
  | "unstar"
  | "archive"
  | "trash"
  | "mark_read"
  | "mark_unread";

export async function modifyGmailThread(
  client: GoogleOAuth2Client,
  threadId: string,
  action: GmailThreadAction
): Promise<{ ok: boolean; error?: string }> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const add: string[] = [];
  const remove: string[] = [];

  switch (action) {
    case "star":
      add.push("STARRED");
      break;
    case "unstar":
      remove.push("STARRED");
      break;
    case "archive":
      remove.push("INBOX");
      break;
    case "trash":
      add.push("TRASH");
      remove.push("INBOX");
      break;
    case "mark_read":
      remove.push("UNREAD");
      break;
    case "mark_unread":
      add.push("UNREAD");
      break;
  }

  try {
    await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: {
        addLabelIds: add.length ? add : undefined,
        removeLabelIds: remove.length ? remove : undefined,
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("Gmail modify failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update thread",
    };
  }
}

export async function fetchRecentSentSnippets(
  client: GoogleOAuth2Client,
  max = 12
): Promise<string[]> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const list = await gmail.users.messages.list({
    userId: "me",
    q: "in:sent",
    maxResults: max,
  });
  const ids = (list.data.messages ?? []).map((m) => m.id).filter(Boolean) as string[];
  const snippets: string[] = [];
  for (const id of ids) {
    const { data } = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });
    const parsed = parseGmailMessage(data);
    if (parsed?.body?.trim()) snippets.push(parsed.body.trim().slice(0, 900));
  }
  return snippets;
}

export async function fetchGmailDrafts(
  client: GoogleOAuth2Client,
  options: { maxResults?: number; pageToken?: string } = {}
): Promise<GmailInboxPage> {
  const maxResults = options.maxResults ?? 25;
  const gmail = google.gmail({ version: "v1", auth: client });
  const list = await gmail.users.drafts.list({
    userId: "me",
    maxResults,
    pageToken: options.pageToken,
  });

  const refs = list.data.drafts ?? [];
  if (!refs.length) {
    return { emails: [], nextPageToken: list.data.nextPageToken ?? undefined };
  }

  const emails: Email[] = [];
  for (const ref of refs) {
    if (!ref.id) continue;
    try {
      const { data } = await gmail.users.drafts.get({
        userId: "me",
        id: ref.id,
        format: "full",
      });
      if (!data.message) continue;
      const parsed = parseGmailMessage(data.message);
      if (!parsed) continue;
      const toDisplay = parsed.to?.trim() || "(No recipient)";
      emails.push({
        ...parsed,
        draftId: ref.id,
        from: toDisplay,
        fromEmail: parsed.to || "",
        subject: parsed.subject || "(No subject)",
        preview: parsed.preview || parsed.body.slice(0, 120),
        isRead: true,
        needsReply: false,
        inboxBucket: "fyi",
      });
    } catch (err) {
      console.warn("Failed to load draft", ref.id, err);
    }
  }

  return { emails, nextPageToken: list.data.nextPageToken ?? undefined };
}

export type GmailAttachment = {
  filename: string;
  mimeType: string;
  /** Raw base64 (no data: URL prefix). */
  dataBase64: string;
};

function encodeSubject(subject: string): string {
  // Keep ASCII subjects plain; encode UTF-8 with RFC 2047 when needed
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  const b64 = Buffer.from(subject, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

function foldBase64(b64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  return lines.join("\r\n");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\r\n"\\]/g, "_").slice(0, 180) || "attachment";
}

function buildRawMime(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  attachments?: GmailAttachment[];
}): string {
  const headers = [`To: ${params.to}`];
  if (params.cc?.trim()) headers.push(`Cc: ${params.cc.trim()}`);
  if (params.bcc?.trim()) headers.push(`Bcc: ${params.bcc.trim()}`);
  headers.push(`Subject: ${encodeSubject(params.subject)}`, "MIME-Version: 1.0");
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
    const refs = [params.references, params.inReplyTo].filter(Boolean).join(" ").trim();
    if (refs) headers.push(`References: ${refs}`);
  }

  const attachments = params.attachments?.filter((a) => a.dataBase64) ?? [];
  if (attachments.length === 0) {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    return [...headers, "", params.body].join("\r\n");
  }

  const boundary = `mixed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts: string[] = [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    params.body || " ",
  ];

  for (const att of attachments) {
    const filename = sanitizeFilename(att.filename);
    const mime = (att.mimeType || "application/octet-stream").replace(/[\r\n]/g, "");
    parts.push(
      `--${boundary}`,
      `Content-Type: ${mime}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      foldBase64(att.dataBase64.replace(/\s+/g, ""))
    );
  }
  parts.push(`--${boundary}--`, "");
  return parts.join("\r\n");
}

export async function saveGmailDraft(
  client: GoogleOAuth2Client,
  params: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    threadId?: string;
    draftId?: string;
    inReplyTo?: string;
    references?: string;
    attachments?: GmailAttachment[];
  }
): Promise<{ ok: boolean; draftId?: string; error?: string }> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const raw = encodeRawMessage(
    buildRawMime({
      to: params.to || "",
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject || "(No subject)",
      body: params.body || "",
      inReplyTo: params.inReplyTo,
      references: params.references,
      attachments: params.attachments,
    })
  );
  const message: gmail_v1.Schema$Message = {
    raw,
    threadId: params.threadId,
  };

  try {
    if (params.draftId) {
      await gmail.users.drafts.update({
        userId: "me",
        id: params.draftId,
        requestBody: { message },
      });
      return { ok: true, draftId: params.draftId };
    }
    const { data } = await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message },
    });
    return { ok: true, draftId: data.id ?? undefined };
  } catch (err) {
    console.error("Gmail save draft failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save draft",
    };
  }
}

export async function deleteGmailDraft(
  client: GoogleOAuth2Client,
  draftId: string
): Promise<{ ok: boolean; error?: string }> {
  const gmail = google.gmail({ version: "v1", auth: client });
  try {
    await gmail.users.drafts.delete({ userId: "me", id: draftId });
    return { ok: true };
  } catch (err) {
    console.error("Gmail delete draft failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete draft",
    };
  }
}

function encodeRawMessage(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailMessage(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: GmailAttachment[];
}): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const client = await getAuthenticatedClient();
  if (!client) {
    return {
      ok: false,
      error: "Gmail is not connected. Open Settings and connect your Google account first.",
    };
  }

  try {
    const gmail = google.gmail({ version: "v1", auth: client });
    const raw = encodeRawMessage(
      buildRawMime({
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        body: params.body,
        inReplyTo: params.inReplyTo,
        references: params.references,
        attachments: params.attachments,
      })
    );

    const { data } = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: params.threadId,
      },
    });

    return { ok: true, messageId: data.id ?? undefined };
  } catch (err) {
    console.error("Gmail send failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send email via Gmail.",
    };
  }
}
