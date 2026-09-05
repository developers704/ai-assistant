import { NextRequest, NextResponse } from "next/server";
import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import {
  getLatestReportMeta,
  getLatestReportWithSummary,
  getReportMeta,
} from "@/lib/reports/store";
import type { StoredReportMeta } from "@/lib/reports/types";
import {
  isValidIsoDate,
  parseReportFilterDate,
  priorYearCompareWindow,
} from "@/lib/reports/date-utils";
import { isSalesUnifiedIntelligenceEnabled } from "@/lib/sales/flags";
import { querySales } from "@/lib/sales/query-sales";
import { reportSummaryFromQueryResult } from "@/lib/sales/dashboard-bridge";
import {
  ensureActiveSalesVersion,
} from "@/lib/sales/refresh/service";
import { setActiveSalesContext, clearActiveSalesContext } from "@/lib/sales/active-context";
import {
  readActivePointer,
  readNormalizedRows,
  readVersionMetadata,
  readVersionSnapshot,
} from "@/lib/sales/data/version-store";
import type { SalesQueryResult } from "@/lib/sales/sales-types";
import { parseMultiParam } from "@/lib/sales/filter-params";
import { readSessionFromCookies } from "@/lib/auth/session";
import {
  filterAvailableStores,
  scopeStoresForUser,
} from "@/lib/auth/scope-stores";
import { hidesVendorInfoFromPermissions } from "@/lib/auth/user-permissions-store";
import { showsAllSoldInTopVendorModels } from "@/lib/auth/user-permissions";
import { listPaycodes, uniqueSubClasses } from "@/lib/sales/paycode-overlay";
import { listSalespeopleFromRows } from "@/lib/sales/salesperson-credit";
import { remapHrAvailableDesigns } from "@/lib/hr/hr-sales-design";
import { lockHrSalesQuery, type HrSalesScopePayload } from "@/lib/hr/hr-self-sales";

function attachHrSalesScope<T extends Record<string, unknown>>(
  payload: T,
  lock: {
    hrSalesScope?: HrSalesScopePayload;
    selfLocked: boolean;
  }
): T {
  if (!lock.hrSalesScope) return payload;
  const extras: Record<string, unknown> = { hrSalesScope: lock.hrSalesScope };
  if (lock.selfLocked) {
    extras.availableStores = [];
    extras.availableDepartments = [];
    extras.availableSalespeople =
      lock.hrSalesScope.mode === "self" && lock.hrSalesScope.self
        ? [lock.hrSalesScope.self.label]
        : [];
  }
  return { ...payload, ...extras };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function filterValues(
  options: { value: string }[] | undefined
): string[] {
  return (options ?? []).map((o) => o.value).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Shell for dashboard UI — version snapshot + report index meta (no CSV summarize). */
function loadUnifiedSalesShell(version: string): {
  report: StoredReportMeta;
  availableDates: string[];
  availableStores: string[];
  availableDepartments: string[];
  availableDesigns: string[];
  availableClasses: string[];
  availableVendors: string[];
} | null {
  const versionMeta = readVersionMetadata(version);
  const snapshot = readVersionSnapshot(version);
  if (!versionMeta || !snapshot) return null;

  const report =
    (versionMeta.reportId ? getReportMeta(versionMeta.reportId) : null) ??
    getLatestReportMeta();
  if (!report) return null;

  const availableDates =
    versionMeta.availableDates?.length
      ? versionMeta.availableDates
      : (snapshot.trends?.daily ?? [])
          .map((p) => p.from || p.period)
          .filter(Boolean)
          .sort();

  return {
    report,
    availableDates,
    availableStores: filterValues(snapshot.availableFilters.stores),
    availableDepartments: filterValues(snapshot.availableFilters.departments),
    availableDesigns: filterValues(snapshot.availableFilters.designs),
    availableClasses: filterValues(snapshot.availableFilters.classes),
    availableVendors: filterValues(snapshot.availableFilters.vendors),
  };
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
  subclasses?: string[];
  paycodes?: string[];
  salespeople?: string[];
  /** Comparison-only queries need all stores, not product top-20. */
  mode?: "dashboard" | "comparison";
  /** Rozina: include ITEM / soft-hidden lines in Top Vendor Models. */
  includeHiddenTopModels?: boolean;
  /** HR Management Sales: Love→Lovespell, BELLA OVAN→BELLA OVANI, UV bucket. */
  hrSalesDesigns?: boolean;
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
    subclasses: opts.subclasses?.length ? opts.subclasses : undefined,
    paycodes: opts.paycodes?.length ? opts.paycodes : undefined,
    salespeople: opts.salespeople?.length ? opts.salespeople : undefined,
    hrSalesDesigns: opts.hrSalesDesigns === true,
    resetContext: true,
    exactFilters: true,
    /** Dashboard top models; Rozina gets a higher cap for full CSV breakdown. */
    limit: isCompare ? 500 : opts.includeHiddenTopModels ? 500 : 100,
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
          topPaycodes: true,
          includeHiddenTopModels: opts.includeHiddenTopModels === true,
          // Dashboard uses vendor models (not separate product ranking).
          topVendorModels: true,
          topSalesPeople: true,
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

  const filterStoresRaw = parseMultiParam(sp, "store", "stores");
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scoped = scopeStoresForUser(session, filterStoresRaw);
  const filterDesigns = parseMultiParam(sp, "design", "designs");
  const hideVendors = hidesVendorInfoFromPermissions(session.username);
  const filterVendors = hideVendors
    ? []
    : parseMultiParam(sp, "vendor", "vendors");
  const filterClasses = parseMultiParam(sp, "class", "classes");
  const filterSubclasses = parseMultiParam(sp, "subclass", "subclasses");
  const filterPaycodes = parseMultiParam(sp, "paycode", "paycodes");
  const hrSalesDesigns =
    sp.get("hrSales") === "1" ||
    sp.get("hrSales") === "true" ||
    sp.get("hrDesigns") === "1";
  const hrLock = lockHrSalesQuery({
    hrSales: hrSalesDesigns,
    session,
    salespeople: parseMultiParam(sp, "salesperson", "salespeople"),
    stores: scoped.stores ?? [],
    departments: parseMultiParam(sp, "department", "departments"),
  });
  const filterStores = hrLock.stores;
  const filterDepartments = hrLock.departments;
  const filterSalespeople = hrLock.salespeople;

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
    const version = await ensureActiveSalesVersion();
    const shell = version ? loadUnifiedSalesShell(version) : null;
    if (shell) {
      const slice = {
        date: filterDate,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        stores: filterStores,
        departments: filterDepartments,
        designs: filterDesigns,
        vendors: filterVendors,
        classes: filterClasses,
        subclasses: filterSubclasses,
        paycodes: filterPaycodes,
        salespeople: filterSalespeople,
        hrSalesDesigns,
        // Net Sales = full CSV for everyone; only Rozina sees ITEM/JVV in Top Models
        includeHiddenTopModels: showsAllSoldInTopVendorModels(session.username),
      };
      const result = await queryDashboardSlice({ ...slice, mode: "dashboard" });

      // Net sales + store % = same weekday pattern last year (day vs day), not same month/day.
      let previousDay: SalesQueryResult | null = null;
      let previousWeek: SalesQueryResult | null = null;

      if (filterDateFrom && filterDateTo) {
        const reportStart =
          shell.availableDates[0] ?? result.availability.reportStartDate ?? null;
        const compare = priorYearCompareWindow(
          filterDateFrom,
          filterDateTo,
          reportStart
        );
        if (compare) {
          previousDay = await queryDashboardSlice({
            ...slice,
            date: undefined,
            dateFrom: compare.from,
            dateTo: compare.to,
            mode: "comparison",
          });
        }
      } else if (filterDate) {
        const reportStart =
          shell.availableDates[0] ?? result.availability.reportStartDate ?? null;
        const compare = priorYearCompareWindow(filterDate, filterDate, reportStart);
        if (compare) {
          previousDay = await queryDashboardSlice({
            ...slice,
            date: compare.from,
            dateFrom: compare.from,
            dateTo: compare.to,
            mode: "comparison",
          });
        }

        const weekAgo = shiftIsoDate(filterDate, -7);
        if (
          shell.availableDates.includes(weekAgo) &&
          weekAgo !== compare?.from
        ) {
          previousWeek = await queryDashboardSlice({
            ...slice,
            date: weekAgo,
            dateFrom: weekAgo,
            dateTo: weekAgo,
            mode: "comparison",
          });
        }
      }

      const summary = reportSummaryFromQueryResult(result, shell.report, {
        previousDay,
        previousWeek,
      });
      if (hideVendors) {
        summary.topVendors = [];
        summary.recommendations = summary.recommendations.filter(
          (r) => !/top vendor/i.test(r)
        );
      }
      const versionRows = version ? readNormalizedRows(version) ?? [] : [];
      const salespeople = listSalespeopleFromRows(versionRows);
      return NextResponse.json(
        attachHrSalesScope(
          {
            summary,
            report: shell.report,
            data: [],
            source: "report",
            reportLabel: summary.reportLabel,
            reportDate: summary.reportDate,
            vendorCode: hideVendors ? null : summary.vendorCode,
            reportPeriod: summary.reportPeriod,
            availableDates: shell.availableDates,
            availableStores: filterAvailableStores(session, shell.availableStores),
            availableDepartments: shell.availableDepartments,
            availableDesigns: hrSalesDesigns
              ? remapHrAvailableDesigns(shell.availableDesigns)
              : shell.availableDesigns,
            availableClasses: shell.availableClasses,
            availableSubClasses: uniqueSubClasses(versionRows),
            availableVendors: hideVendors ? [] : shell.availableVendors,
            availablePaycodes: listPaycodes(),
            availableSalespeople: salespeople.map((s) => s.label),
            filterDate: filterDate ?? null,
            filterDateFrom: filterDateFrom ?? null,
            filterDateTo: filterDateTo ?? null,
            filterStores,
            filterDepartments,
            filterDesigns,
            filterVendors,
            filterClasses,
            filterSubclasses,
            filterPaycodes,
            filterSalespeople,
            filterStore: filterStores[0] ?? null,
            filterDepartment: filterDepartments[0] ?? null,
            filterDesign: filterDesigns[0] ?? null,
            filterVendor: filterVendors[0] ?? null,
            filterClass: filterClasses[0] ?? null,
            dataVersion: result.freshness?.dataVersion ?? null,
            dataThrough: result.freshness?.dataThrough ?? null,
            dateUnavailable: Boolean(
              !result.ok && result.availability?.requestedRangeAvailable === false
            ),
            dateWarning: result.coverage?.warning ?? null,
            engine: "sales_unified",
          },
          hrLock
        ),
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
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
    const summary = { ...latest.summary };
    if (hideVendors) {
      summary.topVendors = [];
      summary.recommendations = (summary.recommendations ?? []).filter(
        (r) => !/top vendor/i.test(r)
      );
    }
    return NextResponse.json(
      attachHrSalesScope(
        {
          summary,
          report: latest.meta,
          data: [],
          source: "report",
          reportLabel: summary.reportLabel,
          reportDate: summary.reportDate,
          vendorCode: hideVendors ? null : summary.vendorCode,
          reportPeriod: summary.reportPeriod,
          availableDates: latest.availableDates,
          availableStores: filterAvailableStores(session, latest.availableStores),
          availableDepartments: latest.availableDepartments,
          availableDesigns: hrSalesDesigns
            ? remapHrAvailableDesigns(latest.availableDesigns)
            : latest.availableDesigns,
          availableClasses: latest.availableClasses,
          availableVendors: hideVendors ? [] : latest.availableVendors,
          availableSalespeople: [],
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
        },
        hrLock
      )
    );
  }

  const summary = computeSalesSummary(mockSalesData);
  return NextResponse.json(
    attachHrSalesScope(
      {
        summary: { ...summary, source: "mock" },
        data: mockSalesData,
        source: "mock",
        availableDates: [],
        availableStores: [],
        availableDepartments: [],
        availableDesigns: [],
        availableClasses: [],
        availableVendors: [],
        availableSalespeople: [],
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
      },
      hrLock
    )
  );
}
