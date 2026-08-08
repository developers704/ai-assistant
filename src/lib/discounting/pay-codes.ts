import type { PaymentMethod } from "@/lib/inventory/types";

export type PayChannel = PaymentMethod | "unknown";

/** Canonical labels for UI. */
export const PAY_CHANNEL_LABELS: Record<PayChannel, string> = {
  cash: "Cash",
  credit_card: "Credit Card",
  financing: "Financing (Synchrony / Wells / IdDeal / Flex)",
  lease: "Lease (Progressive / Acima / UOwn / Kafene)",
  affirm: "Affirm",
  unknown: "Unknown",
};

function norm(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9 ]/g, "");
}

const EXACT: Record<string, PayChannel> = {
  CASH: "cash",
  CC: "credit_card",
  // Lease group (calculator 5%)
  PROG: "lease",
  PROGR: "lease",
  PROGRE: "lease",
  PROGRES: "lease",
  PROGRESSIVE: "lease",
  ACIM: "lease",
  ACIMA: "lease",
  UOWN: "lease",
  "U OWN": "lease",
  KAFE: "lease",
  KAFENE: "lease",
  // Affirm (do not put ACIMA here)
  AFF: "affirm",
  AFFIR: "affirm",
  AFFIRM: "affirm",
  AFFR: "affirm",
  AFIRM: "affirm",
  // Financing / bank / private label
  WELL: "financing",
  WELLS: "financing",
  WELS: "financing",
  "WELLS FARGO": "financing",
  WELLSFARGO: "financing",
  IDEA: "financing",
  IDEAL: "financing",
  IDDEAL: "financing",
  SYCHY: "financing",
  SYNC: "financing",
  SYNCH: "financing",
  SYNCHRONY: "financing",
  SYNCY: "financing",
  SYNY: "financing",
  // POS short code for Synchrony (e.g. GM-GE, VJF-GE)
  GE: "financing",
  FLEX: "financing",
  "FLEX PAY": "financing",
  FLEXPAY: "financing",
};

/**
 * POS often stores `STORE-METHOD` or `STORE - METHOD` (e.g. `VJO-CASH`, `BB - CC`).
 * V1: use the token after the last hyphen. Bare codes (`CASH`) stay as-is.
 */
function extractMethodToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const dash = trimmed.lastIndexOf("-");
  if (dash < 0) return trimmed;
  const suffix = trimmed.slice(dash + 1).trim();
  return suffix || trimmed;
}

function mapToken(token: string): PayChannel {
  const n = norm(token);
  if (!n) return "unknown";
  if (EXACT[n]) return EXACT[n];
  const compact = n.replace(/\s+/g, "");
  if (EXACT[compact]) return EXACT[compact];
  if (compact.startsWith("PROG")) return "lease";
  if (compact.startsWith("WELL")) return "financing";
  if (compact.startsWith("AFF")) return "affirm";
  if (compact.startsWith("SYNC") || compact.startsWith("SYCH") || compact.startsWith("SYNY")) {
    return "financing";
  }
  if (compact.startsWith("IDEA") || compact.startsWith("IDDEAL")) return "financing";
  if (compact.startsWith("FLEX")) return "financing";
  if (compact.startsWith("KAFE")) return "lease";
  if (compact.startsWith("ACIM")) return "lease";
  if (compact === "UOWN" || compact.startsWith("UOWN")) return "lease";
  // CORP-CHK leftovers, etc. — unknown until a later plan
  return "unknown";
}

/**
 * Map POS Pay Codes → calculator payment channel.
 *
 * V1 rules:
 * - Single code: take token after hyphen (`VJO-CASH` → cash, `BB - CC` → credit_card)
 * - Multiple codes (`VJF-CASH,VJF-CC`): ignore → unknown (split plan later)
 * - `GE` / `STORE-GE` → Synchrony financing
 */
export function normalizePayCode(raw?: string | null): PayChannel {
  if (!raw?.trim()) return "unknown";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "unknown";
  // ponytail: multi-tender ignored until split-weight plan
  if (parts.length > 1) return "unknown";
  return mapToken(extractMethodToken(parts[0]));
}
