import type { VendorPosRow } from "@/lib/reports/types";
import { groupRows, summarizeRows } from "@/lib/sales/sales-aggregate";
import { metricDefinitionsRecord } from "@/lib/sales/metrics/definitions";
import type {
  SalesDashboardSnapshot,
  SalesMetricsCanonical,
} from "./schema";

function toMetrics(rows: VendorPosRow[]): SalesMetricsCanonical {
  const s = summarizeRows(rows);
  const estimatedCost = rows.reduce((a, r) => a + (r.inventoryCost || 0), 0);
  const hasCost = rows.some((r) => r.inventoryCost != null && r.inventoryCost !== 0) || estimatedCost > 0;
  const returns = rows
    .filter((r) => r.quantity < 0 || r.netRevenue < 0)
    .reduce((a, r) => a + Math.abs(r.netRevenue), 0);

  return {
    grossSales: s.grossSales ?? 0,
    discounts: s.discounts ?? 0,
    discountRate: s.discountRate ?? 0,
    returns,
    netSales: s.netSales ?? 0,
    units: s.unitsSold ?? 0,
    transactions: s.transactions ?? 0,
    averageTicket: s.averageTicket ?? 0,
    averageUnitPrice: s.averageUnitPrice ?? 0,
    estimatedCost: hasCost ? estimatedCost : null,
    estimatedMargin: hasCost ? (s.estimatedMargin ?? 0) : null,
    marginRate: hasCost ? (s.marginRate ?? 0) : null,
  };
}

function toRanking(
  rows: VendorPosRow[],
  by:
    | "store"
    | "department"
    | "design"
    | "vendor"
    | "class"
    | "product"
    | "sku"
    | "vendor_model",
  type: SalesDashboardSnapshot["rankings"]["stores"][number]["type"],
  limit = 25
) {
  const totalNet = rows.reduce((s, r) => s + r.netRevenue, 0) || 1;
  return groupRows(rows, by, limit).map((r, i) => ({
    rank: i + 1,
    label: r.name,
    type,
    grossSales: r.grossSales,
    discounts: r.discounts,
    netSales: r.netSales,
    units: r.unitsSold,
    transactions: r.transactions,
    averageTicket: r.transactions > 0 ? r.netSales / r.transactions : 0,
    estimatedMargin: r.estimatedMargin,
    marginRate: r.netSales > 0 ? r.estimatedMargin / r.netSales : 0,
    contributionPercent: (r.netSales / totalNet) * 100,
  }));
}

function filterOptions(
  rows: VendorPosRow[],
  key: keyof VendorPosRow
): { value: string; label: string; rowCount: number; netSales: number }[] {
  const map = new Map<string, { count: number; net: number }>();
  for (const r of rows) {
    const v = String(r[key] ?? "").trim();
    if (!v) continue;
    const cur = map.get(v) ?? { count: 0, net: 0 };
    cur.count += 1;
    cur.net += r.netRevenue;
    map.set(v, cur);
  }
  return [...map.entries()]
    .map(([value, v]) => ({
      value,
      label: value,
      rowCount: v.count,
      netSales: v.net,
    }))
    .sort((a, b) => b.netSales - a.netSales);
}

function dailyTrends(rows: VendorPosRow[]) {
  const byDate = groupRows(rows, "date", 400, "netSales", "asc");
  return byDate.map((d) => ({
    period: d.name,
    from: d.name,
    to: d.name,
    grossSales: d.grossSales,
    netSales: d.netSales,
    units: d.unitsSold,
    transactions: d.transactions,
    estimatedMargin: d.estimatedMargin,
  }));
}

function buildInsights(rows: VendorPosRow[]): SalesDashboardSnapshot["insights"] {
  const stores = groupRows(rows, "store", 10);
  const weak = groupRows(rows, "store", 50, "netSales", "asc").slice(0, 5);
  const designs = groupRows(rows, "design", 10);
  const vendors = groupRows(rows, "vendor", 10);
  const highDiscount = groupRows(rows, "store", 50)
    .filter((s) => s.grossSales > 0 && s.discounts / s.grossSales > 0.15)
    .slice(0, 5);
  const lowMargin = groupRows(rows, "vendor", 50)
    .filter((v) => v.netSales > 0 && v.estimatedMargin / v.netSales < 0.2)
    .slice(0, 5);
  const highSalesLowMargin = groupRows(rows, "design", 50)
    .filter((d) => d.netSales > 1000 && d.netSales > 0 && d.estimatedMargin / d.netSales < 0.25)
    .slice(0, 5);

  const insight = (
    id: string,
    type: string,
    title: string,
    description: string,
    entity?: string,
    entityType?: string,
    value?: number,
    severity: "info" | "positive" | "warning" | "critical" = "info"
  ) => ({
    id,
    type,
    title,
    description,
    entity,
    entityType,
    value,
    severity,
    confidence: 0.85,
  });

  return {
    topPerformers: stores.slice(0, 3).map((s, i) =>
      insight(
        `top-store-${i}`,
        "top_performer",
        `Top store: ${s.name}`,
        `${s.name} leads with $${Math.round(s.netSales).toLocaleString()} net.`,
        s.name,
        "store",
        s.netSales,
        "positive"
      )
    ),
    weakPerformers: weak.map((s, i) =>
      insight(
        `weak-store-${i}`,
        "weak_performer",
        `Soft store: ${s.name}`,
        `${s.name} is among the lowest at $${Math.round(s.netSales).toLocaleString()} net.`,
        s.name,
        "store",
        s.netSales,
        "warning"
      )
    ),
    highDiscountEntities: highDiscount.map((s, i) =>
      insight(
        `disc-${i}`,
        "high_discount",
        `High discounts: ${s.name}`,
        `${s.name} discount share is ${((s.discounts / (s.grossSales || 1)) * 100).toFixed(1)}%.`,
        s.name,
        "store",
        s.discounts,
        "warning"
      )
    ),
    lowMarginEntities: lowMargin.map((v, i) =>
      insight(
        `low-m-${i}`,
        "low_margin",
        `Low margin vendor: ${v.name}`,
        `${v.name} estimated margin rate is ${((v.estimatedMargin / (v.netSales || 1)) * 100).toFixed(1)}%.`,
        v.name,
        "vendor",
        v.estimatedMargin,
        "warning"
      )
    ),
    highSalesLowMarginEntities: highSalesLowMargin.map((d, i) =>
      insight(
        `hslm-${i}`,
        "high_sales_low_margin",
        `High sales / soft margin: ${d.name}`,
        `${d.name} has strong sales but weaker estimated margin.`,
        d.name,
        "design",
        d.netSales,
        "warning"
      )
    ),
    unusualSpikes: [],
    unusualDrops: [],
    storeOpportunities: weak.slice(0, 3).map((s, i) =>
      insight(
        `store-opp-${i}`,
        "store_opportunity",
        `Opportunity: ${s.name}`,
        `${s.name} may need coaching or inventory support.`,
        s.name,
        "store",
        s.netSales,
        "info"
      )
    ),
    vendorOpportunities: vendors.slice(3, 6).map((v, i) =>
      insight(
        `vendor-opp-${i}`,
        "vendor_opportunity",
        `Mid-tier vendor: ${v.name}`,
        `${v.name} could grow with focused promotions.`,
        v.name,
        "vendor",
        v.netSales,
        "info"
      )
    ),
    designOpportunities: designs.slice(3, 6).map((d, i) =>
      insight(
        `design-opp-${i}`,
        "design_opportunity",
        `Design focus: ${d.name}`,
        `${d.name} is mid-pack — consider spotlighting it.`,
        d.name,
        "design",
        d.netSales,
        "info"
      )
    ),
  };
}

function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function comparePeriods(
  currentRows: VendorPosRow[],
  previousRows: VendorPosRow[]
): SalesDashboardSnapshot["comparisons"]["previousDay"] {
  const current = toMetrics(currentRows);
  const previous = toMetrics(previousRows);
  return {
    current,
    previous,
    change: {
      netSalesAmount: current.netSales - previous.netSales,
      netSalesPercent: pctChange(current.netSales, previous.netSales),
      unitsAmount: current.units - previous.units,
      unitsPercent: pctChange(current.units, previous.units),
      transactionsAmount: current.transactions - previous.transactions,
      transactionsPercent: pctChange(current.transactions, previous.transactions),
      marginAmount:
        current.estimatedMargin != null && previous.estimatedMargin != null
          ? current.estimatedMargin - previous.estimatedMargin
          : null,
      marginPercent:
        current.estimatedMargin != null && previous.estimatedMargin != null
          ? pctChange(current.estimatedMargin, previous.estimatedMargin)
          : null,
    },
  };
}

export function buildSalesDashboardSnapshot(args: {
  dataVersion: string;
  rows: VendorPosRow[];
  rejectedCount?: number;
  fileName?: string;
  fileHash?: string;
  warnings?: string[];
}): SalesDashboardSnapshot {
  const now = new Date().toISOString();
  const dates = [...new Set(args.rows.map((r) => r.date).filter(Boolean))].sort();
  const dataThrough = dates[dates.length - 1] ?? null;
  const summary = toMetrics(args.rows);
  const engineTotal = summarizeRows(args.rows).netSales ?? 0;
  const validationErrors: string[] = [];
  if (Math.abs(engineTotal - summary.netSales) > 0.01) {
    validationErrors.push("Snapshot net sales does not match query engine total.");
  }

  const lastDay = dataThrough;
  const prevDay = lastDay
    ? dates.filter((d) => d < lastDay).slice(-1)[0]
    : undefined;
  const lastDayRows = lastDay ? args.rows.filter((r) => r.date === lastDay) : [];
  const prevDayRows = prevDay ? args.rows.filter((r) => r.date === prevDay) : [];

  const snapshot: SalesDashboardSnapshot = {
    schemaVersion: "1.0",
    dataVersion: args.dataVersion,
    generatedAt: now,
    refreshedAt: now,
    dataThrough,
    source: {
      fileName: args.fileName,
      fileHash: args.fileHash,
      rowCount: args.rows.length + (args.rejectedCount ?? 0),
      validRowCount: args.rows.length,
      rejectedRowCount: args.rejectedCount ?? 0,
      dateRange: { from: dates[0] ?? null, to: dataThrough },
      warnings: args.warnings ?? [],
    },
    status: {
      state: validationErrors.length ? "failed" : "ready",
      isComplete: true,
      isValidated: validationErrors.length === 0,
      validationErrors,
    },
    activeFilters: {},
    availableFilters: {
      stores: filterOptions(args.rows, "storeName"),
      cities: [],
      states: [],
      regions: [],
      departments: filterOptions(args.rows, "department"),
      designs: filterOptions(args.rows, "design"),
      vendors: filterOptions(args.rows, "vendor"),
      classes: filterOptions(args.rows, "productClass"),
      metals: [],
      products: filterOptions(args.rows, "description").slice(0, 200),
      skus: filterOptions(args.rows, "sku").slice(0, 500),
      vendorModels: filterOptions(args.rows, "vendorModel").slice(0, 500),
      salesPeople: [],
    },
    summary,
    rankings: {
      stores: toRanking(args.rows, "store", "store"),
      departments: toRanking(args.rows, "department", "department"),
      designs: toRanking(args.rows, "design", "design"),
      vendors: toRanking(args.rows, "vendor", "vendor"),
      classes: toRanking(args.rows, "class", "class"),
      metals: [],
      products: toRanking(args.rows, "product", "product"),
      skus: toRanking(args.rows, "sku", "sku"),
      vendorModels: toRanking(args.rows, "vendor_model", "vendor_model"),
      salesPeople: [],
    },
    comparisons: {
      ...(lastDay && prevDay
        ? { previousDay: comparePeriods(lastDayRows, prevDayRows) }
        : {}),
    },
    trends: {
      daily: dailyTrends(args.rows),
      weekly: [],
      monthly: [],
    },
    insights: buildInsights(args.rows),
    metricDefinitions: metricDefinitionsRecord(),
  };

  return snapshot;
}

/** Compact snapshot for AI tools — never send full rankings dump unless needed. */
export function compactSnapshotSummary(snapshot: SalesDashboardSnapshot) {
  return {
    dataVersion: snapshot.dataVersion,
    dataThrough: snapshot.dataThrough,
    refreshedAt: snapshot.refreshedAt,
    source: {
      fileName: snapshot.source.fileName,
      validRowCount: snapshot.source.validRowCount,
      dateRange: snapshot.source.dateRange,
      warnings: snapshot.source.warnings,
    },
    status: snapshot.status,
    summary: snapshot.summary,
    topStores: snapshot.rankings.stores.slice(0, 5),
    topDepartments: snapshot.rankings.departments.slice(0, 5),
    topDesigns: snapshot.rankings.designs.slice(0, 5),
    topVendors: snapshot.rankings.vendors.slice(0, 5),
    insights: {
      topPerformers: snapshot.insights.topPerformers.slice(0, 3),
      weakPerformers: snapshot.insights.weakPerformers.slice(0, 3),
    },
  };
}
