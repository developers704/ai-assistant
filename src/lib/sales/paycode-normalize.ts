/**
 * Canonical pay-method from POS Pay Code.
 *
 * POS stores `VJS-CASH`, `BB - CC`, `DBCST-IDEA`. Dashboard / filter / totals
 * use the token after the hyphen (CASH, CC, IDDEAL) — never the store prefix
 * (VJS, VJF, VJPB, VIS, …).
 *
 * Alias groups (same product, truncated POS names):
 *   ACIMA + ACIM → ACIMA
 *   AFFIRM + AFFR + AFRIM → AFFIRM
 *   IDEA + IDEAL + IDDEAL → IDDEAL
 *   PROG + PROGR + PROGRE + PROGRESSIVE → PROG
 *   SYNC + SYNY + Synchrony truncations (SYNCHRO, …) → SYNC
 *   WELLS + WELL + WELS + WELLS FARGO + WE → WELLS
 *
 * Applied at overlay parse so daily payment appends follow the same rule.
 */

/** Known store-only tokens (no method suffix). Never shown as a paycode. */
const STORE_PREFIX_ONLY = new Set([
  "VIS",
  "VJF",
  "VJPB",
  "VJS",
  "VJE",
  "VJL",
  "VJA",
  "VJM",
  "VJO",
  "VJR",
  "VJB",
  "VJI",
  "GM",
  "HD",
  "BB",
  "DB",
  "DES",
  "CORP",
]);

const ALIAS_TO_CANONICAL: Record<string, string> = {
  ACIM: "ACIMA",
  ACIMA: "ACIMA",
  AFFR: "AFFIRM",
  AFRIM: "AFFIRM",
  AFFIRM: "AFFIRM",
  IDEA: "IDDEAL",
  IDEAL: "IDDEAL",
  IDDEAL: "IDDEAL",
  PROG: "PROG",
  PROGR: "PROG",
  PROGRE: "PROG",
  PROGRESSIVE: "PROG",
  SYNC: "SYNC",
  SYNY: "SYNC",
  SYNCH: "SYNC",
  SYNCHY: "SYNC",
  SYNCY: "SYNC",
  SYCHY: "SYNC",
  SYNCHRONY: "SYNC",
  SYNCHRO: "SYNC",
  WELL: "WELLS",
  WELS: "WELLS",
  "WELLS FARGO": "WELLS",
  WELLS: "WELLS",
  WE: "WELLS",
};

/** Preferred filter order for the paycodes Umair called out. */
export const PAYCODE_FILTER_ORDER = [
  "CASH",
  "CC",
  "IDDEAL",
  "KAFE",
  "SYNC",
  "CHK",
  "FLEX",
  "GE",
  "PROG",
  "ACIMA",
  "AFFIRM",
  "WELLS",
] as const;

function isStorePrefixOnly(token: string): boolean {
  if (STORE_PREFIX_ONLY.has(token)) return true;
  // VJ + short store suffix with no method (VJLV, VJVIC, VJRE, …)
  return /^VJ[A-Z]{0,6}$/.test(token);
}

/**
 * `VJS-CASH` → `CASH`, `BB - CC` → `CC`, `DBCST-IDEA` → `IDDEAL`.
 * Empty / store-prefix-only → `""`.
 */
export function canonicalPaycode(raw: string | null | undefined): string {
  const cleaned = String(raw ?? "")
    .replace(/,+\s*$/, "")
    .trim();
  if (!cleaned) return "";

  const parts = cleaned.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  const methodRaw = parts.length >= 2 ? parts.slice(1).join("-") : parts[0] ?? "";
  const method = methodRaw.replace(/\s+/g, " ").toUpperCase();
  if (!method) return "";

  if (parts.length < 2 && isStorePrefixOnly(method)) return "";

  return ALIAS_TO_CANONICAL[method] ?? method;
}

/** Labels that must not appear in the Paycodes filter (POS truncations of a group). */
export function leakedPaycodeAliases(codes: string[]): string[] {
  return codes.filter((c) => {
    const canon = ALIAS_TO_CANONICAL[c];
    return Boolean(canon && canon !== c);
  });
}

export function canonicalizePaycodeList(codes: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of codes) {
    const k = canonicalPaycode(c);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** Filter-search: typing a POS truncation (AFFR, ACIM, WELS) still finds the canonical option. */
export function paycodeMatchesFilterQuery(canonical: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (canonical.toLowerCase().includes(q)) return true;
  for (const [alias, canon] of Object.entries(ALIAS_TO_CANONICAL)) {
    if (canon !== canonical) continue;
    if (alias.toLowerCase().includes(q)) return true;
  }
  return false;
}

export function sortPaycodeLabels(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const ia = (PAYCODE_FILTER_ORDER as readonly string[]).indexOf(a);
    const ib = (PAYCODE_FILTER_ORDER as readonly string[]).indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b);
  });
}
