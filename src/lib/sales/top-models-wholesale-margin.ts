import { getVisibleDmCostPrice } from "@/lib/inventory/pricing";
import { lookupInventory } from "@/lib/inventory/store";
import { fixedWholeCostForSku, wholeCostFromRules } from "@/lib/inventory/whole-cost-rules";
import type { InventoryItem } from "@/lib/inventory/types";
import type { VendorPosRow } from "@/lib/reports/types";
import { isItemPlaceholderSku } from "@/lib/utils";

export type SaleCostContext = Pick<
  VendorPosRow,
  "description" | "department" | "design" | "productClass" | "subClass" | "netRevenue"
> & {
  /** Sales Amount (pre-discount). Required for sales-side formula. */
  grossSales?: number;
  wholesaleCost?: number;
};

/**
 * Merge inventory attrs onto a sale line so CP rules still fire when
 * POS class/desc is thin. Sales Amount stays the cost base (not Tag).
 */
function ruleFieldsForSale(
  sku: string,
  saleRow: SaleCostContext,
  item?: InventoryItem | null
) {
  return {
    sku,
    department: saleRow.department?.trim() || item?.department || "",
    design: saleRow.design?.trim() || item?.design || "",
    class: saleRow.productClass?.trim() || item?.class || "",
    subClass: saleRow.subClass?.trim() || item?.subClass || "",
    description: [saleRow.description, item?.description].filter(Boolean).join(" "),
  };
}

/**
 * Wholesale unit cost for sales dashboard / Top Vendor Models / daily report:
 * 0) Fixed SKU Whole Cost (owner list — everyone)
 * 1) When sale row present: **Sales Amount** × CP Divisor rules (not Tag)
 * 2) Else (price-calculator / no sale context): inventory Tag × rules / Whole Cost
 */
export function calculatorWholesaleUnitCost(
  sku: string,
  store?: string | null,
  saleRow?: SaleCostContext
): number | null {
  const fixed = fixedWholeCostForSku(sku);
  if (fixed != null) return fixed;

  const hit = lookupInventory(sku, store);

  // Daily / sales dashboard: always prefer Sales Amount × rules
  if (saleRow) {
    const salesAmount = Math.abs(Number(saleRow.grossSales) || 0);
    if (salesAmount > 0) {
      const fromSales = wholeCostFromRules(
        ruleFieldsForSale(sku, saleRow, hit?.item),
        salesAmount
      );
      if (fromSales != null && fromSales > 0) return fromSales;
    }
  }

  // No sale context (or no Sales Amount): inventory Tag / filled Whole Cost
  if (hit?.item) {
    const w = Number(getVisibleDmCostPrice(hit.item));
    if (Number.isFinite(w) && w > 0) return w;
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
export const TOP_MODELS_MARGIN_RULES_VERSION = 5;

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

function dateNum(d: string | null | undefined): number {
  const s = (d ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 0;
  return Number(s.replace(/-/g, ""));
}

type CancelRow = Pick<
  VendorPosRow,
  "storeName" | "sku" | "itemNumber" | "netRevenue" | "grossSales" | "date" | "quantity"
>;

/** Exact cancel: same store + SKU + abs net. */
function keyStoreSkuAmount(row: CancelRow): string | null {
  const store = (row.storeName ?? "").trim().toLowerCase();
  const sku = (row.sku || row.itemNumber || "").trim().toUpperCase();
  const amount = absAmountCents(row);
  if (!store || !sku || !(amount > 0)) return null;
  return `ssa|${store}|${sku}|${amount}`;
}

/** Size / Y-suffix exchange within a model: same store + abs net (SKU may differ). */
function keyStoreAmount(row: CancelRow): string | null {
  const store = (row.storeName ?? "").trim().toLowerCase();
  const amount = absAmountCents(row);
  if (!store || !(amount > 0)) return null;
  return `sa|${store}|${amount}`;
}

/** Cross-store cancel of the same piece: same SKU + abs net. */
function keySkuAmount(row: CancelRow): string | null {
  const sku = (row.sku || row.itemNumber || "").trim().toUpperCase();
  const amount = absAmountCents(row);
  if (!sku || !(amount > 0)) return null;
  return `ska|${sku}|${amount}`;
}

function pairReturnsWithSales<T extends VendorPosRow>(
  rows: T[],
  drop: Set<number>,
  usedPositive: Set<number>,
  keyFn: (row: CancelRow) => string | null
): void {
  const saleIndex = new Map<string, number[]>();
  for (let j = 0; j < rows.length; j++) {
    if (drop.has(j) || usedPositive.has(j) || !isSaleish(rows[j])) continue;
    const key = keyFn(rows[j]);
    if (!key) continue;
    const list = saleIndex.get(key);
    if (list) list.push(j);
    else saleIndex.set(key, [j]);
  }

  for (let i = 0; i < rows.length; i++) {
    if (drop.has(i) || !isReturnish(rows[i])) continue;
    const key = keyFn(rows[i]);
    if (!key) continue;

    const absNeg = Math.abs(Number(rows[i].quantity ?? 0));
    const rd = dateNum(rows[i].date);
    let bestJ = -1;
    let bestScore = Infinity;

    for (const j of saleIndex.get(key) ?? []) {
      if (j === i || drop.has(j) || usedPositive.has(j)) continue;
      if (!isSaleish(rows[j])) continue;
      const absPos = Math.abs(Number(rows[j].quantity ?? 0));
      if (absNeg > 0 && absPos > 0 && absNeg !== absPos) continue;
      const sd = dateNum(rows[j].date);
      // Prefer sale on/before return, then closest in time
      const score = sd <= rd ? rd - sd : 1_000_000 + (sd - rd);
      if (score < bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }

    if (bestJ >= 0) {
      drop.add(i);
      drop.add(bestJ);
      usedPositive.add(bestJ);
    }
  }
}

/**
 * Within one vendor-model / product group: drop matching sale↔return legs.
 * Passes (any day in the filter window; prefers nearest prior sale):
 *  1) same store + SKU + abs net
 *  2) same store + abs net (size / Y-suffix exchange)
 *  3) same SKU + abs net (cross-store cancel of the same piece)
 * Does NOT change store Net Sales totals — Top Vendor Models / model detail only.
 */
export function collapseCancelledSkuLegs<T extends VendorPosRow>(rows: T[]): T[] {
  if (rows.length < 2) return rows;

  const drop = new Set<number>();
  const usedPositive = new Set<number>();
  pairReturnsWithSales(rows, drop, usedPositive, keyStoreSkuAmount);
  pairReturnsWithSales(rows, drop, usedPositive, keyStoreAmount);
  pairReturnsWithSales(rows, drop, usedPositive, keySkuAmount);

  if (!drop.size) return rows;
  return rows.filter((_, idx) => !drop.has(idx));
}

/** Drop ranking noise: units with essentially $0 net (return wash). */
export function isPhantomZeroNetModel(units: number, revenue: number): boolean {
  return units > 0 && Math.abs(revenue) < 1;
}

/**
 * Top Vendor Models margin from calculator wholesale rules.
 * Collapses cancelled SKU sale+return legs first, then:
 * profit = revenue − signed unit cost (qty ignored — owner rule).
 * Unit cost from Sales Amount × CP rules when sale context is present.
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
    // Hide wild % on return-wash / penny nets
    marginRate: Math.abs(revenue) >= 1 ? profit / revenue : null,
  };
}

export function vendorModelGroupKey(row: VendorPosRow): string {
  const sku = (row.sku || row.itemNumber || "").trim();
  // ITEM repairs/SPO/memos: one Top Models row per description so Total/net breaks down
  if (isItemPlaceholderSku(sku)) {
    const desc = (row.description || "").trim() || "Repair / memo";
    return `ITEM · ${desc}`;
  }
  return row.vendorModel || sku || "Unknown model";
}
