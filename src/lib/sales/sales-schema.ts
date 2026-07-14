import type { SalesGroupBy, SalesMetric, SalesQueryInput } from "./sales-types";

/** Lightweight schema helpers for validating / defaulting SalesQueryInput. */

export const DEFAULT_METRICS: SalesMetric[] = [
  "net_sales",
  "gross_sales",
  "discounts",
  "units_sold",
  "transactions",
];

export const DEFAULT_INCLUDE: NonNullable<SalesQueryInput["include"]> = {
  summary: true,
  breakdown: true,
  topStores: true,
  lowestStores: true,
  topDepartments: true,
  topDesigns: true,
  topVendors: true,
  topClasses: true,
  topProducts: true,
  topVendorModels: true,
};

export function emptyFilters() {
  return {
    stores: [] as string[],
    cities: [] as string[],
    states: [] as string[],
    regions: [] as string[],
    departments: [] as string[],
    designs: [] as string[],
    vendors: [] as string[],
    classes: [] as string[],
    products: [] as string[],
    skus: [] as string[],
    vendorModels: [] as string[],
  };
}

export function normalizeGroupBy(raw?: SalesGroupBy[]): SalesGroupBy[] {
  if (!raw?.length) return [];
  return [...new Set(raw)];
}

export function normalizeMetrics(raw?: SalesMetric[]): SalesMetric[] {
  if (!raw?.length) return [...DEFAULT_METRICS];
  return [...new Set(raw)];
}

export function wantsShow(message?: string): boolean {
  if (!message) return false;
  return /\b(show|dikhao|dikha|open|kholo|display|pull up)\b/i.test(message);
}

export function wantsTellOnly(message?: string): boolean {
  if (!message) return false;
  if (wantsShow(message) && /\b(and explain|aur batao|batao aur)\b/i.test(message)) return false;
  return /\b(tell me|batao|bata|what (?:are|is|was)|kitni|kitna|how (?:much|many))\b/i.test(message)
    && !/\b(show|dikhao|open|kholo)\b/i.test(message);
}

/** Boss wants a spoken overview (explain / discuss / summary / how much). */
export function wantsSalesExplain(message?: string): boolean {
  if (!message) return false;
  return /\b(explain|discuss|summarize|summary|overview|break(?:\s|-)?down|tell me(?:\s+about)?|batao|how (?:much|many)|what (?:are|is|was)|kitn[ai]|walk me through)\b/i.test(
    message
  );
}

/**
 * Show/open filtered sales on the dashboard — navigate only, no spoken summary
 * (unless they also asked to explain).
 */
export function wantsSalesShowOnly(message?: string): boolean {
  if (!message) return false;
  if (/\b(and explain|and discuss|aur batao|explain (?:it|this|that)|discuss (?:it|this))\b/i.test(message)) {
    return false;
  }
  if (wantsSalesExplain(message) && !wantsShow(message)) return false;
  if (wantsSalesExplain(message) && wantsShow(message)) return false;
  return wantsShow(message) || /\b(pull up|display|filter (?:to|by))\b/i.test(message);
}
