import type { Email } from "@/types";

/**
 * True when the body talks about attaching a *file* (not “attached to someone”).
 * Used to block Send when no file is attached.
 */
export function bodyMentionsAttachment(body: string): boolean {
  let t = body.replace(/\s+/g, " ").trim();
  if (!t) return false;

  // Figurative / relationship: "I am attached to her" — not a file
  t = t.replace(
    /\b((?:i\s+)?(?:am|'m)|is|are|was|were|feel(?:ing)?|very|so)\s+attached\s+to\b/gi,
    " "
  );
  t = t.replace(
    /\battached\s+to\s+(her|him|me|you|them|us|someone|somebody|people)\b/gi,
    " "
  );

  if (/\battachments?\b/i.test(t)) return true;
  if (/\bp\.?\s*f\.?\s*a\.?\b/i.test(t)) return true;
  if (/\benclos(ed|ing)\b/i.test(t)) return true;
  if (/\b(please|pls)\s+find\b.{0,28}\b(attach|enclos)/i.test(t)) return true;
  if (/\b(see|find)\s+(the\s+)?attach(ed|ment)/i.test(t)) return true;
  if (/\b(i(?:'ve|\s+have)?|we(?:'ve|\s+have)?)\s+attach(ed|ing)\b/i.test(t)) {
    return true;
  }
  if (
    /\battach(ed|ing)\s+(a|an|the|this|my|our|here|below|above|as)\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\battach(ed|ing)\s+(file|doc|document|pdf|sheet|spreadsheet|csv|xlsx|zip|image|photo|report)\b/i.test(
      t
    )
  ) {
    return true;
  }
  if (
    /\b(file|doc(?:ument)?s?|sheet|spreadsheet|pdf|csv|xlsx)\b.{0,28}\b(attach|enclos|as below|as bellow)\b/i.test(
      t
    )
  ) {
    return true;
  }
  if (/\battach\s+(a\s+|the\s+)?(file|doc|document|pdf|sheet)\b/i.test(t)) {
    return true;
  }

  return false;
}

/** Newest threads first (Gmail-style). Used for inbox, sent, drafts, and triage buckets. */
export function sortEmails(emails: Email[]): Email[] {
  const ts = (e: Email) => {
    const n = new Date(e.receivedAt).getTime();
    return Number.isFinite(n) ? n : 0;
  };
  return [...emails].sort((a, b) => ts(b) - ts(a));
}

/** @deprecated alias — same as sortEmails (newest first). */
export function sortEmailsByPriority(emails: Email[]): Email[] {
  return sortEmails(emails);
}

export function findEmailByContext(
  emails: Email[],
  fromHint?: string,
  subjectHint?: string
): Email | undefined {
  const from = fromHint?.toLowerCase().trim();
  const subject = subjectHint?.toLowerCase().trim();

  if (from && subject) {
    const exact = emails.find(
      (e) =>
        e.from.toLowerCase().includes(from) &&
        e.subject.toLowerCase().includes(subject)
    );
    if (exact) return exact;
  }

  if (subject) {
    const bySubject = emails.find((e) => e.subject.toLowerCase().includes(subject));
    if (bySubject) return bySubject;
  }

  if (from) {
    return emails.find(
      (e) =>
        e.from.toLowerCase().includes(from) ||
        e.fromEmail.toLowerCase().includes(from)
    );
  }

  return undefined;
}

/** Parse "draft a reply to X about Y" from user chat text. */
export function parseReplyTargetFromMessage(message: string): {
  from?: string;
  subject?: string;
} {
  const replyMatch = message.match(
    /(?:draft a reply to|reply to|draft.*?to)\s+(.+?)(?:\s+about\s+(.+))?$/i
  );
  if (replyMatch) {
    return {
      from: replyMatch[1]?.replace(/["']/g, "").trim(),
      subject: replyMatch[2]?.replace(/["']/g, "").trim(),
    };
  }

  const toMatch = message.match(/(?:email|to)\s+([A-Za-z\s]+?)(?:\s+about|\s+regarding|$)/i);
  return { from: toMatch?.[1]?.trim() };
}

export function formatEmailDraftChatMessage(pending: {
  title: string;
  preview: string;
  payload: Record<string, unknown>;
}): string {
  const toName = String(pending.payload.to_name ?? pending.payload.to ?? "recipient");
  const to = String(pending.payload.to ?? "");
  const subject = String(pending.payload.subject ?? "");
  return `I've drafted a reply for your review.

**To:** ${toName}${to ? ` (${to})` : ""}
**Subject:** ${subject}

---
${pending.preview}
---

Tap **Send email** below to send, or say **yes** in chat.`;
}
