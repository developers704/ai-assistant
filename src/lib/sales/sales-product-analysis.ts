import type { VendorPosRow } from "@/lib/reports/types";
import { isHiddenFromTopVendorModelsRow } from "@/lib/utils";
import { groupRows } from "./sales-aggregate";
import type { SalesBreakdownRow } from "./sales-types";

function rowsForTopModels(rows: VendorPosRow[]): VendorPosRow[] {
  return rows.filter((r) => !isHiddenFromTopVendorModelsRow(r));
}

export function getTopVendorModels(
  rows: VendorPosRow[],
  opts?: {
    sortBy?: "revenue" | "quantity" | "margin";
    /** Cap results; omit for all vendor models (qty-sorted). */
    limit?: number | null;
  }
): SalesBreakdownRow[] {
  // Dashboard default: all models by pieces sold (revenue as tiebreaker).
  const sortBy =
    opts?.sortBy === "revenue"
      ? "netSales"
      : opts?.sortBy === "margin"
        ? "estimatedMargin"
        : "unitsSold";
  return groupRows(rowsForTopModels(rows), "vendor_model", opts?.limit ?? null, sortBy, "desc");
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
