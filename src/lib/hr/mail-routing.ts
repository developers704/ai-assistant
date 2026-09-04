/** Defaults and parsers for HR warning / write-up test mail routing. */

export const DEFAULT_HR_MAIL_FROM = "umairj@valliani.app";
export const DEFAULT_HR_MAIL_TO = ["umairjam.arrakconsulting@gmail.com"];

export type HrMailRouting = {
  /** Single From mailbox — E-Mails must be signed in as this address. */
  from: string;
  /** One or more To recipients (test inboxes). */
  to: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function defaultHrMailRouting(): HrMailRouting {
  return { from: DEFAULT_HR_MAIL_FROM, to: [...DEFAULT_HR_MAIL_TO] };
}

export function isLikelyEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Split comma / semicolon / whitespace lists; keep first casing, skip junk. */
export function parseHrMailAddresses(raw: string | string[] | null | undefined): string[] {
  const chunks = Array.isArray(raw)
    ? raw.flatMap((part) => String(part).split(/[\s,;]+/))
    : String(raw ?? "").split(/[\s,;]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of chunks) {
    const email = chunk.trim();
    if (!email || !isLikelyEmail(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export function formatHrMailTo(to: string[]): string {
  return to.join(", ");
}

export function normalizeHrMailRouting(input: {
  from?: string | null;
  to?: string | string[] | null;
} | null | undefined): HrMailRouting {
  const fromList = parseHrMailAddresses(input?.from);
  const to = parseHrMailAddresses(input?.to);
  return {
    from: fromList[0] ?? DEFAULT_HR_MAIL_FROM,
    to: to.length ? to : [...DEFAULT_HR_MAIL_TO],
  };
}

export function validateHrMailRoutingInput(input: {
  from?: string | null;
  to?: string | string[] | null;
}): { ok: true; routing: HrMailRouting } | { ok: false; error: string } {
  const fromList = parseHrMailAddresses(input.from);
  const to = parseHrMailAddresses(input.to);
  if (fromList.length !== 1) {
    return { ok: false, error: "From must be a single valid email" };
  }
  if (!to.length) {
    return { ok: false, error: "Add at least one valid To email" };
  }
  return { ok: true, routing: { from: fromList[0]!, to } };
}
