import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/google/client";
import { isGoogleConnected } from "@/lib/google/token-store";
import {
  fetchGmailThread,
  fetchRecentSentSnippets,
} from "@/lib/google/gmail";
import {
  buildStyleCardFromSent,
  generateSmartEmailReply,
  type DraftMode,
  type RewriteTone,
} from "@/lib/voice/email-draft";
import { getState } from "@/lib/store/server-store";
import { resolveEmailSignerFromSession } from "@/lib/auth/email-signer";
import type { Email } from "@/types";

let styleCache: { card: string; at: number } | null = null;
const STYLE_TTL_MS = 30 * 60 * 1000;

async function getStyleCard(): Promise<string> {
  if (styleCache && Date.now() - styleCache.at < STYLE_TTL_MS) {
    return styleCache.card;
  }
  if (!isGoogleConnected()) {
    return buildStyleCardFromSent([]);
  }
  const client = await getAuthenticatedClient();
  if (!client) return buildStyleCardFromSent([]);
  try {
    const snippets = await fetchRecentSentSnippets(client, 12);
    const card = buildStyleCardFromSent(snippets);
    styleCache = { card, at: Date.now() };
    return card;
  } catch {
    return buildStyleCardFromSent([]);
  }
}

function stubComposeEmail(subject: string, to: string): Email {
  return {
    id: "compose",
    threadId: "compose",
    from: "You",
    fromEmail: "",
    to,
    subject: subject || "(no subject)",
    preview: "",
    body: "",
    receivedAt: new Date().toISOString(),
    isImportant: false,
    isRead: true,
    needsReply: false,
    category: "normal",
    messageCount: 1,
  };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = (String(body.mode ?? "reply") as DraftMode) || "reply";
  const rewriteTone = body.rewriteTone
    ? (String(body.rewriteTone) as RewriteTone)
    : undefined;
  const existingDraft = body.existingDraft ? String(body.existingDraft) : undefined;
  const threadId = body.threadId ? String(body.threadId) : "";
  const emailId = body.emailId ? String(body.emailId) : "";
  const subjectHint = body.subject ? String(body.subject) : "";
  const toHint = body.to ? String(body.to) : "";

  const state = getState();
  // Signature = logged-in app user (AJ, Kash, Ross…), not mailbox IMAP login
  const signer = await resolveEmailSignerFromSession();

  let email: Email | null = null;

  if (threadId && isGoogleConnected()) {
    const client = await getAuthenticatedClient();
    if (client) {
      email = await fetchGmailThread(client, threadId);
    }
  }

  if (!email) {
    const fromState = state.emails.find(
      (e) => e.threadId === threadId || e.id === threadId || e.id === emailId
    );
    email = fromState ?? null;
  }

  if (!email && body.email && typeof body.email === "object") {
    email = body.email as Email;
  }

  // New message / rewrite without a thread — polish the user's rough draft
  const draftOnly =
    (mode === "polish" || mode === "rewrite") && !!existingDraft?.trim();
  if (!email && draftOnly) {
    email = stubComposeEmail(subjectHint, toHint);
  }

  if (!email) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (mode === "polish" && !existingDraft?.trim()) {
    return NextResponse.json(
      { error: "Write a rough message first, then use AI Draft" },
      { status: 400 }
    );
  }

  const styleCard = await getStyleCard();
  const draft = await generateSmartEmailReply(email, signer, {
    mode,
    rewriteTone,
    existingDraft,
    styleCard,
    recipients: toHint || email.to,
  });

  if (mode === "polish" || (mode === "rewrite" && !threadId)) {
    return NextResponse.json({
      draft,
      to: toHint || email.to || undefined,
      subject: subjectHint || email.subject,
    });
  }

  const latest =
    email.threadMessages?.[email.threadMessages.length - 1] ?? email;
  const subject = email.subject.toLowerCase().startsWith("re:")
    ? email.subject
    : `Re: ${email.subject}`;

  return NextResponse.json({
    draft,
    to: latest.fromEmail || email.fromEmail,
    subject,
    threadId: email.threadId,
    inReplyTo: latest.rfcMessageId,
    references: [latest.references, latest.rfcMessageId].filter(Boolean).join(" "),
  });
}
