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
import type { SalesQueryResult } from "@/lib/sales/sales-types";

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function previousAvailableDate(dates: string[], current: string): string | null {
  const sorted = [...dates].filter(Boolean).sort();
  const idx = sorted.indexOf(current);
  if (idx > 0) return sorted[idx - 1] ?? null;
  return null;
}

async function queryDashboardSlice(opts: {
  date?: string;
  store?: string;
  department?: string;
  design?: string;
  vendor?: string;
  className?: string;
  /** Comparison-only queries need all stores, not product top-20. */
  mode?: "dashboard" | "comparison";
}): Promise<SalesQueryResult> {
  const isCompare = opts.mode === "comparison";
  return querySales({
    dateRange: opts.date
      ? { type: "custom", startDate: opts.date, endDate: opts.date }
      : { type: "all_dates" },
    stores: opts.store ? [opts.store] : undefined,
    departments: opts.department ? [opts.department] : undefined,
    designs: opts.design ? [opts.design] : undefined,
    vendors: opts.vendor ? [opts.vendor] : undefined,
    classes: opts.className ? [opts.className] : undefined,
    resetContext: true,
    limit: isCompare ? 500 : 20,
    sortBy: "quantity",
    groupBy: ["store"],
    include: isCompare
      ? {
          summary: true,
          breakdown: true,
          topStores: true,
          lowestStores: true,
        }
      : {
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
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dateParam = sp.get("date")?.trim() ?? "";
  const filterDate = dateParam ? parseReportFilterDate(dateParam) ?? undefined : undefined;
  const filterStore = sp.get("store")?.trim() || undefined;
  const filterDepartment = sp.get("department")?.trim() || undefined;
  const filterDesign = sp.get("design")?.trim() || undefined;
  const filterVendor = sp.get("vendor")?.trim() || undefined;
  const filterClass = sp.get("class")?.trim() || undefined;

  if (dateParam && (!filterDate || !isValidIsoDate(filterDate))) {
    return NextResponse.json({ error: "Invalid date. Use MM/DD/YY or YYYY-MM-DD." }, { status: 400 });
  }

  // Publish dashboard filter state for Chat/Voice inheritance.
  // Empty filters must clear prior chat/voice context (do not retain stale store/design).
  if (
    !filterDate &&
    !filterStore &&
    !filterDepartment &&
    !filterDesign &&
    !filterVendor &&
    !filterClass
  ) {
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
    vendors: filterVendor ? [filterVendor] : [],
    classes: filterClass ? [filterClass] : [],
    dataVersion: readActivePointer().activeVersion ?? undefined,
  });

  if (isSalesUnifiedIntelligenceEnabled()) {
    await ensureActiveSalesVersion();
    const latestMeta = getLatestReportWithSummary();
    if (latestMeta) {
      const slice = {
        date: filterDate,
        store: filterStore,
        department: filterDepartment,
        design: filterDesign,
        vendor: filterVendor,
        className: filterClass,
      };
      const result = await queryDashboardSlice({ ...slice, mode: "dashboard" });

      let previousDay: SalesQueryResult | null = null;
      let previousWeek: SalesQueryResult | null = null;

      if (filterDate) {
        const prevDate = previousAvailableDate(latestMeta.availableDates, filterDate);
        if (prevDate) {
          previousDay = await queryDashboardSlice({
            ...slice,
            date: prevDate,
            mode: "comparison",
          });
        }

        const weekAgo = shiftIsoDate(filterDate, -7);
        if (latestMeta.availableDates.includes(weekAgo) && weekAgo !== prevDate) {
          previousWeek = await queryDashboardSlice({
            ...slice,
            date: weekAgo,
            mode: "comparison",
          });
        } else if (weekAgo === prevDate) {
          previousWeek = previousDay;
        }
      }

      const summary = reportSummaryFromQueryResult(result, latestMeta.meta, {
        previousDay,
        previousWeek,
      });
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
        availableClasses: latestMeta.availableClasses,
        availableVendors: latestMeta.availableVendors,
        filterDate: filterDate ?? null,
        filterStore: filterStore ?? null,
        filterDepartment: filterDepartment ?? null,
        filterDesign: filterDesign ?? null,
        filterVendor: filterVendor ?? null,
        filterClass: filterClass ?? null,
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
    ...(filterVendor ? { filterVendor } : {}),
    ...(filterClass ? { filterClass } : {}),
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
      availableClasses: latest.availableClasses,
      availableVendors: latest.availableVendors,
      filterDate: filterDate ?? null,
      filterStore: filterStore ?? null,
      filterDepartment: filterDepartment ?? null,
      filterDesign: filterDesign ?? null,
      filterVendor: filterVendor ?? null,
      filterClass: filterClass ?? null,
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
    availableClasses: [],
    availableVendors: [],
    filterDate: null,
    filterStore: null,
    filterDepartment: null,
    filterDesign: null,
    filterVendor: null,
    filterClass: null,
  });
}
