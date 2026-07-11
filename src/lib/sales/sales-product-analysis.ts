import type { VendorPosRow } from "@/lib/reports/types";
import { groupRows } from "./sales-aggregate";
import type { SalesBreakdownRow } from "./sales-types";

export function getTopVendorModels(
  rows: VendorPosRow[],
  opts?: {
    sortBy?: "revenue" | "quantity" | "margin";
    limit?: number;
  }
): SalesBreakdownRow[] {
  const sortBy =
    opts?.sortBy === "quantity"
      ? "unitsSold"
      : opts?.sortBy === "margin"
        ? "estimatedMargin"
        : "netSales";
  return groupRows(rows, "vendor_model", opts?.limit ?? 20, sortBy, "desc");
}

export function getTopProducts(
  rows: VendorPosRow[],
  opts?: { sortBy?: "revenue" | "quantity" | "margin"; limit?: number }
): SalesBreakdownRow[] {
  const sortBy =
    opts?.sortBy === "quantity"
      ? "unitsSold"
      : opts?.sortBy === "margin"
        ? "estimatedMargin"
        : "netSales";
  return groupRows(rows, "product", opts?.limit ?? 20, sortBy, "desc");
}
