import type { VendorPosRow } from "@/lib/reports/types";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import type { SalesBreakdownRow, SalesGroupBy, SalesMetricSummary } from "./sales-types";

export function summarizeRows(rows: VendorPosRow[]): SalesMetricSummary {
  if (!rows.length) {
    return {
      netSales: 0,
      grossSales: 0,
      discounts: 0,
      discountRate: 0,
      unitsSold: 0,
      transactions: 0,
      estimatedMargin: 0,
      marginRate: 0,
      averageTicket: 0,
      averageUnitPrice: 0,
    };
  }

  let net = 0;
  let gross = 0;
  let discounts = 0;
  let units = 0;
  let margin = 0;
  const txns = new Set<string>();

  for (const r of rows) {
    net += r.netRevenue;
    gross += r.grossSales;
    discounts += r.discountAmount;
    units += r.quantity;
    margin += r.margin;
    if (r.transactionId) txns.add(r.transactionId);
  }

  const txnCount = txns.size || rows.length;
  return {
    netSales: net,
    grossSales: gross,
    discounts,
    discountRate: gross > 0 ? discounts / gross : 0,
    unitsSold: units,
    transactions: txnCount,
    estimatedMargin: margin,
    marginRate: net > 0 ? margin / net : 0,
    averageTicket: txnCount > 0 ? net / txnCount : 0,
    averageUnitPrice: units > 0 ? net / units : 0,
  };
}

function groupKey(row: VendorPosRow, by: SalesGroupBy): string {
  switch (by) {
    case "date":
      return row.date || "Unknown date";
    case "store":
      return row.storeName || "Unknown store";
    case "department":
      return row.department || "Unknown department";
    case "design":
      return row.design || "Unknown design";
    case "vendor":
      return row.vendor || "Unknown vendor";
    case "class":
      return row.productClass || "Unknown class";
    case "product":
      return row.description || row.vendorModel || row.sku || "Unknown product";
    case "sku":
      return row.sku || row.itemNumber || "Unknown SKU";
    case "vendor_model":
      return row.vendorModel || row.sku || row.itemNumber || "Unknown model";
    default:
      return "Unknown";
  }
}

export function groupRows(
  rows: VendorPosRow[],
  by: SalesGroupBy,
  limit = 50,
  sortBy: "netSales" | "unitsSold" | "estimatedMargin" = "netSales",
  sortDirection: "asc" | "desc" = "desc"
): SalesBreakdownRow[] {
  const map = new Map<
    string,
    {
      rows: VendorPosRow[];
      imageDir?: string;
      sku?: string;
      vendorModel?: string;
      description?: string;
    }
  >();

  for (const r of rows) {
    const key = groupKey(r, by);
    const cur = map.get(key) ?? { rows: [] };
    cur.rows.push(r);
    if (!cur.imageDir && r.imageDir) cur.imageDir = r.imageDir;
    if (!cur.sku && (r.sku || r.itemNumber)) cur.sku = r.sku || r.itemNumber;
    if (!cur.vendorModel && r.vendorModel) cur.vendorModel = r.vendorModel;
    if (!cur.description && r.description) cur.description = r.description;
    map.set(key, cur);
  }

  const totalNet = rows.reduce((s, r) => s + r.netRevenue, 0) || 1;
  const list: SalesBreakdownRow[] = [...map.entries()].map(([name, v]) => {
    const s = summarizeRows(v.rows);
    return {
      name,
      netSales: s.netSales ?? 0,
      grossSales: s.grossSales ?? 0,
      discounts: s.discounts ?? 0,
      unitsSold: s.unitsSold ?? 0,
      transactions: s.transactions ?? 0,
      estimatedMargin: s.estimatedMargin ?? 0,
      share: ((s.netSales ?? 0) / totalNet) * 100,
      imageUrl: resolveProductImageUrl(v.imageDir),
      sku: v.sku,
      vendorModel: v.vendorModel,
      description: v.description,
    };
  });

  list.sort((a, b) => {
    const av = a[sortBy] ?? 0;
    const bv = b[sortBy] ?? 0;
    return sortDirection === "asc" ? av - bv : bv - av;
  });

  return list.slice(0, limit);
}

export function filterRows(
  rows: VendorPosRow[],
  opts: {
    dates?: string[];
    stores?: string[];
    departments?: string[];
    designs?: string[];
    vendors?: string[];
    classes?: string[];
    skus?: string[];
    vendorModels?: string[];
    products?: string[];
  }
): VendorPosRow[] {
  const dateSet = opts.dates?.length ? new Set(opts.dates) : null;
  const storeSet = opts.stores?.length
    ? new Set(opts.stores.map((s) => s.toLowerCase()))
    : null;
  const deptSet = opts.departments?.length
    ? new Set(opts.departments.map((s) => s.toLowerCase()))
    : null;
  const designSet = opts.designs?.length
    ? new Set(opts.designs.map((s) => s.toLowerCase()))
    : null;
  const vendorSet = opts.vendors?.length
    ? new Set(opts.vendors.map((s) => s.toLowerCase()))
    : null;
  const classSet = opts.classes?.length
    ? new Set(opts.classes.map((s) => s.toLowerCase()))
    : null;
  const skuSet = opts.skus?.length
    ? new Set(opts.skus.map((s) => s.toLowerCase()))
    : null;
  const modelSet = opts.vendorModels?.length
    ? new Set(opts.vendorModels.map((s) => s.toLowerCase()))
    : null;
  const productSet = opts.products?.length
    ? new Set(opts.products.map((s) => s.toLowerCase()))
    : null;

  return rows.filter((r) => {
    if (dateSet && (!r.date || !dateSet.has(r.date))) return false;
    if (storeSet && !storeSet.has(r.storeName.toLowerCase())) return false;
    if (deptSet && !deptSet.has(r.department.toLowerCase())) return false;
    if (designSet && !designSet.has(r.design.toLowerCase())) return false;
    if (vendorSet && !vendorSet.has(r.vendor.toLowerCase())) return false;
    if (classSet && !classSet.has(r.productClass.toLowerCase())) return false;
    if (skuSet && !skuSet.has((r.sku || r.itemNumber).toLowerCase())) return false;
    if (modelSet && !modelSet.has(r.vendorModel.toLowerCase())) return false;
    if (productSet && !productSet.has(r.description.toLowerCase())) return false;
    return true;
  });
}

export function topOf(rows: SalesBreakdownRow[] | undefined): string | undefined {
  return rows?.[0]?.name;
}
