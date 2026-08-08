/**
 * Parse POS Description approval / financing tokens.
 * Examples:
 *   FIN/WELLSFARGO/6/0
 *   APP AJ IDDEAL 36/0
 *   APP RM7/SM2
 *   APP/TL1
 */

const MONTHS = new Set([6, 12, 18, 24, 36, 48, 60]);

export type ApprovalParse = {
  /** Codes found after APP (e.g. AJ, SM2, TL1, RM7) */
  approverCodes: string[];
  financingMonths: number | null;
  /** Raw FIN/APP fragments for UI */
  rawHits: string[];
};

function uniq(codes: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of codes) {
    const k = c.toUpperCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function extractMonths(text: string): number | null {
  // .../36/0 or "36/0" or "/6/"
  const slash = text.match(/(?:^|[/\s])(6|12|18|24|36|48|60)(?:\/|\s|$)/);
  if (slash) {
    const n = Number(slash[1]);
    if (MONTHS.has(n)) return n;
  }
  return null;
}

/** Codes that look like salesperson/approver tokens, not program names. */
function looksLikeApproverCode(tok: string): boolean {
  const t = tok.toUpperCase();
  if (!t || t.length > 12) return false;
  // Reject known pay programs
  if (
    /^(WELLS|WELLSFARGO|IDDEAL|IDEAL|IDEA|SYNCHRONY|SYNC|SYCHY|FLEX|FLEXPAY|PROG|PROGRESSIVE|ACIMA|ACIM|UOWN|KAFENE|KAFE|AFFIRM|AFF|CASH|CC)$/i.test(
      t
    )
  ) {
    return false;
  }
  // Typical POS codes: letters + optional digits (AJ, SM2, TL1, RM7, AJ-MOD)
  return /^[A-Z]{1,4}\d{0,3}(-\w+)?$/i.test(t);
}

/**
 * Pull APP / FIN signals from one or more description strings (same txn).
 */
export function parseApprovalFromDescriptions(descriptions: string[]): ApprovalParse {
  const approverCodes: string[] = [];
  const rawHits: string[] = [];
  let financingMonths: number | null = null;

  for (const raw of descriptions) {
    const desc = String(raw ?? "").trim();
    if (!desc) continue;
    const upper = desc.toUpperCase();

    if (/\bAPP\b|\bFIN\b|^APP\/|^FIN\//i.test(upper)) {
      rawHits.push(desc);
    }

    const months = extractMonths(upper);
    if (months != null && financingMonths == null) financingMonths = months;

    // APP AJ IDDEAL 36/0  |  APP RM7/SM2  |  APP/TL1
    const appMatch = upper.match(/\bAPP\b[/\s:-]*(.+)$/i);
    if (appMatch) {
      const rest = appMatch[1]
        .replace(/\//g, " ")
        .replace(/-/g, "-")
        .trim();
      const tokens = rest.split(/[\s,]+/).filter(Boolean);
      for (const tok of tokens) {
        const clean = tok.replace(/[^A-Z0-9-]/gi, "");
        if (looksLikeApproverCode(clean)) approverCodes.push(clean.toUpperCase());
      }
    }

    // Slash forms without space: APP/TL1
    const appSlash = upper.match(/\bAPP\/([A-Z0-9-]+)/i);
    if (appSlash && looksLikeApproverCode(appSlash[1])) {
      approverCodes.push(appSlash[1].toUpperCase());
    }
  }

  return {
    approverCodes: uniq(approverCodes),
    financingMonths,
    rawHits: [...new Set(rawHits)],
  };
}
