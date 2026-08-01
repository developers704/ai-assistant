import type { Email, InboxBucket } from "@/types";

export type { InboxBucket };
export type MailFolder = "inbox" | "starred" | "sent";

const ASK_RE =
  /\?|\b(please|kindly|can you|could you|would you|let me know|need you to|looking for|confirm|asap|by eod|by end of)\b/i;

export function isLikelyAutomatedMail(from: string, subject: string): boolean {
  const text = `${from} ${subject}`.toLowerCase();
  return (
    /noreply|no-reply|donotreply|mailer-daemon|notification@|notifications@/.test(text) ||
    /order has been received|login details|password reset|verify your email|your receipt|unsubscribe|newsletter|wordpress/.test(
      text
    )
  );
}

function latestBody(email: Email): string {
  const msgs = email.threadMessages?.length ? email.threadMessages : [email];
  const last = msgs[msgs.length - 1];
  return `${last?.subject ?? ""} ${last?.preview ?? ""} ${last?.body ?? ""}`;
}

/** Fyxer-style bucket — no Meeting. */
export function deriveInboxBucket(email: Email): InboxBucket {
  if (email.inboxBucket) return email.inboxBucket;
  if (
    email.category === "promotional" ||
    isLikelyAutomatedMail(`${email.from} ${email.fromEmail}`, email.subject)
  ) {
    return "marketing";
  }
  if (email.needsReply || (!email.isRead && ASK_RE.test(latestBody(email)))) {
    return "to_respond";
  }
  if (ASK_RE.test(latestBody(email)) && !isLikelyAutomatedMail(email.fromEmail, email.subject)) {
    return "to_respond";
  }
  return "fyi";
}

export function withInboxBucket(email: Email): Email {
  const inboxBucket = deriveInboxBucket({ ...email, inboxBucket: undefined });
  return {
    ...email,
    inboxBucket,
    needsReply: inboxBucket === "to_respond" || email.needsReply,
  };
}

export function bucketLabel(bucket: InboxBucket): string {
  switch (bucket) {
    case "to_respond":
      return "To Respond";
    case "fyi":
      return "FYI";
    case "marketing":
      return "Marketing";
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
