import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import type { GoogleOAuth2Client } from "./client";
import { getAuthenticatedClient } from "./client";
import type { Email } from "@/types";
import { htmlToPlainText, toEmailPreview, toPlainText } from "@/lib/email-html";

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

/** Walk multipart MIME and collect text/plain + text/html separately. */
function extractEmailParts(payload: MimePart | undefined): { plain: string; html: string } {
  const plainParts: string[] = [];
  const htmlParts: string[] = [];

  function walk(part: MimePart | undefined) {
    if (!part) return;

    const mime = (part.mimeType ?? "").toLowerCase();

    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (mime.includes("text/plain")) {
        plainParts.push(decoded);
      } else if (mime.includes("text/html")) {
        htmlParts.push(decoded);
      } else if (!mime.startsWith("multipart/") && decoded.trim()) {
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
  if (labelIds.includes("IMPORTANT") || labelIds.includes("STARRED")) return "important";
  if (labelIds.includes("CATEGORY_PROMOTIONS")) return "promotional";
  return "normal";
}

/** Skip auto-generated mail for "needs reply" (orders, login alerts, newsletters). */
function isLikelyAutomated(from: string, subject: string): boolean {
  const text = `${from} ${subject}`.toLowerCase();
  return (
    /noreply|no-reply|donotreply|mailer-daemon|notification@|notifications@/.test(text) ||
    /order has been received|login details|password reset|verify your email|your receipt|unsubscribe|newsletter|wordpress/.test(
      text
    )
  );
}

function parseGmailMessage(msg: gmail_v1.Schema$Message): Email | null {
  if (!msg?.id) return null;

  const labelIds = msg.labelIds ?? [];
  const headers = msg.payload?.headers;
  const fromRaw = getHeader(headers, "From");
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
  const isImportant = labelIds.includes("IMPORTANT") || labelIds.includes("STARRED");
  const category = mapCategory(labelIds);
  const needsReply =
    !isRead &&
    category !== "promotional" &&
    !isLikelyAutomated(fromRaw, subject) &&
    (isImportant || category === "important");

  const rfcMessageId = getHeader(headers, "Message-ID") || getHeader(headers, "Message-Id") || undefined;
  const inReplyTo = getHeader(headers, "In-Reply-To") || undefined;
  const references = getHeader(headers, "References") || undefined;
  const threadId = msg.threadId || msg.id;

  return {
    id: msg.id,
    threadId,
    from: name,
    fromEmail: email,
    subject,
    preview,
    body: body || msg.snippet || "",
    bodyHtml,
    receivedAt,
    isImportant,
    isRead,
    needsReply,
    category,
    rfcMessageId,
    inReplyTo,
    references,
    messageCount: 1,
  };
}

/** Collapse messages in one thread into a single inbox row (latest on top). */
export function collapseThread(messages: Email[]): Email | null {
  if (messages.length === 0) return null;
  const ordered = [...messages].sort(
    (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
  );
  const latest = ordered[ordered.length - 1];
  const anyUnread = ordered.some((m) => !m.isRead);
  const anyImportant = ordered.some((m) => m.isImportant);
  const anyNeedsReply = ordered.some((m) => m.needsReply);
  const worstCategory = ordered.some((m) => m.category === "urgent")
    ? "urgent"
    : ordered.some((m) => m.category === "important")
      ? "important"
      : ordered.some((m) => m.category === "promotional") &&
          ordered.every((m) => m.category === "promotional")
        ? "promotional"
        : latest.category;

  // Strip nested threadMessages on children to avoid huge payloads
  const threadMessages = ordered.map(({ threadMessages: _t, ...rest }) => ({
    ...rest,
    messageCount: 1,
  }));

  return {
    ...latest,
    isRead: !anyUnread,
    isImportant: anyImportant || latest.isImportant,
    needsReply: anyNeedsReply,
    category: worstCategory as Email["category"],
    threadId: latest.threadId || latest.id,
    threadMessages,
    messageCount: ordered.length,
    preview: latest.preview,
  };
}

export interface GmailInboxPage {
  emails: Email[];
  nextPageToken?: string;
}

export async function fetchGmailInbox(
  client: GoogleOAuth2Client,
  options: { maxResults?: number; pageToken?: string } = {}
): Promise<GmailInboxPage> {
  const maxResults = options.maxResults ?? 25;
  const gmail = google.gmail({ version: "v1", auth: client });

  const list = await gmail.users.threads.list({
    userId: "me",
    maxResults,
    pageToken: options.pageToken,
    q: "in:inbox",
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

/** Fetch one thread by id (full conversation). */
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

function encodeRawMessage(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailMessage(params: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  /** RFC Message-ID of the message being replied to. */
  inReplyTo?: string;
  /** Existing References chain (optional). */
  references?: string;
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
    const headers = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "MIME-Version: 1.0",
    ];

    if (params.inReplyTo) {
      headers.push(`In-Reply-To: ${params.inReplyTo}`);
      const refs = [params.references, params.inReplyTo].filter(Boolean).join(" ").trim();
      if (refs) headers.push(`References: ${refs}`);
    }

    const raw = [...headers, "", params.body].join("\r\n");

    const { data } = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodeRawMessage(raw),
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
