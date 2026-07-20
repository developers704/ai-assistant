"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/Sidebar";
import {
  PageShell,
  PageShellHeader,
  PageShellBody,
  LushMetric,
} from "@/components/layout/PageShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, sortTopProductsByUnits, filterTopProductSkus } from "@/lib/utils";
import type { SalesSummary } from "@/types";
import type { RankDimension, ReportSummary } from "@/lib/reports/types";
import { ReportInsightsCards } from "@/components/reports/ReportInsightsCards";
import { TopProductsTable } from "@/components/reports/TopProductsTable";
import {
  RankDetailDrawer,
  type RankDetailSelection,
} from "@/components/reports/RankDetailDrawer";
import { syncUiSelection } from "@/components/layout/UiContextSync";
import { isValidIsoDate } from "@/lib/reports/date-utils";
import {
  SalesDateRangePicker,
  type SalesDateRangeValue,
} from "@/components/sales/SalesDateRangePicker";
import { SalesMultiSelectFilter } from "@/components/sales/SalesMultiSelectFilter";
import {
  appendMultiParam,
  parseMultiParam,
  pruneUnavailable,
} from "@/lib/sales/filter-params";
import { subscribeSalesReportUpdated } from "@/lib/sales/report-updated-client";
import { TrendingUp, TrendingDown, Package, Store, LineChart, GitCompareArrows, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

function rangeFromSearchParams(sp: {
  get: (key: string) => string | null;
}): SalesDateRangeValue | null {
  const from = sp.get("from")?.trim() ?? "";
  const to = sp.get("to")?.trim() ?? "";
  const date = sp.get("date")?.trim() ?? "";
  if (from && to && isValidIsoDate(from) && isValidIsoDate(to)) {
    return from <= to ? { from, to } : { from: to, to: from };
  }
  if (date && isValidIsoDate(date)) return { from: date, to: date };
  if (from && isValidIsoDate(from)) return { from, to: from };
  return null;
}

function appendDateParams(params: URLSearchParams, range: SalesDateRangeValue | null) {
  if (!range) return;
  if (range.from === range.to) {
    params.set("date", range.from);
  } else {
    params.set("from", range.from);
    params.set("to", range.to);
  }
}

function appendFilterParams(
  params: URLSearchParams,
  filters: {
    stores: string[];
    departments: string[];
    designs: string[];
    vendors: string[];
    classes: string[];
  }
) {
  appendMultiParam(params, "store", filters.stores);
  appendMultiParam(params, "department", filters.departments);
  appendMultiParam(params, "design", filters.designs);
  appendMultiParam(params, "vendor", filters.vendors);
  appendMultiParam(params, "class", filters.classes);
}

export default function SalesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailTypeFromUrl = searchParams.get("detail");
  const detailValueFromUrl = searchParams.get("detailValue");
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [dataSource, setDataSource] = useState<"mock" | "report">("mock");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableDesigns, setAvailableDesigns] = useState<string[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableVendors, setAvailableVendors] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<SalesDateRangeValue | null>(() =>
    rangeFromSearchParams(searchParams)
  );
  const [filterStores, setFilterStores] = useState<string[]>(() =>
    parseMultiParam(searchParams, "store", "stores")
  );
  const [filterDepartments, setFilterDepartments] = useState<string[]>(() =>
    parseMultiParam(searchParams, "department", "departments")
  );
  const [filterDesigns, setFilterDesigns] = useState<string[]>(() =>
    parseMultiParam(searchParams, "design", "designs")
  );
  const [filterVendors, setFilterVendors] = useState<string[]>(() =>
    parseMultiParam(searchParams, "vendor", "vendors")
  );
  const [filterClasses, setFilterClasses] = useState<string[]>(() =>
    parseMultiParam(searchParams, "class", "classes")
  );
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | undefined>();
  const [rankDetail, setRankDetail] = useState<RankDetailSelection | null>(null);
  const knownReportIdRef = useRef<string | null>(null);
  const skipUrlSyncRef = useRef(false);
  const lastUrlKeyRef = useRef<string | null>(null);
  const filtersHydratedRef = useRef(false);
  const salesFetchGenRef = useRef(0);

  const resetFiltersForNewReport = () => {
    skipUrlSyncRef.current = true;
    setDateRange(null);
    setDateWarning(null);
    setFilterStores([]);
    setFilterDepartments([]);
    setFilterDesigns([]);
    setFilterVendors([]);
    setFilterClasses([]);
    setRankDetail(null);
    lastUrlKeyRef.current = "";
    router.replace("/sales", { scroll: false });
  };

  useEffect(() => {
    return subscribeSalesReportUpdated(() => {
      resetFiltersForNewReport();
      setRefreshNonce((n) => n + 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once; reset uses stable setters
  }, []);

  // Voice / deep-link: apply URL → filters only when the URL itself changes.
  // (Do not re-apply on every local filter change — that causes the glitch.)
  useEffect(() => {
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
      lastUrlKeyRef.current = searchParams.toString();
      filtersHydratedRef.current = true;
      return;
    }
    const key = searchParams.toString();
    if (!filtersHydratedRef.current) {
      filtersHydratedRef.current = true;
      lastUrlKeyRef.current = key;
      return;
    }
    if (key === lastUrlKeyRef.current) return;
    lastUrlKeyRef.current = key;

    setDateRange(rangeFromSearchParams(searchParams));
    setFilterStores(parseMultiParam(searchParams, "store", "stores"));
    setFilterDepartments(parseMultiParam(searchParams, "department", "departments"));
    setFilterDesigns(parseMultiParam(searchParams, "design", "designs"));
    setFilterVendors(parseMultiParam(searchParams, "vendor", "vendors"));
    setFilterClasses(parseMultiParam(searchParams, "class", "classes"));
  }, [searchParams]);

  // Manual filter changes → keep the URL in sync so voice deep-links and UI stay aligned.
  useEffect(() => {
    if (!filtersHydratedRef.current) return;
    if (skipUrlSyncRef.current) return;

    const params = new URLSearchParams();
    appendDateParams(params, dateRange);
    appendFilterParams(params, {
      stores: filterStores,
      departments: filterDepartments,
      designs: filterDesigns,
      vendors: filterVendors,
      classes: filterClasses,
    });
    const key = params.toString();
    if (key === lastUrlKeyRef.current) return;
    lastUrlKeyRef.current = key;
    router.replace(key ? `/sales?${key}` : "/sales", { scroll: false });
  }, [
    dateRange,
    filterStores,
    filterDepartments,
    filterDesigns,
    filterVendors,
    filterClasses,
    router,
  ]);

  useEffect(() => {
    if (
      detailTypeFromUrl &&
      detailValueFromUrl &&
      ["store", "department", "vendor", "design", "class", "vendorModel"].includes(detailTypeFromUrl)
    ) {
      setRankDetail({
        dimension: detailTypeFromUrl as RankDimension,
        value: detailValueFromUrl,
      });
    }
  }, [detailTypeFromUrl, detailValueFromUrl]);

  useEffect(() => {
    const params = new URLSearchParams();
    appendDateParams(params, dateRange);
    appendFilterParams(params, {
      stores: filterStores,
      departments: filterDepartments,
      designs: filterDesigns,
      vendors: filterVendors,
      classes: filterClasses,
    });
    const qs = params.toString() ? `?${params}` : "";
    const gen = ++salesFetchGenRef.current;
    const ac = new AbortController();

    fetch(`/api/sales${qs}`, { signal: ac.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        // Ignore stale responses so an older "all dates" fetch can't overwrite a newer day filter.
        if (gen !== salesFetchGenRef.current) return;

        // Drop responses that clearly applied a different date window (stale race).
        if (dateRange) {
          const gotFrom = (d.filterDateFrom ?? d.filterDate) as string | null | undefined;
          const gotTo = (d.filterDateTo ?? d.filterDate) as string | null | undefined;
          if (
            gotFrom &&
            gotTo &&
            (gotFrom !== dateRange.from || gotTo !== dateRange.to)
          ) {
            return;
          }
        } else if (d.filterDate || d.filterDateFrom || d.filterDateTo) {
          return;
        }

        setSummary(d.summary);
        setDateWarning(
          d.dateUnavailable || d.dateWarning
            ? (d.dateWarning as string | null) ??
                "No sales data for the selected date(s) in the loaded report."
            : null
        );
        setDataSource(d.source === "report" ? "report" : "mock");
        if (d.source === "report") {
          const nextReportId = (d.report?.id as string | undefined) ?? null;
          if (
            knownReportIdRef.current != null &&
            nextReportId &&
            knownReportIdRef.current !== nextReportId
          ) {
            // New report detected (e.g. uploaded in another tab / focus refresh)
            resetFiltersForNewReport();
            knownReportIdRef.current = nextReportId;
            setRefreshNonce((n) => n + 1);
            return;
          }
          if (nextReportId) knownReportIdRef.current = nextReportId;

          setReportSummary(d.summary as ReportSummary);
          const dates: string[] = d.availableDates ?? [];
          const stores: string[] = d.availableStores ?? [];
          const departments: string[] = d.availableDepartments ?? [];
          const designs: string[] = d.availableDesigns ?? [];
          const classes: string[] = d.availableClasses ?? [];
          const vendors: string[] = d.availableVendors ?? [];
          setAvailableDates(dates);
          setAvailableStores(stores);
          setAvailableDepartments(departments);
          setAvailableDesigns(designs);
          setAvailableClasses(classes);
          setAvailableVendors(vendors);
          setReportId(nextReportId ?? dateRange?.to ?? d.reportDate ?? "latest");

          // Only clear if selection is outside the report's min–max window.
          if (dateRange && dates.length > 0) {
            const min = dates[0]!;
            const max = dates[dates.length - 1]!;
            const inBounds = dateRange.from >= min && dateRange.to <= max;
            if (!inBounds) {
              setDateRange(null);
            }
          }
          setFilterStores((prev) => pruneUnavailable(prev, stores));
          setFilterDepartments((prev) => pruneUnavailable(prev, departments));
          setFilterDesigns((prev) => pruneUnavailable(prev, designs));
          setFilterVendors((prev) => pruneUnavailable(prev, vendors));
          setFilterClasses((prev) => pruneUnavailable(prev, classes));
        } else {
          setReportSummary(null);
          setAvailableDates([]);
          setAvailableStores([]);
          setAvailableDepartments([]);
          setAvailableDesigns([]);
          setAvailableClasses([]);
          setAvailableVendors([]);
          setReportId(undefined);
          knownReportIdRef.current = null;
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (gen !== salesFetchGenRef.current) return;
        console.error("Sales dashboard fetch failed:", err);
      });

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetFilters uses router; intentional deps are filters/nonce
  }, [
    dateRange,
    filterStores,
    filterDepartments,
    filterDesigns,
    filterVendors,
    filterClasses,
    refreshNonce,
  ]);

  // Pick up a newly uploaded report when returning to this tab/page
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setRefreshNonce((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  useEffect(() => {
    void syncUiSelection({
      selectedReportId: dataSource === "report" ? reportId : undefined,
    });
  }, [dataSource, reportId]);

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-ink-muted">Loading sales data...</div>
      </div>
    );
  }

  const topProducts = sortTopProductsByUnits(filterTopProductSkus(summary.topProducts));

  const isFinancingReport =
    reportSummary?.schema === "financing" || reportSummary?.reportCategory === "financing";

  const isStoreSalesReport =
    reportSummary?.schema === "store_sales" || reportSummary?.reportCategory === "sales";

  const storePerformance = [...summary.topStores].sort(
    (a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name)
  );
  const maxStoreRevenue = Math.max(...storePerformance.map((s) => s.revenue), 1);

  const openRank = (dimension: RankDimension, value: string) => {
    setRankDetail({ dimension, value });
  };

  return (
    <PageShell accent="emerald">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Sales"
          title={
            isFinancingReport
              ? "Financing & Sales"
              : isStoreSalesReport
                ? "Store Sales"
                : "Sales Reports"
          }
          subtitle={
            isFinancingReport
              ? "Payment mix, financing programs, and store performance"
              : undefined
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={(() => {
                  const params = new URLSearchParams();
                  appendDateParams(params, dateRange);
                  appendFilterParams(params, {
                    stores: filterStores,
                    departments: filterDepartments,
                    designs: filterDesigns,
                    vendors: filterVendors,
                    classes: filterClasses,
                  });
                  const qs = params.toString();
                  return qs
                    ? `/sales/lookup-compare?${qs}`
                    : "/sales/lookup-compare";
                })()}
              >
                <Button size="sm" className="gap-1.5">
                  <GitCompareArrows size={14} />
                  Lookup & Compare
                </Button>
              </Link>
              <Link
                href={(() => {
                  const params = new URLSearchParams();
                  appendDateParams(params, dateRange);
                  appendFilterParams(params, {
                    stores: filterStores,
                    departments: filterDepartments,
                    designs: filterDesigns,
                    vendors: filterVendors,
                    classes: filterClasses,
                  });
                  const qs = params.toString();
                  return qs ? `/sales/visualizations?${qs}` : "/sales/visualizations";
                })()}
              >
                <Button size="sm" className="gap-1.5">
                  <LineChart size={14} />
                  Visualization
                </Button>
              </Link>
            </div>
          }
        />

        {(availableDates.length > 0 ||
          availableStores.length > 0 ||
          availableDepartments.length > 0 ||
          availableDesigns.length > 0 ||
          availableVendors.length > 0 ||
          availableClasses.length > 0 ||
          reportSummary?.dateRange) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SalesDateRangePicker
              availableDates={availableDates}
              reportRange={
                reportSummary?.dateRange ??
                (availableDates.length
                  ? {
                      from: availableDates[0]!,
                      to: availableDates[availableDates.length - 1]!,
                    }
                  : null)
              }
              value={dateRange}
              onChange={setDateRange}
            />
            {availableStores.length > 0 && (
              <SalesMultiSelectFilter
                label="Stores"
                allLabel="All stores"
                options={availableStores}
                value={filterStores}
                onChange={setFilterStores}
              />
            )}
            {availableDepartments.length > 0 && (
              <SalesMultiSelectFilter
                label="Departments"
                allLabel="All departments"
                options={availableDepartments}
                value={filterDepartments}
                onChange={setFilterDepartments}
              />
            )}
            {availableDesigns.length > 0 && (
              <SalesMultiSelectFilter
                label="Designs"
                allLabel="All designs"
                options={availableDesigns}
                value={filterDesigns}
                onChange={setFilterDesigns}
              />
            )}
            {availableVendors.length > 0 && (
              <SalesMultiSelectFilter
                label="Vendors"
                allLabel="All vendors"
                options={availableVendors}
                value={filterVendors}
                onChange={setFilterVendors}
              />
            )}
            {availableClasses.length > 0 && (
              <SalesMultiSelectFilter
                label="Classes"
                allLabel="All classes"
                options={availableClasses}
                value={filterClasses}
                onChange={setFilterClasses}
              />
            )}
          </div>
        )}
      </PageShellHeader>

        <PageShellBody>
          {dateRange && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/25 px-3 py-2 text-sm text-amber-100/90">
              <CalendarDays size={15} className="text-amber-300 shrink-0" />
              <span>
                Showing{" "}
                <span className="font-semibold tabular-nums text-amber-50">
                  {dateRange.from === dateRange.to
                    ? dateRange.from
                    : `${dateRange.from} → ${dateRange.to}`}
                </span>
                {summary.totalTransactions != null && (
                  <span className="text-amber-100/60">
                    {" "}
                    · {summary.totalTransactions.toLocaleString()} units ·{" "}
                    {formatCurrency(summary.totalRevenue)}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setDateRange(null)}
                className="ml-auto text-xs font-medium text-amber-200/80 hover:text-amber-50"
              >
                Clear date
              </button>
            </div>
          )}
          {dateWarning && (
            <div className="mb-3 rounded-xl bg-rose-500/10 ring-1 ring-rose-400/30 px-3 py-2 text-sm text-rose-100/90">
              {dateWarning}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <LushMetric
              label={isFinancingReport || isStoreSalesReport ? "Net Sales" : "Total Revenue"}
              value={formatCurrency(summary.totalRevenue)}
              accent="emerald"
              footer={
                <div className="flex items-center gap-1.5 text-white/50">
                  {summary.comparisonPreviousDay >= 0 ? (
                    <TrendingUp size={14} className="text-emerald-400" />
                  ) : (
                    <TrendingDown size={14} className="text-accent-rose" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      summary.comparisonPreviousDay >= 0 ? "text-emerald-400" : "text-accent-rose"
                    )}
                  >
                    {summary.comparisonPreviousDay >= 0 ? "+" : ""}
                    {summary.comparisonPreviousDay.toFixed(1)}% vs previous day
                  </span>
                </div>
              }
            />
            <LushMetric
              label={
                isFinancingReport
                  ? "Transactions"
                  : isStoreSalesReport
                    ? "Units Sold"
                    : "Pieces Sold"
              }
              value={summary.totalTransactions.toLocaleString()}
              footer={
                <p className="text-sm text-white/35">
                  {isFinancingReport
                    ? "Sales rows in report period"
                    : isStoreSalesReport && reportSummary?.uniqueTransactions
                      ? `${reportSummary.uniqueTransactions.toLocaleString()} unique transactions`
                      : "Across reporting stores today"}
                </p>
              }
            />
            <LushMetric
              label={
                isFinancingReport
                  ? "Total Profit"
                  : "Avg. Sale Value"
              }
              value={
                isFinancingReport
                  ? formatCurrency(reportSummary?.totalProfit ?? 0)
                  : formatCurrency(summary.averageOrderValue)
              }
              accent="amber"
              footer={
                <p className="text-sm text-white/35">
                  {isFinancingReport
                    ? `Avg sale ${formatCurrency(summary.averageOrderValue)}`
                    : `+${summary.comparisonPreviousWeek.toFixed(1)}% vs last week`}
                </p>
              }
            />
            {!isFinancingReport && (
              <LushMetric
                label="Profit Margin"
                value={`${(((reportSummary?.marginRate ?? 0) as number) * 100).toFixed(1)}%`}
                accent="emerald"
                footer={
                  <p className="text-sm text-white/35">
                    {formatCurrency(reportSummary?.totalMargin ?? 0)} profit
                    {summary.totalRevenue > 0 && (reportSummary?.totalMargin != null)
                      ? ` · cost ${formatCurrency(
                          summary.totalRevenue - (reportSummary.totalMargin ?? 0)
                        )}`
                      : typeof reportSummary?.totalInventoryCost === "number"
                        ? ` · cost ${formatCurrency(reportSummary.totalInventoryCost)}`
                        : ""}
                  </p>
                }
              />
            )}
          </div>

          {reportSummary && dataSource === "report" && (
            <ReportInsightsCards summary={reportSummary} onRankClick={openRank} />
          )}

          <div className="flex flex-col gap-5">
            {storePerformance.length > 0 && (
              <Card className="p-0 overflow-hidden">
                <CardHeader className="px-4 pt-4 pb-3 border-b border-white/10">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Store size={17} className="text-emerald-300" />
                    Store Performance
                  </CardTitle>
                  <span className="text-xs text-ink-muted">
                    {storePerformance.length} stores · highest to lowest net sales · scroll for all
                  </span>
                </CardHeader>
                <div className="max-h-[min(36rem,70vh)] overflow-y-auto p-4 space-y-3">
                  {storePerformance.map((store, i) => {
                    const barPct = (i / Math.max(storePerformance.length - 1, 1)) * 100;
                    const barClass =
                      barPct < 40
                        ? "bg-emerald-400/80"
                        : barPct < 70
                          ? "bg-amber-300/70"
                          : "bg-accent-rose/80";
                    return (
                      <button
                        key={store.name}
                        type="button"
                        onClick={() => openRank("store", store.name)}
                        className="w-full grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_2.75rem] sm:grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_3rem] gap-x-2 sm:gap-x-3 items-center rounded-lg hover:bg-white/[0.04] px-1 -mx-1 py-1 transition-colors text-left"
                      >
                        <span className="text-xs font-medium text-ink-muted tabular-nums">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate mb-1.5">
                            {store.name}
                          </p>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", barClass)}
                              style={{
                                width: `${(store.revenue / maxStoreRevenue) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-ink tabular-nums text-right">
                          {formatCurrency(store.revenue)}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-medium tabular-nums text-right",
                            store.change >= 0 ? "text-emerald-400" : "text-accent-rose"
                          )}
                        >
                          {store.change >= 0 ? "+" : ""}
                          {store.change.toFixed(1)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}

            <Card className="p-0 overflow-hidden">
              <CardHeader className="px-4 pt-4 pb-3 border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package size={17} className="text-sky-300" />
                  {isFinancingReport ? "Top Pay Programs" : "Vendor Models"}
                </CardTitle>
                <span className="text-xs text-ink-muted">
                  {isFinancingReport
                    ? "By net sales amount"
                    : `${topProducts.length} models by qty · SKUs with qty & stores · scroll for all`}
                </span>
              </CardHeader>
              <div className="p-3 sm:p-4">
                <TopProductsTable products={topProducts} />
              </div>
            </Card>
          </div>
        </PageShellBody>

      <RankDetailDrawer
        selection={rankDetail}
        filterDate={
          dateRange && dateRange.from === dateRange.to ? dateRange.from : undefined
        }
        filterDateFrom={dateRange?.from}
        filterDateTo={dateRange?.to}
        filterStore={filterStores.length ? filterStores.join(",") : undefined}
        filterDepartment={filterDepartments.length ? filterDepartments.join(",") : undefined}
        filterDesign={filterDesigns.length ? filterDesigns.join(",") : undefined}
        filterVendor={filterVendors.length ? filterVendors.join(",") : undefined}
        filterClass={filterClasses.length ? filterClasses.join(",") : undefined}
        reportId={
          reportId && reportId !== "latest" && !/^\d{4}-\d{2}-\d{2}$/.test(reportId)
            ? reportId
            : undefined
        }
        onClose={() => setRankDetail(null)}
      />
    </PageShell>
  );
}
