export type SalesFocus = "top_store" | "summary" | "full_report";

const TOP_STORE_PATTERNS = [
  /\b(best|top|highest|leading|#1|number\s*one)\b.*\b(store|location)\b/i,
  /\b(store|location)\b.*\b(best|top|highest|leading)\b/i,
  /\b(one|single)\s+store\b.*\b(top|sales|best|highest)\b/i,
  /\b(top|best)\s+store\b/i,
  /\bwhich\s+store\b.*\b(sales|revenue|best|top)\b/i,
];

const FULL_REPORT_PATTERNS = [
  /\b(full|complete|entire|detailed|everything)\b.*\b(report|summary|breakdown)\b/i,
  /\b(report|summary|breakdown)\b.*\b(full|complete|entire|detailed|all)\b/i,
  /\ball\s+(stores|products|locations)\b/i,
  /\bfull\s+sales\b/i,
];

/** Infer how much sales detail the user wants from their message. */
export function detectSalesFocus(message: string, routedIntent?: string): SalesFocus {
  const lower = message.toLowerCase().trim();

  if (routedIntent === "sales.top_store") return "top_store";

  if (FULL_REPORT_PATTERNS.some((p) => p.test(lower))) return "full_report";
  if (TOP_STORE_PATTERNS.some((p) => p.test(lower))) return "top_store";

  if (/\b(sales|revenue)\b/i.test(lower)) return "summary";

  return "summary";
}

export function isTopStoreSalesQuery(message: string): boolean {
  return TOP_STORE_PATTERNS.some((p) => p.test(message));
}
