import type { Email } from "@/types";

/** Inbox sort: unread → urgent → important → needs reply → normal → promotional, newest first within each group. */
export function sortEmails(emails: Email[]): Email[] {
  const rank = (e: Email): number => {
    if (!e.isRead) {
      if (e.category === "urgent") return 0;
      if (e.category === "important" || e.isImportant) return 1;
      if (e.needsReply) return 2;
      if (e.category === "promotional") return 5;
      return 3;
    }
    if (e.category === "urgent") return 4;
    if (e.category === "important" || e.isImportant) return 6;
    if (e.needsReply) return 7;
    if (e.category === "promotional") return 9;
    return 8;
  };

  return [...emails].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });
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
