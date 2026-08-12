import type { VendorPosRow } from "@/lib/reports/types";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { isExcludedSalesSku, isHiddenFromTopVendorModelsRow, salesUnitsSold } from "@/lib/utils";
import { hasOnhandData, listOnhandStoresForSku, lookupOnhandQty } from "@/lib/inventory/onhand";
import { creditSalespersonRows } from "@/lib/sales/salesperson-credit";
import {
  calculatorWholesaleUnitCost,
  collapseCancelledSkuLegs,
  isPhantomZeroNetModel,
  signedWholesaleUnitCost,
  vendorModelGroupKey,
} from "./top-models-wholesale-margin";
import type {
  SalesBreakdownRow,
  SalesGroupBy,
  SalesMetricSummary,
  VendorModelSkuLine,
} from "./sales-types";

type StoreSaleStats = { units: number; returned: number; revenue: number };

/** Merge sold units / net with every onhand store for this SKU (0 sold still listed). */
export function buildSkuStoreLines(
  sku: string,
  storeSales: Map<string, StoreSaleStats>
): {
  name: string;
  units: number;
  returned: number;
  revenue: number;
  onhand?: number;
}[] {
  const merged = new Map<
    string,
    { units: number; returned: number; revenue: number; onhand: number | null }
  >();

  for (const [name, stats] of storeSales) {
    merged.set(name, {
      units: stats.units,
      returned: stats.returned,
      revenue: stats.revenue,
      onhand: lookupOnhandQty(sku, name),
    });
  }

  const onhandStores = listOnhandStoresForSku(sku);
  if (onhandStores) {
    for (const { store, onhand } of onhandStores) {
      const cur = merged.get(store);
      if (cur) {
        cur.onhand = onhand;
      } else {
        merged.set(store, { units: 0, returned: 0, revenue: 0, onhand });
      }
    }
  }

  const hasOnhand = onhandStores !== null;
  return [...merged.entries()]
    .map(([name, v]) => ({
      name,
      units: v.units,
      returned: v.returned,
      revenue: v.revenue,
      ...(hasOnhand ? { onhand: v.onhand ?? 0 } : {}),
    }))
    .sort(
      (a, b) =>
        b.units - a.units ||
        b.revenue - a.revenue ||
        (b.onhand ?? 0) - (a.onhand ?? 0) ||
        a.name.localeCompare(b.name)
    );
}

function rollupModelInventory(modelRows: VendorPosRow[]): {
  onHandTotal: number | null;
} {
  const skus = new Set<string>();
  for (const r of modelRows) {
    const sku = (r.sku || r.itemNumber || "").trim();
    if (sku && !isExcludedSalesSku(sku)) skus.add(sku);
  }

  let onHandTotal: number | null = null;
  for (const sku of skus) {
    const stores = listOnhandStoresForSku(sku);
    if (!stores) continue;
    if (onHandTotal === null) onHandTotal = 0;
    for (const { onhand } of stores) onHandTotal += onhand;
  }

  return { onHandTotal };
}

export function skuLinesForModel(rows: VendorPosRow[]): VendorModelSkuLine[] {
  const map = new Map<
    string,
    VendorModelSkuLine & {
      storeSales: Map<string, StoreSaleStats>;
      missingWholesale?: boolean;
      /** Latest sale's Sales Amount (gross) — shown as "tag" on Top Models. */
      salesAmount?: number;
      lastSaleDate?: string;
    }
  >();
  for (const r of collapseCancelledSkuLegs(rows)) {
    const sku = (r.sku || r.itemNumber || "").trim();
    if (!sku || isExcludedSalesSku(sku)) continue;
    const key = sku.toUpperCase();
    const cur = map.get(key) ?? {
      sku,
      units: 0,
      revenue: 0,
      margin: 0,
      storeSales: new Map<string, StoreSaleStats>(),
    };
    const units = salesUnitsSold(r.quantity);
    cur.units += units;
    cur.revenue += r.netRevenue;
    // Top-model SKU lines: revenue − signed calculator cost (returns add cost back)
    const cost = calculatorWholesaleUnitCost(sku, r.storeName, r);
    if (cost == null) {
      cur.missingWholesale = true;
    } else {
      cur.margin = (cur.margin ?? 0) + (r.netRevenue - signedWholesaleUnitCost(cost, r));
    }
    const store = r.storeName?.trim();
    if (store) {
      const prev = cur.storeSales.get(store) ?? {
        units: 0,
        returned: 0,
        revenue: 0,
      };
      prev.units += units;
      const q = Number(r.quantity ?? 0);
      if (q < 0) prev.returned += Math.abs(q);
      prev.revenue += r.netRevenue;
      cur.storeSales.set(store, prev);
    }
    // Prefer latest sale's Sales Amount for the "tag $" label (not inventory Tag)
    const salesAmt = Math.abs(Number(r.grossSales) || 0);
    if (salesAmt > 0) {
      const d = (r.date ?? "").trim();
      if (!cur.lastSaleDate || d >= cur.lastSaleDate) {
        cur.lastSaleDate = d || cur.lastSaleDate;
        cur.salesAmount = salesAmt;
      }
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ storeSales, missingWholesale, salesAmount, lastSaleDate: _, ...line }) => {
      const stores = buildSkuStoreLines(line.sku, storeSales);
      const hasOnhand = hasOnhandData();
      const onHandTotal = hasOnhand
        ? stores.reduce((sum, s) => sum + (s.onhand ?? 0), 0)
        : null;
      const margin = missingWholesale ? undefined : line.margin;
      const marginRate =
        !missingWholesale && line.revenue > 0 && margin != null
          ? margin / line.revenue
          : undefined;
      return {
        ...line,
        margin,
        marginRate,
        // UI label stays "tag $" — value is Sales Amount (gross), not inventory Tag
        tagPrice: salesAmount != null && salesAmount > 0 ? salesAmount : undefined,
        stores: stores.length ? stores : undefined,
        onHandTotal: onHandTotal ?? undefined,
      };
    })
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}

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
    units += salesUnitsSold(r.quantity);
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
      return vendorModelGroupKey(row);
    case "salesperson":
      return "Unknown salesperson";
    default:
      return "Unknown";
  }
}

export function groupRows(
  rows: VendorPosRow[],
  by: SalesGroupBy,
  /** Cap results; omit / null / 0 = return all ranked rows. */
  limit: number | null = 50,
  sortBy: "netSales" | "unitsSold" | "estimatedMargin" = "netSales",
  sortDirection: "asc" | "desc" = "desc",
  opts?: { periodDays?: number; includeHiddenTopModels?: boolean }
): SalesBreakdownRow[] {
  if (by === "salesperson") {
    const credits = creditSalespersonRows(rows);
    const totalNet = credits.reduce((s, p) => s + p.netSales, 0) || 1;
    const list: SalesBreakdownRow[] = credits.map((p) => ({
      name: p.name,
      code: p.code,
      netSales: p.netSales,
      grossSales: 0,
      discounts: 0,
      unitsSold: p.units,
      transactions: p.transactions,
      estimatedMargin: p.margin,
      share: (p.netSales / totalNet) * 100,
    }));
    list.sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      if (av !== bv) return sortDirection === "asc" ? av - bv : bv - av;
      return sortDirection === "asc"
        ? (a.unitsSold ?? 0) - (b.unitsSold ?? 0)
        : (b.unitsSold ?? 0) - (a.unitsSold ?? 0);
    });
    if (limit == null || limit <= 0) return list;
    return list.slice(0, limit);
  }

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
    if (
      (by === "vendor_model" || by === "product" || by === "sku") &&
      !opts?.includeHiddenTopModels &&
      isHiddenFromTopVendorModelsRow(r)
    ) {
      continue;
    }
    const key = groupKey(r, by);
    const cur = map.get(key) ?? { rows: [] };
    cur.rows.push(r);
    if (!cur.imageDir && r.imageDir) cur.imageDir = r.imageDir;
    if (!cur.sku && (r.sku || r.itemNumber)) cur.sku = r.sku || r.itemNumber;
    if (!cur.vendorModel && r.vendorModel) cur.vendorModel = r.vendorModel;
    // ITEM groups use description key as the model label for detail lookup
    if (!cur.vendorModel && by === "vendor_model") cur.vendorModel = key;
    if (!cur.description && r.description) cur.description = r.description;
    map.set(key, cur);
  }

  const totalNet = rows.reduce((s, r) => s + r.netRevenue, 0) || 1;
  const list: (SalesBreakdownRow & { _modelRows?: VendorPosRow[] })[] = [
    ...map.entries(),
  ].map(([name, v]) => {
    // Top models / product / sku: cancel same-day SKU sale+return legs before metrics
    const metricRows =
      by === "vendor_model" || by === "product" || by === "sku"
        ? collapseCancelledSkuLegs(v.rows)
        : v.rows;
    const s = summarizeRows(metricRows);
    const unitsSold = s.unitsSold ?? 0;
    const inventory =
      by === "vendor_model" ? rollupModelInventory(v.rows) : null;

    let department: string | undefined;
    let lastSaleDate: string | undefined;
    let saleDates: string[] | undefined;
    if (by === "vendor_model") {
      const deptRevenue = new Map<string, number>();
      const dates = new Set<string>();
      for (const r of metricRows) {
        const dept = r.department?.trim();
        if (dept) {
          deptRevenue.set(dept, (deptRevenue.get(dept) ?? 0) + r.netRevenue);
        }
        if (r.date) {
          dates.add(r.date);
          if (!lastSaleDate || r.date > lastSaleDate) {
            lastSaleDate = r.date;
          }
        }
      }
      let best = -Infinity;
      for (const [d, rev] of deptRevenue) {
        if (rev > best) {
          best = rev;
          department = d;
        }
      }
      if (dates.size) saleDates = [...dates].sort();
    }

    return {
      name,
      netSales: s.netSales ?? 0,
      grossSales: s.grossSales ?? 0,
      discounts: s.discounts ?? 0,
      unitsSold,
      transactions: s.transactions ?? 0,
      estimatedMargin: s.estimatedMargin ?? 0,
      share: ((s.netSales ?? 0) / totalNet) * 100,
      imageDir: v.imageDir,
      imageUrl: resolveProductImageUrl(v.imageDir),
      sku: v.sku,
      vendorModel: v.vendorModel,
      description: v.description,
      department,
      lastSaleDate,
      saleDates,
      ...(inventory
        ? {
            onHandTotal: inventory.onHandTotal ?? undefined,
          }
        : {}),
      // Defer SKU/store/onhand breakdown until after sort — only top models need it.
      ...(by === "vendor_model" ? { _modelRows: metricRows } : {}),
    };
  }).filter((item) => {
    if (by !== "vendor_model" && by !== "product" && by !== "sku") return true;
    if (isPhantomZeroNetModel(item.unitsSold ?? 0, item.netSales ?? 0)) return false;
    return (item.unitsSold ?? 0) > 0 || Math.abs(item.netSales ?? 0) >= 0.01;
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

  const capped =
    limit == null || limit <= 0 ? list : list.slice(0, limit);

  // Full model list can be large on multi-month reports; only expand SKU/onhand
  // for the leading rows the UI typically shows first (search still uses model text).
  const SKU_DETAIL_CAP = 100;
  return capped.map((item, i) => {
    const modelRows = item._modelRows;
    const { _modelRows: _, ...rest } = item;
    if (!modelRows) return rest;
    if (i >= SKU_DETAIL_CAP) return rest;
    const skus = skuLinesForModel(modelRows);
    return {
      ...rest,
      skus: skus.length ? skus : undefined,
    };
  });
}

export function filterRows(
  rows: VendorPosRow[],
  opts: {
    dates?: string[];
    /** Inclusive ISO bounds — preferred for dashboard day/range filters. */
    dateFrom?: string | null;
    dateTo?: string | null;
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
  const dateFrom = opts.dateFrom && opts.dateFrom.length >= 10 ? opts.dateFrom.slice(0, 10) : null;
  const dateTo = opts.dateTo && opts.dateTo.length >= 10 ? opts.dateTo.slice(0, 10) : null;
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
    if (dateFrom || dateTo) {
      if (!r.date) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
    } else if (dateSet && (!r.date || !dateSet.has(r.date))) {
      return false;
    }
    if (storeSet && !storeSet.has(key(r.storeName || "Unknown store"))) return false;
    if (deptSet && !deptSet.has(key(r.department || "Unknown department"))) return false;
    if (designSet && !designSet.has(key(r.design || "Unknown design"))) return false;
    if (vendorSet && !vendorSet.has(key(r.vendor || "Unknown vendor"))) return false;
    if (classSet && !classSet.has(key(r.productClass || "Unknown class"))) return false;
    if (skuSet && !skuSet.has(key(r.sku || r.itemNumber))) return false;
    if (modelSet && !modelSet.has(key(r.vendorModel))) return false;
    if (productSet && !productSet.has(key(r.description))) return false;
    return true;
  });
}

export function topOf(rows: SalesBreakdownRow[] | undefined): string | undefined {
  return rows?.[0]?.name;
}
