import type { ReportSummary, StoredReportMeta } from "@/lib/reports/types";
import type { SalesQueryResult } from "@/lib/sales/sales-types";
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
export function reportSummaryFromQueryResult(
  result: SalesQueryResult,
  meta: StoredReportMeta
): ReportSummary {
  const s = result.summary;
  const net = s?.netSales ?? 0;
  const units = s?.unitsSold ?? 0;
  const txns = s?.transactions ?? 0;
  const gross = s?.grossSales ?? 0;
  const discounts = s?.discounts ?? 0;
  const margin = s?.estimatedMargin ?? 0;

  const mapRank = (rows?: NonNullable<SalesQueryResult["rankings"]>["topStores"]) =>
    (rows ?? []).map((r) => ({
      name: r.name,
      revenue: r.netSales,
      change: 0,
      imageDir: undefined as string | undefined,
      imageUrl: r.imageUrl ?? null,
      units: r.unitsSold,
    }));

  const topStores = mapRank(result.rankings?.topStores ?? result.breakdowns?.byStore);
  const worstStores = [...(result.rankings?.lowestStores ?? [])]
    .map((r) => ({
      name: r.name,
      revenue: r.netSales,
      change: 0,
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
    })
  );

  const dateFrom = result.query.resolvedDateRange.startDate;
  const dateTo = result.query.resolvedDateRange.endDate;

  return {
    totalRevenue: net,
    totalTransactions: units,
    averageOrderValue: units > 0 ? net / units : 0,
    comparisonPreviousDay: 0,
    comparisonPreviousWeek: 0,
    topStores,
    worstStores,
    topProducts,
    underperformingStores: worstStores.slice(0, 5),
    recommendations: result.warnings?.length
      ? result.warnings
      : [
          `Net ${net.toLocaleString("en-US", { style: "currency", currency: "USD" })} across ${txns.toLocaleString()} transactions, ${units.toLocaleString()} units.`,
        ],
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
    dateRange:
      dateFrom && dateTo
        ? { from: dateFrom, to: dateTo }
        : meta.dateRange,
    topDepartments: mapRank(result.rankings?.topDepartments ?? result.breakdowns?.byDepartment),
    topDesigns: mapRank(result.rankings?.topDesigns ?? result.breakdowns?.byDesign),
    topVendors: mapRank(result.rankings?.topVendors ?? result.breakdowns?.byVendor),
    topClasses: mapRank(result.rankings?.topClasses ?? result.breakdowns?.byClass),
  };
}
