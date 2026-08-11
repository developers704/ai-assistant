import { lookupInventory } from "@/lib/inventory/store";
import type { VendorPosRow } from "@/lib/reports/types";

/** Calculator / price-list Whole Cost for a SKU (raw; not Tag÷1.3). */
export function calculatorWholesaleUnitCost(
  sku: string,
  store?: string | null
): number | null {
  const hit = lookupInventory(sku, store);
  const w = Number(hit?.item?.wholesaleCost);
  return Number.isFinite(w) && w > 0 ? w : null;
}

/**
 * Top Vendor Models margin from calculator Whole Cost.
 * Per sale line: profit = revenue − Whole Cost (qty ignored — owner rule).
 * If any SKU on the model lacks Whole Cost → hide margin (null).
 */
export function wholesaleProfitForModelRows(rows: VendorPosRow[]): {
  profit: number | null;
  marginRate: number | null;
} {
  if (!rows.length) return { profit: null, marginRate: null };

  let profit = 0;
  let revenue = 0;

  for (const r of rows) {
    const sku = (r.sku || r.itemNumber || "").trim();
    if (!sku) return { profit: null, marginRate: null };
    const cost = calculatorWholesaleUnitCost(sku, r.storeName);
    if (cost == null) return { profit: null, marginRate: null };
    revenue += r.netRevenue;
    profit += r.netRevenue - cost;
  }

  return {
    profit,
    marginRate: revenue > 0 ? profit / revenue : null,
  };
}

export function vendorModelGroupKey(row: VendorPosRow): string {
  return row.vendorModel || row.sku || row.itemNumber || "Unknown model";
}
