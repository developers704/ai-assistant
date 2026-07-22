import type { ReportSummary, StoredReportMeta } from "@/lib/reports/types";
import type { SalesBreakdownRow, SalesQueryResult } from "@/lib/sales/sales-types";
import { resolveProductImageUrl } from "@/lib/reports/product-image";

/**
 * Map universal query engine result → dashboard ReportSummary shape
 * so the existing Sales Dashboard UI keeps working without React-side math.
 *
 * UI conventions (store sales):
 * - totalTransactions card = Units Sold
 * - averageOrderValue card = Avg Sale Value (per unit)
 * - uniqueTransactions = distinct txn count
 */

function pctChange(current: number, previous: number): number {
  if (!(previous > 0)) return 0;
  return ((current - previous) / previous) * 100;
}

function avgSaleValue(result?: SalesQueryResult | null): number {
  const units = result?.summary?.unitsSold ?? 0;
  const net = result?.summary?.netSales ?? 0;
  return units > 0 ? net / units : 0;
}

function collectStoreRevenue(result?: SalesQueryResult | null): Map<string, number> {
  const map = new Map<string, number>();
  const add = (rows?: SalesBreakdownRow[]) => {
    for (const r of rows ?? []) map.set(r.name, r.netSales);
  };
  if (!result) return map;
  add(result.breakdowns?.byStore);
  add(result.rankings?.topStores);
  add(result.rankings?.lowestStores);
  return map;
}

export function reportSummaryFromQueryResult(
  result: SalesQueryResult,
  meta: StoredReportMeta,
  opts?: {
    /** Prior available report day for day-over-day %. */
    previousDay?: SalesQueryResult | null;
    /** ~7 days earlier when available in the report (avg sale value wow). */
    previousWeek?: SalesQueryResult | null;
  }
): ReportSummary {
  const s = result.summary;
  const net = s?.netSales ?? 0;
  const units = s?.unitsSold ?? 0;
  const txns = s?.transactions ?? 0;
  const gross = s?.grossSales ?? 0;
  const discounts = s?.discounts ?? 0;
  const margin = s?.estimatedMargin ?? 0;
  const currentAvg = units > 0 ? net / units : 0;

  const prevStoreMap = collectStoreRevenue(opts?.previousDay);

  const mapRank = (rows?: NonNullable<SalesQueryResult["rankings"]>["topStores"]) =>
    (rows ?? []).map((r) => ({
      name: r.name,
      code: r.code,
      revenue: r.netSales,
      change: pctChange(r.netSales, prevStoreMap.get(r.name) ?? 0),
      imageDir: undefined as string | undefined,
      imageUrl: r.imageUrl ?? null,
      units: r.unitsSold,
    }));

  const topStores = mapRank(result.rankings?.topStores ?? result.breakdowns?.byStore);
  const worstStores = [...(result.rankings?.lowestStores ?? [])].map((r) => ({
    name: r.name,
    revenue: r.netSales,
    change: pctChange(r.netSales, prevStoreMap.get(r.name) ?? 0),
    imageUrl: r.imageUrl ?? null,
  }));

  const topProducts = (result.rankings?.topVendorModels ?? result.rankings?.topProducts ?? []).map(
    (r) => ({
      name: r.description || r.vendorModel || r.name,
      itemNumber: r.sku,
      vendorModel: r.vendorModel || r.name,
      imageUrl: r.imageUrl ?? resolveProductImageUrl(undefined),
      revenue: r.netSales,
      units: r.unitsSold,
      margin: r.estimatedMargin,
      marginRate: r.netSales > 0 ? r.estimatedMargin / r.netSales : 0,
      skus: r.skus,
    })
  );

  const dateFrom = result.query.resolvedDateRange.startDate;
  const dateTo = result.query.resolvedDateRange.endDate;

  // Keep date-unavailable / coverage warnings out of Insights — UI shows them as a banner.
  const insightWarnings = (result.warnings ?? []).filter(
    (w) => !/is not available|have not been loaded yet/i.test(w)
  );

  return {
    totalRevenue: net,
    totalTransactions: units,
    averageOrderValue: currentAvg,
    comparisonPreviousDay: pctChange(net, opts?.previousDay?.summary?.netSales ?? 0),
    comparisonPreviousWeek: pctChange(currentAvg, avgSaleValue(opts?.previousWeek)),
    topStores,
    worstStores,
    topProducts,
    underperformingStores: worstStores.filter((store) => store.change < 0).slice(0, 5),
    recommendations: insightWarnings.length
      ? insightWarnings
      : result.ok
        ? [
            `Net ${net.toLocaleString("en-US", { style: "currency", currency: "USD" })} across ${txns.toLocaleString()} transactions, ${units.toLocaleString()} units.`,
          ]
        : [],
    source: "report",
    reportId: meta.id,
    reportLabel: meta.label,
    reportDate: meta.reportDate,
    schema: meta.schema ?? "store_sales",
    reportPeriod: meta.reportPeriod,
    reportCategory: meta.reportCategory ?? "sales",
    vendorCode: meta.vendorCode ?? undefined,
    grossSales: gross,
    discountTotal: discounts,
    avgDiscountRate: s?.discountRate ?? (gross > 0 ? discounts / gross : 0),
    totalInventoryCost: undefined,
    totalMargin: margin,
    marginRate: s?.marginRate ?? (net > 0 ? margin / net : 0),
    uniqueTransactions: txns,
    transactionCount: result.availability.matchingRowCount,
    dateRange: meta.dateRange,
    /** Active filter window when querying a slice (may be a single day). */
    filterDateRange:
      dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined,
    topDepartments: mapRank(result.rankings?.topDepartments ?? result.breakdowns?.byDepartment),
    topDesigns: mapRank(result.rankings?.topDesigns ?? result.breakdowns?.byDesign),
    topVendors: mapRank(result.rankings?.topVendors ?? result.breakdowns?.byVendor),
    topClasses: mapRank(result.rankings?.topClasses ?? result.breakdowns?.byClass),
    topSalesPeople: mapRank(
      result.rankings?.topSalesPeople ?? result.breakdowns?.bySalesperson
    ),
  };
}
