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
    const salesAmount = Math.abs(Number(saleRow.grossSales) || 0);
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
 * Unit cost with sign: sales subtract cost, returns add it back
 * (sale R−C then return −R+C → net 0). Qty ignored for magnitude.
 */
export function signedWholesaleUnitCost(
  unitCost: number,
  row: Pick<VendorPosRow, "quantity" | "netRevenue" | "grossSales">
): number {
  const qty = Number(row.quantity ?? 0);
  if (qty < 0) return -unitCost;
  if (qty > 0) return unitCost;
  const net = Number(row.netRevenue ?? 0);
  if (net < 0) return -unitCost;
  const gross = Number(row.grossSales ?? 0);
  if (gross < 0) return -unitCost;
  return unitCost;
}

/** Bump when Top Models cancel / margin logic changes (forces snapshot refresh). */
export const TOP_MODELS_MARGIN_RULES_VERSION = 1;

function absAmountCents(row: Pick<VendorPosRow, "netRevenue" | "grossSales">): number {
  const net = Number(row.netRevenue ?? 0);
  if (net !== 0) return Math.round(Math.abs(net) * 100);
  return Math.round(Math.abs(Number(row.grossSales ?? 0)) * 100);
}

function isReturnish(row: Pick<VendorPosRow, "quantity" | "netRevenue" | "grossSales">): boolean {
  const qty = Number(row.quantity ?? 0);
  if (qty < 0) return true;
  if (Number(row.netRevenue ?? 0) < 0) return true;
  if (Number(row.grossSales ?? 0) < 0) return true;
  return false;
}

function isSaleish(row: Pick<VendorPosRow, "quantity" | "netRevenue" | "grossSales">): boolean {
  if (isReturnish(row)) return false;
  const qty = Number(row.quantity ?? 0);
  const net = Number(row.netRevenue ?? 0);
  const gross = Number(row.grossSales ?? 0);
  return qty > 0 || net > 0 || gross > 0;
}

function cancelPairKey(
  row: Pick<VendorPosRow, "storeName" | "date" | "sku" | "itemNumber" | "netRevenue" | "grossSales">
): string | null {
  const store = (row.storeName ?? "").trim().toLowerCase();
  if (!store) return null;
  const sku = (row.sku || row.itemNumber || "").trim().toUpperCase();
  if (!sku) return null;
  const amount = absAmountCents(row);
  if (!(amount > 0)) return null;
  const date = (row.date ?? "").trim().slice(0, 10);
  return `${store}|${date}|${sku}|${amount}`;
}

/**
 * Within one vendor-model / product group: drop matching sale↔return legs
 * (same store, calendar date, SKU, abs net). Does NOT change store Net Sales —
 * only product rankings / Top Vendor Models / model detail.
 */
export function collapseCancelledSkuLegs<T extends VendorPosRow>(rows: T[]): T[] {
  if (rows.length < 2) return rows;

  const drop = new Set<number>();
  const saleIndex = new Map<string, number[]>();
  for (let j = 0; j < rows.length; j++) {
    if (!isSaleish(rows[j])) continue;
    const key = cancelPairKey(rows[j]);
    if (!key) continue;
    const list = saleIndex.get(key);
    if (list) list.push(j);
    else saleIndex.set(key, [j]);
  }

  const usedPositive = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    if (drop.has(i) || !isReturnish(rows[i])) continue;
    const key = cancelPairKey(rows[i]);
    if (!key) continue;
    for (const j of saleIndex.get(key) ?? []) {
      if (j === i || drop.has(j) || usedPositive.has(j)) continue;
      if (!isSaleish(rows[j])) continue;
      const absNeg = Math.abs(Number(rows[i].quantity ?? 0));
      const absPos = Math.abs(Number(rows[j].quantity ?? 0));
      if (absNeg > 0 && absPos > 0 && absNeg !== absPos) continue;
      drop.add(i);
      drop.add(j);
      usedPositive.add(j);
      break;
    }
  }

  if (!drop.size) return rows;
  return rows.filter((_, idx) => !drop.has(idx));
}

/**
 * Top Vendor Models margin from calculator wholesale rules.
 * Collapses cancelled SKU sale+return legs first, then:
 * profit = revenue − signed unit cost (qty ignored — owner rule).
 * If any SKU lacks cost → hide margin (null).
 */
export function wholesaleProfitForModelRows(rows: VendorPosRow[]): {
  profit: number | null;
  marginRate: number | null;
} {
  const active = collapseCancelledSkuLegs(rows);
  if (!active.length) return { profit: 0, marginRate: null };

  let profit = 0;
  let revenue = 0;

  for (const r of active) {
    const sku = (r.sku || r.itemNumber || "").trim();
    if (!sku) return { profit: null, marginRate: null };
    const cost = calculatorWholesaleUnitCost(sku, r.storeName, r);
    if (cost == null) return { profit: null, marginRate: null };
    revenue += r.netRevenue;
    profit += r.netRevenue - signedWholesaleUnitCost(cost, r);
  }

  return {
    profit,
    marginRate: revenue > 0 ? profit / revenue : null,
  };
}

export function vendorModelGroupKey(row: VendorPosRow): string {
  return row.vendorModel || row.sku || row.itemNumber || "Unknown model";
}
