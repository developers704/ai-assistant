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

  const secondary: "netSales" | "unitsSold" =
    sortBy === "unitsSold" ? "netSales" : "unitsSold";

  list.sort((a, b) => {
    const av = a[sortBy] ?? 0;
    const bv = b[sortBy] ?? 0;
    if (av !== bv) return sortDirection === "asc" ? av - bv : bv - av;
    const as = a[secondary] ?? 0;
    const bs = b[secondary] ?? 0;
    return sortDirection === "asc" ? as - bs : bs - as;
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
  const key = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/\s+/g, " ");

  const dateSet = opts.dates?.length ? new Set(opts.dates) : null;
  const storeSet = opts.stores?.length
    ? new Set(opts.stores.map(key))
    : null;
  const deptSet = opts.departments?.length
    ? new Set(opts.departments.map(key))
    : null;
  const designSet = opts.designs?.length
    ? new Set(opts.designs.map(key))
    : null;
  const vendorSet = opts.vendors?.length
    ? new Set(opts.vendors.map(key))
    : null;
  const classSet = opts.classes?.length
    ? new Set(opts.classes.map(key))
    : null;
  const skuSet = opts.skus?.length
    ? new Set(opts.skus.map(key))
    : null;
  const modelSet = opts.vendorModels?.length
    ? new Set(opts.vendorModels.map(key))
    : null;
  const productSet = opts.products?.length
    ? new Set(opts.products.map(key))
    : null;

  return rows.filter((r) => {
    if (dateSet && (!r.date || !dateSet.has(r.date))) return false;
    if (storeSet && !storeSet.has(key(r.storeName))) return false;
    if (deptSet && !deptSet.has(key(r.department))) return false;
    if (designSet && !designSet.has(key(r.design))) return false;
    if (vendorSet && !vendorSet.has(key(r.vendor))) return false;
    if (classSet && !classSet.has(key(r.productClass))) return false;
    if (skuSet && !skuSet.has(key(r.sku || r.itemNumber))) return false;
    if (modelSet && !modelSet.has(key(r.vendorModel))) return false;
    if (productSet && !productSet.has(key(r.description))) return false;
    return true;
  });
}

export function topOf(rows: SalesBreakdownRow[] | undefined): string | undefined {
  return rows?.[0]?.name;
}
