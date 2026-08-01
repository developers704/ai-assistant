import type { AppState, Contact, Email } from "@/types";
import {
  collectRecipientsFromContacts,
  collectRecipientsFromEmails,
  mergeRecipientSuggestions,
  normalizeEmail,
  type EmailRecipientSuggestion,
} from "@/lib/email-recipients";

const RECIPIENT_STOP_WORDS = new Set([
  "to",
  "the",
  "my",
  "an",
  "a",
  "inbox",
  "summary",
  "unread",
  "him",
  "her",
  "them",
  "someone",
]);

const NAME_STOP = new Set([
  "about",
  "regarding",
  "saying",
  "that",
  "to",
  "for",
  "re",
  "and",
  "with",
  "please",
]);

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

const HAS_BODY =
  /\b(say|saying|about|regarding|message\s*:|body\s*:|subject\s*:|that\s+the|to\s+let\s+them|informing|attend|meeting|tomorrow|today)\b/i;

function extractNameTokens(rest: string): string | null {
  const words = rest.trim().split(/\s+/);
  const nameWords: string[] = [];
  for (const w of words) {
    const clean = w.replace(/[.,!?;:]+$/g, "");
    if (!clean || NAME_STOP.has(clean.toLowerCase())) break;
    if (EMAIL_RE.test(clean)) break;
    if (!/^[A-Za-z][A-Za-z'.-]*$/.test(clean)) break;
    nameWords.push(clean);
    if (nameWords.length >= 4) break;
  }
  if (!nameWords.length) return null;
  const name = nameWords.join(" ");
  if (RECIPIENT_STOP_WORDS.has(name.toLowerCase())) return null;
  return name;
}

/** Recipient as spoken name or email address. */
export function parseEmailRecipient(message: string): string | null {
  const addrAfterVerb = message.match(
    /\b(?:send|write|draft|compose|email|mail)\b[\s\S]{0,60}?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i
  );
  if (addrAfterVerb?.[1]) return normalizeEmail(addrAfterVerb[1]);

  const addrAfterTo = message.match(
    /\bto\s+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i
  );
  if (addrAfterTo?.[1]) return normalizeEmail(addrAfterTo[1]);

  const toMail = message.match(
    /\b(?:send|write|draft|compose)\b[\s\S]{0,40}\b(?:an?\s+)?(?:email|mail)\b[\s\S]{0,16}\bto\s+(.+)/i
  );
  if (toMail?.[1]) {
    const name = extractNameTokens(toMail[1]);
    if (name) return name;
  }

  const emailTo = message.match(/\b(?:email|mail)\s+to\s+(.+)/i);
  if (emailTo?.[1]) {
    const name = extractNameTokens(emailTo[1]);
    if (name) return name;
  }

  const emailName = message.match(
    /\b(?:email|mail)\s+(?!to\s|my\s|the\s|inbox|summary|unread\b)(.+)/i
  );
  if (emailName?.[1]) {
    const name = extractNameTokens(emailName[1]);
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

/** Topic / intent for the new email body. */
export function parseComposeTopic(message: string): string | null {
  const about = message.match(/\b(?:about|regarding|saying)\s+(.+)/i);
  if (about?.[1]?.trim()) return about[1].trim().replace(/[.!?]+$/, "");

  const that = message.match(/\bthat\s+(.+)/i);
  if (that?.[1]?.trim()) return that[1].trim().replace(/[.!?]+$/, "");

  const recipient = parseEmailRecipient(message);
  if (!recipient) return null;
  // Strip leading send/email … to <recipient>
  let rest = message
    .replace(
      /\b(?:send|write|draft|compose)\b[\s\S]{0,40}\b(?:an?\s+)?(?:email|mail)\b[\s\S]{0,16}\bto\s+/i,
      ""
    )
    .replace(/\b(?:email|mail)\s+to\s+/i, "")
    .trim();
  if (rest.toLowerCase().startsWith(recipient.toLowerCase())) {
    rest = rest.slice(recipient.length).trim();
  }
  rest = rest.replace(/^(about|regarding|saying|that)\s+/i, "").trim();
  return rest || null;
}

export function resolveContactName(name: string, state: AppState): string {
  const q = name.toLowerCase();
  const contact = state.contacts.find(
    (c) =>
      c.name.toLowerCase() === q ||
      c.name.toLowerCase().startsWith(q) ||
      q.startsWith(c.name.toLowerCase().split(" ")[0] ?? "")
  );
  return contact?.name ?? name.charAt(0).toUpperCase() + name.slice(1);
}

export type ResolveRecipientResult =
  | { status: "ok"; email: string; name?: string }
  | { status: "ambiguous"; query: string; candidates: EmailRecipientSuggestion[] }
  | { status: "missing"; query: string };

export function resolveEmailRecipient(
  query: string,
  state: AppState,
  extraEmails: Email[] = []
): ResolveRecipientResult {
  const raw = query.trim();
  if (!raw) return { status: "missing", query: raw };

  const addr = raw.match(EMAIL_RE);
  if (addr && /^[^\s]+@[^\s]+$/.test(raw.replace(/[<>]/g, "").trim())) {
    return { status: "ok", email: normalizeEmail(addr[0]) };
  }
  if (addr && raw.includes("@")) {
    return { status: "ok", email: normalizeEmail(addr[0]) };
  }

  const pool = mergeRecipientSuggestions(
    collectRecipientsFromContacts(state.contacts as Contact[]),
    collectRecipientsFromEmails([...state.emails, ...extraEmails])
  );

  const ql = raw.toLowerCase();
  const exact = pool.filter(
    (s) =>
      s.name?.toLowerCase() === ql ||
      s.email === normalizeEmail(ql) ||
      s.name?.toLowerCase() === ql.replace(/\s+/g, " ")
  );
  if (exact.length === 1) {
    return { status: "ok", email: exact[0].email, name: exact[0].name };
  }

  const partial = pool.filter((s) => {
    const n = s.name?.toLowerCase() ?? "";
    if (n.includes(ql) || ql.includes(n)) return true;
    const parts = n.split(/\s+/);
    const qParts = ql.split(/\s+/);
    if (qParts.every((qp) => parts.some((p) => p.startsWith(qp)))) return true;
    if (s.email.includes(ql.replace(/\s+/g, "."))) return true;
    if (s.email.split("@")[0]?.includes(ql.replace(/\s+/g, ""))) return true;
    return false;
  });

  const starts = partial.filter((s) => s.name?.toLowerCase().startsWith(ql));
  const candidates = (starts.length ? starts : partial).slice(0, 5);

  if (candidates.length === 1) {
    return {
      status: "ok",
      email: candidates[0].email,
      name: candidates[0].name,
    };
  }
  if (candidates.length > 1) {
    return { status: "ambiguous", query: raw, candidates };
  }
  return { status: "missing", query: raw };
}

export function buildComposeEmailPrompt(message: string, state: AppState): string {
  const recipient = resolveContactName(
    parseEmailRecipient(message) ?? "them",
    state
  );
  return `I can draft an email to **${recipient}**. What should the message say?`;
}

export const VOICE_COMPOSE_STORAGE_KEY = "alexa-voice-compose";

export type VoiceComposePayload = {
  to: string;
  subject: string;
  body: string;
  toName?: string;
};
