import type { Email } from "@/types";
import {
  displayName,
  sortThreadOldestFirst,
  stripQuotedTail,
  type MailMessage,
} from "@/lib/valliani-mail/types";
import { htmlToPlain } from "@/lib/valliani-mail/compose-html";

function mailPartToEmail(m: MailMessage, threadId: string): Email {
  const from = m.from[0];
  const body =
    stripQuotedTail(m.bodyText || m.preview) ||
    htmlToPlain(m.bodyHtml) ||
    m.preview;
  return {
    id: `${m.sourceFolder || "f"}-${m.uid}`,
    threadId,
    from: from ? displayName(from) : "Unknown",
    fromEmail: from?.address || "",
    to: m.to.map((a) => a.address || displayName(a)).filter(Boolean).join(", "),
    cc: m.cc.map((a) => a.address || displayName(a)).filter(Boolean).join(", "),
    subject: m.subject,
    preview: m.preview,
    body,
    bodyHtml: m.bodyHtml || undefined,
    receivedAt: m.date || new Date().toISOString(),
    isImportant: false,
    isRead: true,
    needsReply: true,
    category: "normal",
    rfcMessageId: m.messageId || undefined,
    inReplyTo: m.inReplyTo || undefined,
    references: m.references?.length ? m.references.join(" ") : undefined,
  };
}

/** Build a Gmail-shaped Email so /api/email/draft can draft from IMAP threads. */
export function mailThreadToDraftEmail(
  seed: MailMessage,
  thread: MailMessage[] = []
): Email {
  const msgs = sortThreadOldestFirst(
    thread.length ? thread : [seed]
  );
  const threadId = `valliani-${seed.messageId || seed.uid}`;
  const parts = msgs.map((m) => mailPartToEmail(m, threadId));
  const latest = parts[parts.length - 1]!;
  return {
    ...latest,
    threadId,
    threadMessages: parts,
    messageCount: parts.length,
  };
}

export type AiRewriteTone = "shorter" | "formal" | "casual" | "regenerate";

export async function requestEmailAiDraft(input: {
  mode: "reply" | "followup" | "rewrite" | "polish";
  existingDraft?: string;
  rewriteTone?: AiRewriteTone;
  subject?: string;
  to?: string;
  email?: Email;
}): Promise<{ draft: string; subject?: string; to?: string }> {
  const res = await fetch("/api/email/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    draft?: string;
    subject?: string;
    to?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || "Draft failed");
  if (!data.draft?.trim()) throw new Error("Draft failed");
  return {
    draft: data.draft,
    subject: data.subject,
    to: data.to,
  };
}
