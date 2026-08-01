import type { Contact, Email } from "@/types";

export type EmailRecipientSuggestion = {
  email: string;
  name?: string;
};

const STORAGE_KEY = "alexa-email-recipient-suggest";
const MAX_STORED = 400;

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Parse `Name <email@x.com>` or bare address. */
export function parseAddressPart(raw: string): EmailRecipientSuggestion | null {
  const s = raw.trim();
  if (!s) return null;
  const angled = s.match(/^(.*?)\s*<([^>]+)>$/);
  if (angled) {
    const email = angled[2].trim();
    if (!EMAIL_RE.test(email)) return null;
    const name = angled[1].replace(/"/g, "").trim();
    return { email: normalizeEmail(email), name: name || undefined };
  }
  const bare = s.match(EMAIL_RE);
  if (!bare) return null;
  return { email: normalizeEmail(bare[0]) };
}

function addFromHeader(
  map: Map<string, EmailRecipientSuggestion>,
  header?: string
) {
  if (!header?.trim()) return;
  for (const part of header.split(/[,;]/)) {
    const parsed = parseAddressPart(part);
    if (!parsed) continue;
    const prev = map.get(parsed.email);
    if (!prev || (!prev.name && parsed.name)) {
      map.set(parsed.email, parsed);
    }
  }
}

export function collectRecipientsFromEmails(
  emails: Email[]
): EmailRecipientSuggestion[] {
  const map = new Map<string, EmailRecipientSuggestion>();
  for (const e of emails) {
    if (e.fromEmail && EMAIL_RE.test(e.fromEmail)) {
      const email = normalizeEmail(e.fromEmail);
      const prev = map.get(email);
      if (!prev || (!prev.name && e.from)) {
        map.set(email, { email, name: e.from?.trim() || prev?.name });
      }
    }
    addFromHeader(map, e.to);
    addFromHeader(map, e.cc);
    addFromHeader(map, e.bcc);
    for (const m of e.threadMessages ?? []) {
      if (m.fromEmail && EMAIL_RE.test(m.fromEmail)) {
        const email = normalizeEmail(m.fromEmail);
        const prev = map.get(email);
        if (!prev || (!prev.name && m.from)) {
          map.set(email, { email, name: m.from?.trim() || prev?.name });
        }
      }
      addFromHeader(map, m.to);
      addFromHeader(map, m.cc);
      addFromHeader(map, m.bcc);
    }
  }
  return Array.from(map.values());
}

export function collectRecipientsFromContacts(
  contacts: Contact[]
): EmailRecipientSuggestion[] {
  const out: EmailRecipientSuggestion[] = [];
  for (const c of contacts) {
    if (!c.email || !EMAIL_RE.test(c.email)) continue;
    out.push({
      email: normalizeEmail(c.email),
      name: c.name?.trim() || undefined,
    });
  }
  return out;
}

export function mergeRecipientSuggestions(
  ...lists: EmailRecipientSuggestion[][]
): EmailRecipientSuggestion[] {
  const map = new Map<string, EmailRecipientSuggestion>();
  for (const list of lists) {
    for (const s of list) {
      const email = normalizeEmail(s.email);
      if (!EMAIL_RE.test(email)) continue;
      const prev = map.get(email);
      if (!prev || (!prev.name && s.name)) {
        map.set(email, { email, name: s.name?.trim() || prev?.name });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.name || a.email).localeCompare(b.name || b.email)
  );
}

export function loadStoredRecipients(): EmailRecipientSuggestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EmailRecipientSuggestion[];
    if (!Array.isArray(parsed)) return [];
    return mergeRecipientSuggestions(parsed);
  } catch {
    return [];
  }
}

export function rememberRecipients(list: EmailRecipientSuggestion[]) {
  if (typeof window === "undefined" || !list.length) return;
  const merged = mergeRecipientSuggestions(loadStoredRecipients(), list).slice(
    0,
    MAX_STORED
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // quota
  }
}

export function filterRecipientSuggestions(
  all: EmailRecipientSuggestion[],
  query: string,
  excludeEmails: string[],
  limit = 8
): EmailRecipientSuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const excluded = new Set(excludeEmails.map(normalizeEmail));
  return all
    .filter((s) => {
      if (excluded.has(s.email)) return false;
      if (s.email.includes(q)) return true;
      if (s.name?.toLowerCase().includes(q)) return true;
      return false;
    })
    .slice(0, limit);
}

export function formatRecipientChip(s: EmailRecipientSuggestion): string {
  if (s.name) return `${s.name} <${s.email}>`;
  return s.email;
}
