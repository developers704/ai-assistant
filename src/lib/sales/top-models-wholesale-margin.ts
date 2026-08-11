import { getVisibleDmCostPrice } from "@/lib/inventory/pricing";
import { lookupInventory } from "@/lib/inventory/store";
import { fixedWholeCostForSku, wholeCostFromRules } from "@/lib/inventory/whole-cost-rules";
import type { InventoryItem } from "@/lib/inventory/types";
import type { VendorPosRow } from "@/lib/reports/types";

export type SaleCostContext = Pick<
  VendorPosRow,
  "description" | "department" | "design" | "productClass" | "subClass" | "netRevenue"
> & {
  /** Sales Amount (pre-discount). Required for sales-side formula fallback. */
  grossSales?: number;
  wholesaleCost?: number;
};

/**
 * Merge sales-line fields onto inventory so calculator rules still fire when
 * on-hand class/desc is thin.
 */
function itemForCalculatorCost(
  item: InventoryItem,
  saleRow?: SaleCostContext
): InventoryItem {
  if (!saleRow) return item;
  const tagPrice =
    item.tagPrice > 0
      ? item.tagPrice
      : (saleRow.grossSales ?? 0) > 0
        ? saleRow.grossSales!
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
 * Wholesale unit cost for Top Vendor Models / calculator:
 * 0) Fixed SKU Whole Cost (owner list — everyone)
 * 1) Inventory Tag × CP Divisor sheet
 * 2) Else filled Whole Cost / Individual Cost
 * 3) Else Sales Amount × same sheet
 */
export function calculatorWholesaleUnitCost(
  sku: string,
  store?: string | null,
  saleRow?: SaleCostContext
): number | null {
  const fixed = fixedWholeCostForSku(sku);
  if (fixed != null) return fixed;

  const hit = lookupInventory(sku, store);
  if (hit?.item) {
    const merged = itemForCalculatorCost(hit.item, saleRow);
    const w = Number(getVisibleDmCostPrice(merged));
    if (Number.isFinite(w) && w > 0) return w;
  }

  if (saleRow) {
    const salesAmount = Number(saleRow.grossSales) || 0;
    if (salesAmount > 0) {
      const fromSales = wholeCostFromRules(
        {
          department: saleRow.department,
          design: saleRow.design,
          class: saleRow.productClass,
          subClass: saleRow.subClass,
          description: saleRow.description,
          sku,
        },
        salesAmount
      );
      if (fromSales != null && fromSales > 0) return fromSales;
    }
  }

  return null;
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
