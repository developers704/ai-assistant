import type { AppState } from "@/types";

const EMAIL_TO_PERSON =
  /\b(?:send|write|draft|compose)\b[\s\S]{0,35}\b(?:an?\s+)?(?:email|mail)\b[\s\S]{0,12}\bto\s+([A-Za-z][A-Za-z'-]*)/i;

const EMAIL_TO_ALT = /\bemail\s+([A-Za-z][A-Za-z'-]*)\b/i;

const HAS_BODY =
  /\b(say|saying|about|regarding|message\s*:|body\s*:|subject\s*:|that\s+the|to\s+let\s+them|informing)\b/i;

export function parseEmailRecipient(message: string): string | null {
  const m = message.match(EMAIL_TO_PERSON) ?? message.match(EMAIL_TO_ALT);
  return m?.[1]?.trim() ?? null;
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
