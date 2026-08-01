import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/google/client";
import {
  deleteGmailDraft,
  fetchGmailInbox,
  fetchGmailThread,
  modifyGmailThread,
  saveGmailDraft,
  sendGmailMessage,
  type GmailAttachment,
  type GmailListQuery,
  type GmailThreadAction,
} from "@/lib/google/gmail";
import { isGoogleConnected } from "@/lib/google/token-store";
import { bodyMentionsAttachment, sortEmails } from "@/lib/email-utils";
import { withInboxBucket } from "@/lib/email-buckets";

const FOLDERS = ["inbox", "starred", "sent", "drafts"] as const;

function parseAttachments(raw: unknown): GmailAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: GmailAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const filename = String(o.filename ?? o.name ?? "").trim();
    const dataBase64 = String(o.dataBase64 ?? "").replace(/\s+/g, "");
    if (!filename || !dataBase64) continue;
    out.push({
      filename,
      mimeType: String(o.mimeType ?? "application/octet-stream"),
      dataBase64,
    });
  }
  return out.slice(0, 8);
}

export async function GET(req: NextRequest) {
  if (!isGoogleConnected()) {
    return NextResponse.json({ connected: false, emails: [] });
  }

  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json(
      { connected: true, error: "Session expired — reconnect Google", emails: [] },
      { status: 401 }
    );
  }

  const threadIdParam = req.nextUrl.searchParams.get("threadId")?.trim();
  if (threadIdParam) {
    const email = await fetchGmailThread(client, threadIdParam);
    if (!email) {
      return NextResponse.json(
        { connected: true, error: "Thread not found", email: null },
        { status: 404 }
      );
    }
    return NextResponse.json({
      connected: true,
      email: withInboxBucket(email),
    });
  }

  const pageToken = req.nextUrl.searchParams.get("pageToken") ?? undefined;
  const folderParam = req.nextUrl.searchParams.get("folder") ?? "inbox";
  const folder = (
    FOLDERS.includes(folderParam as (typeof FOLDERS)[number]) ? folderParam : "inbox"
  ) as GmailListQuery;
  const maxResults = Math.min(
    50,
    Math.max(10, Number(req.nextUrl.searchParams.get("maxResults") ?? 25))
  );

  const page = await fetchGmailInbox(client, { maxResults, pageToken, folder });
  const emails =
    folder === "drafts"
      ? page.emails
      : sortEmails(page.emails.map(withInboxBucket));

  return NextResponse.json({
    connected: true,
    folder,
    emails,
    nextPageToken: page.nextPageToken,
    hasMore: !!page.nextPageToken,
  });
}

export async function POST(req: NextRequest) {
  if (!isGoogleConnected()) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
  }
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action ?? "");

  if (action === "save_draft") {
    const attachments = parseAttachments(body.attachments);
    const result = await saveGmailDraft(client, {
      to: String(body.to ?? ""),
      cc: body.cc ? String(body.cc) : undefined,
      bcc: body.bcc ? String(body.bcc) : undefined,
      subject: String(body.subject ?? ""),
      body: String(body.body ?? ""),
      threadId: body.threadId ? String(body.threadId) : undefined,
      draftId: body.draftId ? String(body.draftId) : undefined,
      inReplyTo: body.inReplyTo ? String(body.inReplyTo) : undefined,
      references: body.references ? String(body.references) : undefined,
      attachments,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, draftId: result.draftId });
  }

  if (action === "delete_draft") {
    const draftId = String(body.draftId ?? "").trim();
    if (!draftId) {
      return NextResponse.json({ error: "draftId required" }, { status: 400 });
    }
    const result = await deleteGmailDraft(client, draftId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "send") {
    const to = String(body.to ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const text = String(body.body ?? "").trim();
    const attachments = parseAttachments(body.attachments);
    if (!to || !subject || (!text && attachments.length === 0)) {
      return NextResponse.json(
        { error: "to, subject, and body (or attachments) are required" },
        { status: 400 }
      );
    }
    if (attachments.length === 0 && bodyMentionsAttachment(text)) {
      return NextResponse.json(
        {
          error:
            "You mentioned an attachment — attach a file before sending.",
        },
        { status: 400 }
      );
    }
    const draftId = body.draftId ? String(body.draftId) : "";
    const result = await sendGmailMessage({
      to,
      cc: body.cc ? String(body.cc) : undefined,
      bcc: body.bcc ? String(body.bcc) : undefined,
      subject,
      body: text || " ",
      threadId: body.threadId ? String(body.threadId) : undefined,
      inReplyTo: body.inReplyTo ? String(body.inReplyTo) : undefined,
      references: body.references ? String(body.references) : undefined,
      attachments,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (draftId) {
      await deleteGmailDraft(client, draftId).catch(() => null);
    }
    const threadId = result.threadId || (body.threadId ? String(body.threadId) : undefined);
    let email = null;
    if (threadId) {
      // Brief pause so Gmail indexes the sent message into the thread
      await new Promise((r) => setTimeout(r, 400));
      email = await fetchGmailThread(client, threadId).catch(() => null);
      if (email) email = withInboxBucket(email);
    }
    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      threadId,
      email,
    });
  }

  const threadId = String(body.threadId ?? "").trim();
  const allowed: GmailThreadAction[] = [
    "star",
    "unstar",
    "archive",
    "trash",
    "mark_read",
    "mark_unread",
  ];
  if (!threadId || !allowed.includes(action as GmailThreadAction)) {
    return NextResponse.json(
      { error: "threadId and a valid action are required" },
      { status: 400 }
    );
  }

  const result = await modifyGmailThread(client, threadId, action as GmailThreadAction);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, action, threadId });
}
