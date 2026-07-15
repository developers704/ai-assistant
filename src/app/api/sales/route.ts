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
import { parseMultiParam } from "@/lib/sales/filter-params";

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
  dateFrom?: string;
  dateTo?: string;
  stores?: string[];
  departments?: string[];
  designs?: string[];
  vendors?: string[];
  classes?: string[];
  /** Comparison-only queries need all stores, not product top-20. */
  mode?: "dashboard" | "comparison";
}): Promise<SalesQueryResult> {
  const isCompare = opts.mode === "comparison";
  const from = opts.dateFrom ?? opts.date;
  const to = opts.dateTo ?? opts.date;
  return querySales({
    dateRange:
      from && to
        ? { type: "custom", startDate: from, endDate: to }
        : { type: "all_dates" },
    stores: opts.stores?.length ? opts.stores : undefined,
    departments: opts.departments?.length ? opts.departments : undefined,
    designs: opts.designs?.length ? opts.designs : undefined,
    vendors: opts.vendors?.length ? opts.vendors : undefined,
    classes: opts.classes?.length ? opts.classes : undefined,
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
  const fromParam = sp.get("from")?.trim() ?? "";
  const toParam = sp.get("to")?.trim() ?? "";
  const singleDate = dateParam ? parseReportFilterDate(dateParam) ?? undefined : undefined;
  const fromParsed = fromParam ? parseReportFilterDate(fromParam) ?? undefined : undefined;
  const toParsed = toParam ? parseReportFilterDate(toParam) ?? undefined : undefined;

  let filterDateFrom: string | undefined;
  let filterDateTo: string | undefined;
  if (fromParsed && toParsed) {
    filterDateFrom = fromParsed <= toParsed ? fromParsed : toParsed;
    filterDateTo = fromParsed <= toParsed ? toParsed : fromParsed;
  } else if (singleDate) {
    filterDateFrom = singleDate;
    filterDateTo = singleDate;
  } else if (fromParsed) {
    filterDateFrom = fromParsed;
    filterDateTo = fromParsed;
  }

  const filterDate =
    filterDateFrom && filterDateTo && filterDateFrom === filterDateTo
      ? filterDateFrom
      : undefined;

  const filterStores = parseMultiParam(sp, "store", "stores");
  const filterDepartments = parseMultiParam(sp, "department", "departments");
  const filterDesigns = parseMultiParam(sp, "design", "designs");
  const filterVendors = parseMultiParam(sp, "vendor", "vendors");
  const filterClasses = parseMultiParam(sp, "class", "classes");

  if (dateParam && (!singleDate || !isValidIsoDate(singleDate))) {
    return NextResponse.json({ error: "Invalid date. Use MM/DD/YY or YYYY-MM-DD." }, { status: 400 });
  }
  if (fromParam && (!fromParsed || !isValidIsoDate(fromParsed))) {
    return NextResponse.json({ error: "Invalid from date." }, { status: 400 });
  }
  if (toParam && (!toParsed || !isValidIsoDate(toParsed))) {
    return NextResponse.json({ error: "Invalid to date." }, { status: 400 });
  }

  if (
    !filterDateFrom &&
    !filterStores.length &&
    !filterDepartments.length &&
    !filterDesigns.length &&
    !filterVendors.length &&
    !filterClasses.length
  ) {
    clearActiveSalesContext();
  }
  setActiveSalesContext({
    dateRange: filterDateFrom && filterDateTo
      ? {
          preset: "custom",
          from: filterDateFrom,
          to: filterDateTo,
          timezone: process.env.BUSINESS_TIMEZONE || "America/Los_Angeles",
        }
      : undefined,
    stores: filterStores,
    departments: filterDepartments,
    designs: filterDesigns,
    vendors: filterVendors,
    classes: filterClasses,
    dataVersion: readActivePointer().activeVersion ?? undefined,
  });

  if (isSalesUnifiedIntelligenceEnabled()) {
    await ensureActiveSalesVersion();
    const latestMeta = getLatestReportWithSummary();
    if (latestMeta) {
      const slice = {
        date: filterDate,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        stores: filterStores,
        departments: filterDepartments,
        designs: filterDesigns,
        vendors: filterVendors,
        classes: filterClasses,
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
            dateFrom: prevDate,
            dateTo: prevDate,
            mode: "comparison",
          });
        }

        const weekAgo = shiftIsoDate(filterDate, -7);
        if (latestMeta.availableDates.includes(weekAgo) && weekAgo !== prevDate) {
          previousWeek = await queryDashboardSlice({
            ...slice,
            date: weekAgo,
            dateFrom: weekAgo,
            dateTo: weekAgo,
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
        filterDateFrom: filterDateFrom ?? null,
        filterDateTo: filterDateTo ?? null,
        filterStores,
        filterDepartments,
        filterDesigns,
        filterVendors,
        filterClasses,
        filterStore: filterStores[0] ?? null,
        filterDepartment: filterDepartments[0] ?? null,
        filterDesign: filterDesigns[0] ?? null,
        filterVendor: filterVendors[0] ?? null,
        filterClass: filterClasses[0] ?? null,
        dataVersion: result.freshness?.dataVersion ?? null,
        dataThrough: result.freshness?.dataThrough ?? null,
        engine: "sales_unified",
      });
    }
  }

  const latest = getLatestReportWithSummary({
    ...(filterDate ? { filterDate } : {}),
    ...(filterDateFrom && filterDateTo ? { filterDateFrom, filterDateTo } : {}),
    ...(filterStores.length ? { filterStores } : {}),
    ...(filterDepartments.length ? { filterDepartments } : {}),
    ...(filterDesigns.length ? { filterDesigns } : {}),
    ...(filterVendors.length ? { filterVendors } : {}),
    ...(filterClasses.length ? { filterClasses } : {}),
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
      filterDateFrom: filterDateFrom ?? null,
      filterDateTo: filterDateTo ?? null,
      filterStores,
      filterDepartments,
      filterDesigns,
      filterVendors,
      filterClasses,
      filterStore: filterStores[0] ?? null,
      filterDepartment: filterDepartments[0] ?? null,
      filterDesign: filterDesigns[0] ?? null,
      filterVendor: filterVendors[0] ?? null,
      filterClass: filterClasses[0] ?? null,
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
    filterDateFrom: null,
    filterDateTo: null,
    filterStores: [],
    filterDepartments: [],
    filterDesigns: [],
    filterVendors: [],
    filterClasses: [],
    filterStore: null,
    filterDepartment: null,
    filterDesign: null,
    filterVendor: null,
    filterClass: null,
  });
}
