import type { AppState } from "@/types";

const RECIPIENT_STOP_WORDS = new Set(["to", "the", "my", "an", "a", "inbox", "summary", "unread"]);

const EMAIL_TO_PERSON =
  /\b(?:send|write|draft|compose)\b[\s\S]{0,35}\b(?:an?\s+)?(?:email|mail)\b[\s\S]{0,12}\bto\s+([A-Za-z][A-Za-z'-]*)/i;

const EMAIL_TO_NAME = /\b(?:email|mail)\s+to\s+([A-Za-z][A-Za-z'-]*)/i;

const EMAIL_NAME =
  /\b(?:email|mail)\s+(?!to\s|my\s|the\s|inbox|summary|unread\b)([A-Za-z][A-Za-z'-]+)/i;

const HAS_BODY =
  /\b(say|saying|about|regarding|message\s*:|body\s*:|subject\s*:|that\s+the|to\s+let\s+them|informing)\b/i;

function cleanRecipient(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const name = raw.trim();
  if (RECIPIENT_STOP_WORDS.has(name.toLowerCase())) return null;
  return name;
}

export function parseEmailRecipient(message: string): string | null {
  for (const pattern of [EMAIL_TO_PERSON, EMAIL_TO_NAME, EMAIL_NAME]) {
    const match = message.match(pattern);
    const name = cleanRecipient(match?.[1]);
    if (name) return name;
  }
  return null;
}

export function isComposeEmailToPerson(message: string): boolean {
  return !!parseEmailRecipient(message);
}

export function composeEmailHasBody(message: string): boolean {
  return HAS_BODY.test(message);
}

export function resolveContactName(name: string, state: AppState): string {
  const q = name.toLowerCase();
  const contact = state.contacts.find(
    (c) =>
      c.name.toLowerCase() === q ||
      c.name.toLowerCase().startsWith(q) ||
      q.startsWith(c.name.toLowerCase().split(" ")[0] ?? "")
  );
  return contact?.name ?? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export function buildComposeEmailPrompt(message: string, state: AppState): string {
  const recipient = resolveContactName(parseEmailRecipient(message) ?? "them", state);
  return `I can draft an email to **${recipient}**. What should the message say?`;
}
