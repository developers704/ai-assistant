import type { VendorPosRow } from "@/lib/reports/types";
import { isHiddenFromTopVendorModelsRow } from "@/lib/utils";
import { hasOnhandData } from "@/lib/inventory/onhand";
import { groupRows } from "./sales-aggregate";
import type { SalesBreakdownRow } from "./sales-types";
import {
  vendorModelGroupKey,
  wholesaleProfitForModelRows,
} from "./top-models-wholesale-margin";

function rowsForTopModels(rows: VendorPosRow[]): VendorPosRow[] {
  return rows.filter((r) => !isHiddenFromTopVendorModelsRow(r));
}

/** Replace CSV/Kash profit with calculator Whole Cost margin (Top Models only). */
function applyWholesaleMargins(
  models: SalesBreakdownRow[],
  sourceRows: VendorPosRow[]
): SalesBreakdownRow[] {
  const byKey = new Map<string, VendorPosRow[]>();
  for (const r of sourceRows) {
    const key = vendorModelGroupKey(r);
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }

  return models.map((m) => {
    const key = m.vendorModel || m.name;
    const modelRows = byKey.get(key) ?? [];
    const { profit } = wholesaleProfitForModelRows(modelRows);
    return { ...m, estimatedMargin: profit };
  });
}

export function getTopVendorModels(
  rows: VendorPosRow[],
  opts?: {
    sortBy?: "revenue" | "quantity" | "margin";
    /** Cap results; omit for all vendor models (qty-sorted). */
    limit?: number | null;
    periodDays?: number;
  }
): SalesBreakdownRow[] {
  // Warm onhand index once before SKU store lines attach lookups.
  hasOnhandData();
  const filtered = rowsForTopModels(rows);
  // Dashboard default: all models by pieces sold (revenue as tiebreaker).
  const sortBy =
    opts?.sortBy === "revenue"
      ? "netSales"
      : opts?.sortBy === "margin"
        ? "estimatedMargin"
        : "unitsSold";
  const ranked = applyWholesaleMargins(
    groupRows(
      filtered,
      "vendor_model",
      opts?.limit ?? null,
      sortBy,
      "desc",
      { periodDays: opts?.periodDays }
    ),
    filtered
  );
  // Re-sort after wholesale margins replace CSV/Kash profit
  if (opts?.sortBy === "margin") {
    ranked.sort((a, b) => {
      const av = a.estimatedMargin ?? Number.NEGATIVE_INFINITY;
      const bv = b.estimatedMargin ?? Number.NEGATIVE_INFINITY;
      if (av !== bv) return bv - av;
      return (b.unitsSold ?? 0) - (a.unitsSold ?? 0);
    });
  }
  return ranked;
}

export function getTopProducts(
  rows: VendorPosRow[],
  opts?: { sortBy?: "revenue" | "quantity" | "margin"; limit?: number }
): SalesBreakdownRow[] {
  const sortBy =
    opts?.sortBy === "revenue"
      ? "netSales"
      : opts?.sortBy === "margin"
        ? "estimatedMargin"
        : "unitsSold";
  return groupRows(rowsForTopModels(rows), "product", opts?.limit ?? 20, sortBy, "desc");
}
