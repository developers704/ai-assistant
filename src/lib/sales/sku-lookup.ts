import type { VendorPosRow } from "@/lib/reports/types";

export type SalesLookupMatchType = "sku" | "vendorModel" | "style";

export function normalizeSalesLookupKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ");
}

/**
 * Resolve which rows a SKU / model lookup should aggregate.
 *
 * Priority (must stay aligned with Top Vendor Models):
 * 1. Exact SKU / Item # — one POS item
 * 2. Exact Vendor Model — same grain as Top Vendor Models (all styles/SKUs under the model)
 * 3. Exact Style # — only when the query is not also a vendor model name
 *
 * Style often reuses the vendor-model string (e.g. MV067-SL vs MV067-SL-1 vermeil).
 * Preferring style over model under-counts vs Top 20.
 */
export function resolveSalesLookupRows(
  allRows: VendorPosRow[],
  query: string
): { matchRows: VendorPosRow[]; matchType: SalesLookupMatchType } {
  const needle = normalizeSalesLookupKey(query);
  if (!needle) return { matchRows: [], matchType: "sku" };

  const bySku = allRows.filter((r) => {
    const sku = normalizeSalesLookupKey(r.sku || "");
    const item = normalizeSalesLookupKey(r.itemNumber || "");
    return sku === needle || item === needle;
  });
  if (bySku.length) return { matchRows: bySku, matchType: "sku" };

  const byModel = allRows.filter(
    (r) => normalizeSalesLookupKey(r.vendorModel || "") === needle
  );
  if (byModel.length) return { matchRows: byModel, matchType: "vendorModel" };

  const byStyle = allRows.filter(
    (r) => normalizeSalesLookupKey(r.style || "") === needle
  );
  if (byStyle.length) return { matchRows: byStyle, matchType: "style" };

  return { matchRows: [], matchType: "sku" };
}

export type SalesLookupVariant = {
  sku: string;
  style: string | null;
  description: string | null;
  units: number;
  revenue: number;
  cost: number;
};

/** Break a model-level match into per-SKU lines (e.g. 231624S vs 231624V). */
export function groupSalesLookupVariants(rows: VendorPosRow[]): SalesLookupVariant[] {
  const map = new Map<string, SalesLookupVariant>();
  for (const r of rows) {
    const sku = (r.sku || r.itemNumber || r.style || "—").trim() || "—";
    const cur = map.get(sku) ?? {
      sku,
      style: r.style?.trim() || null,
      description: r.description?.trim() || null,
      units: 0,
      revenue: 0,
      cost: 0,
    };
    cur.units += r.quantity;
    cur.revenue += r.netRevenue;
    cur.cost += r.inventoryCost;
    if (!cur.style && r.style?.trim()) cur.style = r.style.trim();
    if (!cur.description && r.description?.trim()) cur.description = r.description.trim();
    map.set(sku, cur);
  }
  return [...map.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}
