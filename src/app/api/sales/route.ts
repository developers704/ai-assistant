import { NextRequest, NextResponse } from "next/server";
import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { getLatestReportWithSummary } from "@/lib/reports/store";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";
import { isSalesUnifiedIntelligenceEnabled } from "@/lib/sales/flags";
import { querySales } from "@/lib/sales/query-sales";
import { reportSummaryFromQueryResult } from "@/lib/sales/dashboard-bridge";
import { ensureActiveSalesVersion } from "@/lib/sales/refresh/service";
import { setActiveSalesContext, clearActiveSalesContext } from "@/lib/sales/active-context";
import { readActivePointer } from "@/lib/sales/data/version-store";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dateParam = sp.get("date")?.trim() ?? "";
  const filterDate = dateParam ? parseReportFilterDate(dateParam) : undefined;
  const filterStore = sp.get("store")?.trim() || undefined;
  const filterDepartment = sp.get("department")?.trim() || undefined;
  const filterDesign = sp.get("design")?.trim() || undefined;

  if (dateParam && (!filterDate || !isValidIsoDate(filterDate))) {
    return NextResponse.json({ error: "Invalid date. Use MM/DD/YY or YYYY-MM-DD." }, { status: 400 });
  }

  // Publish dashboard filter state for Chat/Voice inheritance.
  // Empty filters must clear prior chat/voice context (do not retain stale store/design).
  if (!filterDate && !filterStore && !filterDepartment && !filterDesign) {
    clearActiveSalesContext();
  }
  setActiveSalesContext({
    dateRange: filterDate
      ? {
          preset: "custom",
          from: filterDate,
          to: filterDate,
          timezone: process.env.BUSINESS_TIMEZONE || "America/Los_Angeles",
        }
      : undefined,
    stores: filterStore ? [filterStore] : [],
    departments: filterDepartment ? [filterDepartment] : [],
    designs: filterDesign ? [filterDesign] : [],
    vendors: [],
    classes: [],
    dataVersion: readActivePointer().activeVersion ?? undefined,
  });

  if (isSalesUnifiedIntelligenceEnabled()) {
    await ensureActiveSalesVersion();
    const latestMeta = getLatestReportWithSummary();
    if (latestMeta) {
      const result = await querySales({
        dateRange: filterDate
          ? { type: "custom", startDate: filterDate, endDate: filterDate }
          : { type: "all_dates" },
        stores: filterStore ? [filterStore] : undefined,
        departments: filterDepartment ? [filterDepartment] : undefined,
        designs: filterDesign ? [filterDesign] : undefined,
        resetContext: true,
        // Top Vendor Models: top 20 by pieces sold (matches Sales Dashboard label).
        limit: 20,
        sortBy: "quantity",
        include: {
          summary: true,
          breakdown: true,
          topStores: true,
          lowestStores: true,
          topDepartments: true,
          topDesigns: true,
          topVendors: true,
          topClasses: true,
          topProducts: true,
          topVendorModels: true,
        },
      });

      const summary = reportSummaryFromQueryResult(result, latestMeta.meta);
      return NextResponse.json({
        summary,
        report: latestMeta.meta,
        data: [],
        source: "report",
        reportLabel: summary.reportLabel,
        reportDate: summary.reportDate,
        vendorCode: summary.vendorCode,
        reportPeriod: summary.reportPeriod,
        availableDates: latestMeta.availableDates,
        availableStores: latestMeta.availableStores,
        availableDepartments: latestMeta.availableDepartments,
        availableDesigns: latestMeta.availableDesigns,
        filterDate: filterDate ?? null,
        filterStore: filterStore ?? null,
        filterDepartment: filterDepartment ?? null,
        filterDesign: filterDesign ?? null,
        dataVersion: result.freshness?.dataVersion ?? null,
        dataThrough: result.freshness?.dataThrough ?? null,
        engine: "sales_unified",
      });
    }
  }

  const latest = getLatestReportWithSummary({
    ...(filterDate ? { filterDate } : {}),
    ...(filterStore ? { filterStore } : {}),
    ...(filterDepartment ? { filterDepartment } : {}),
    ...(filterDesign ? { filterDesign } : {}),
  });

  if (latest) {
    return NextResponse.json({
      summary: latest.summary,
      report: latest.meta,
      data: [],
      source: "report",
      reportLabel: latest.summary.reportLabel,
      reportDate: latest.summary.reportDate,
      vendorCode: latest.summary.vendorCode,
      reportPeriod: latest.summary.reportPeriod,
      availableDates: latest.availableDates,
      availableStores: latest.availableStores,
      availableDepartments: latest.availableDepartments,
      availableDesigns: latest.availableDesigns,
      filterDate: filterDate ?? null,
      filterStore: filterStore ?? null,
      filterDepartment: filterDepartment ?? null,
      filterDesign: filterDesign ?? null,
    });
  }

  const summary = computeSalesSummary(mockSalesData);
  return NextResponse.json({
    summary: { ...summary, source: "mock" },
    data: mockSalesData,
    source: "mock",
    availableDates: [],
    availableStores: [],
    availableDepartments: [],
    availableDesigns: [],
    filterDate: null,
    filterStore: null,
    filterDepartment: null,
    filterDesign: null,
  });
}
