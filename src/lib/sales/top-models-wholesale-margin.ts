import { getVisibleDmCostPrice } from "@/lib/inventory/pricing";
import { lookupInventory } from "@/lib/inventory/store";
import type { InventoryItem } from "@/lib/inventory/types";
import type { VendorPosRow } from "@/lib/reports/types";

/**
 * Merge sales-line fields onto inventory so calculator rules still fire when
 * on-hand class/desc is thin (e.g. Ultimate Value only on the POS description).
 */
function itemForCalculatorCost(
  item: InventoryItem,
  saleRow?: Pick<
    VendorPosRow,
    "description" | "department" | "design" | "productClass" | "subClass" | "netRevenue"
  >
): InventoryItem {
  if (!saleRow) return item;
  const tagPrice =
    item.tagPrice > 0
      ? item.tagPrice
      : saleRow.netRevenue > 0
        ? saleRow.netRevenue
        : 0;
  return {
    ...item,
    description: [item.description, saleRow.description].filter(Boolean).join(" "),
    department: item.department?.trim() ? item.department : saleRow.department || item.department,
    design: item.design?.trim() ? item.design : saleRow.design || item.design,
    class: item.class?.trim() ? item.class : saleRow.productClass || item.class,
    subClass: item.subClass?.trim() ? item.subClass : saleRow.subClass || item.subClass,
    tagPrice,
  };
}

/**
 * Same Cost Price the price calculator uses for wholesale / DM cost:
 * - Gold + UV / Ultimate Value → Tag ÷ 1.3
 * - Otherwise → inventory Whole Cost (fallback Individual Cost)
 */
export function calculatorWholesaleUnitCost(
  sku: string,
  store?: string | null,
  saleRow?: Pick<
    VendorPosRow,
    "description" | "department" | "design" | "productClass" | "subClass" | "netRevenue"
  >
): number | null {
  const hit = lookupInventory(sku, store);
  if (!hit?.item) return null;
  const w = Number(getVisibleDmCostPrice(itemForCalculatorCost(hit.item, saleRow)));
  return Number.isFinite(w) && w > 0 ? w : null;
}

/**
 * Top Vendor Models margin from calculator wholesale rules.
 * Per sale line: profit = revenue − cost (qty ignored — owner rule).
 * If any SKU lacks cost → hide margin (null).
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
    const cost = calculatorWholesaleUnitCost(sku, r.storeName, r);
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
