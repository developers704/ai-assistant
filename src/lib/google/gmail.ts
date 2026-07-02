import { google } from "googleapis";
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
    /order has been received|login details|password reset|verify your email|your receipt|unsubscribe|newsletter|wordpress/.test(text)
  );
}

export interface GmailInboxPage {
  emails: Email[];
  nextPageToken?: string;
}

export async function fetchGmailInbox(
  client: GoogleOAuth2Client,
  options: { maxResults?: number; pageToken?: string } = {}
): Promise<GmailInboxPage> {
  const maxResults = options.maxResults ?? 40;
  const gmail = google.gmail({ version: "v1", auth: client });

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    pageToken: options.pageToken,
    q: "in:inbox",
  });

  const messageIds = list.data.messages ?? [];
  if (messageIds.length === 0) {
    return { emails: [], nextPageToken: list.data.nextPageToken ?? undefined };
  }

  const messages = await Promise.all(
    messageIds.map(async (item) => {
      if (!item.id) return null;
      const { data: msg } = await gmail.users.messages.get({
        userId: "me",
        id: item.id,
        format: "full",
      });
      return msg;
    })
  );

  const emails: Email[] = [];

  for (const msg of messages) {
    if (!msg?.id) continue;

    const labelIds = msg.labelIds ?? [];
    const fromRaw = getHeader(msg.payload?.headers, "From");
    const { name, email } = parseFrom(fromRaw);
    const subject = getHeader(msg.payload?.headers, "Subject") || "(No subject)";
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

    emails.push({
      id: msg.id!,
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
    });
  }

  return { emails, nextPageToken: list.data.nextPageToken ?? undefined };
}

export async function sendGmailMessage(params: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
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
    const raw = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "MIME-Version: 1.0",
      "",
      params.body,
    ].join("\r\n");

    const encoded = Buffer.from(raw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const { data } = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encoded,
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
