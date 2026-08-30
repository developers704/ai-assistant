import type { RankDimension, VendorPosRow } from "@/lib/reports/types";
import { parseSalespersonSplits } from "@/lib/sales/salesperson-credit";

/** Labels used when a dimension field is blank (must match sales-aggregate groupKey). */
export const UNKNOWN_BY_DIMENSION: Record<RankDimension, string> = {
  store: "Unknown store",
  department: "Unknown department",
  vendor: "Unknown vendor",
  design: "Unknown design",
  class: "Unknown class",
  subclass: "Unknown subclass",
  vendorModel: "Unknown model",
  salesperson: "Unknown salesperson",
  paycode: "Unknown paycode",
};

export function isBlankDimension(raw: string): boolean {
  const t = raw.trim();
  return !t || t === "—" || t === "-" || t === "--";
}

/** Display / match key for a row dimension (blank → Unknown …). */
export function dimensionValue(row: VendorPosRow, dimension: RankDimension): string {
  let raw = "";
  switch (dimension) {
    case "store":
      raw = row.storeName;
      break;
    case "department":
      raw = row.department;
      break;
    case "vendor":
      raw = row.vendor;
      break;
    case "design":
      raw = row.design;
      break;
    case "class":
      raw = row.productClass;
      break;
    case "subclass":
      raw = row.subClass;
      break;
    case "paycode":
      raw = row.payCode ?? "";
      break;
    case "vendorModel":
      raw = row.vendorModel;
      break;
    case "salesperson": {
      const first = parseSalespersonSplits(row.salespersons)[0];
      raw = first?.code ?? "";
      break;
    }
  }
  if (isBlankDimension(raw)) return UNKNOWN_BY_DIMENSION[dimension];
  return raw.trim();
}
