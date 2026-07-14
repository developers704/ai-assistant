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
import { subscribeSalesReportUpdated } from "@/lib/sales/report-updated-client";
import { TrendingUp, TrendingDown, Package, Store, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

const selectClass =
  "select-dark h-9 px-3 rounded-xl text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/40";

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

export default function SalesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeFromUrl = searchParams.get("store");
  const departmentFromUrl = searchParams.get("department");
  const designFromUrl = searchParams.get("design");
  const vendorFromUrl = searchParams.get("vendor");
  const classFromUrl = searchParams.get("class");
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
  const [filterStore, setFilterStore] = useState(() => storeFromUrl ?? "");
  const [filterDepartment, setFilterDepartment] = useState(() => departmentFromUrl ?? "");
  const [filterDesign, setFilterDesign] = useState(() => designFromUrl ?? "");
  const [filterVendor, setFilterVendor] = useState(() => vendorFromUrl ?? "");
  const [filterClass, setFilterClass] = useState(() => classFromUrl ?? "");
  const [reportId, setReportId] = useState<string | undefined>();
  const [rankDetail, setRankDetail] = useState<RankDetailSelection | null>(null);
  const knownReportIdRef = useRef<string | null>(null);
  const skipUrlSyncRef = useRef(false);

  const resetFiltersForNewReport = () => {
    skipUrlSyncRef.current = true;
    setDateRange(null);
    setFilterStore("");
    setFilterDepartment("");
    setFilterDesign("");
    setFilterVendor("");
    setFilterClass("");
    setRankDetail(null);
    router.replace("/sales", { scroll: false });
  };

  useEffect(() => {
    return subscribeSalesReportUpdated(() => {
      resetFiltersForNewReport();
      setRefreshNonce((n) => n + 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once; reset uses stable setters
  }, []);

  useEffect(() => {
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
      return;
    }
    const next = rangeFromSearchParams(searchParams);
    if (
      (next?.from ?? "") !== (dateRange?.from ?? "") ||
      (next?.to ?? "") !== (dateRange?.to ?? "")
    ) {
      // Only sync when URL actually carries date params (voice / deep links).
      if (searchParams.get("from") || searchParams.get("to") || searchParams.get("date")) {
        setDateRange(next);
      }
    }
    if (storeFromUrl != null && storeFromUrl !== filterStore) setFilterStore(storeFromUrl);
    if (departmentFromUrl != null && departmentFromUrl !== filterDepartment) {
      setFilterDepartment(departmentFromUrl);
    }
    if (designFromUrl != null && designFromUrl !== filterDesign) setFilterDesign(designFromUrl);
    if (vendorFromUrl != null && vendorFromUrl !== filterVendor) setFilterVendor(vendorFromUrl);
    if (classFromUrl != null && classFromUrl !== filterClass) setFilterClass(classFromUrl);
  }, [
    searchParams,
    storeFromUrl,
    departmentFromUrl,
    designFromUrl,
    vendorFromUrl,
    classFromUrl,
    dateRange,
    filterStore,
    filterDepartment,
    filterDesign,
    filterVendor,
    filterClass,
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
    if (filterStore) params.set("store", filterStore);
    if (filterDepartment) params.set("department", filterDepartment);
    if (filterDesign) params.set("design", filterDesign);
    if (filterVendor) params.set("vendor", filterVendor);
    if (filterClass) params.set("class", filterClass);
    const qs = params.toString() ? `?${params}` : "";
    fetch(`/api/sales${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
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

          if (
            dateRange &&
            dates.length &&
            (!dates.includes(dateRange.from) || !dates.includes(dateRange.to))
          ) {
            setDateRange(null);
          }
          if (filterStore && stores.length && !stores.includes(filterStore)) {
            setFilterStore("");
          }
          if (
            filterDepartment &&
            departments.length &&
            !departments.includes(filterDepartment)
          ) {
            setFilterDepartment("");
          }
          if (filterDesign && designs.length && !designs.includes(filterDesign)) {
            setFilterDesign("");
          }
          if (filterVendor && vendors.length && !vendors.includes(filterVendor)) {
            setFilterVendor("");
          }
          if (filterClass && classes.length && !classes.includes(filterClass)) {
            setFilterClass("");
          }
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
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetFilters uses router; intentional deps are filters/nonce
  }, [
    dateRange,
    filterStore,
    filterDepartment,
    filterDesign,
    filterVendor,
    filterClass,
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

  const worstStores =
    summary.worstStores?.length > 0
      ? summary.worstStores
      : [...summary.topStores].sort((a, b) => a.revenue - b.revenue).slice(0, 10);
  const maxWorstRevenue = Math.max(...worstStores.map((s) => s.revenue), 1);
  const topProducts = sortTopProductsByUnits(filterTopProductSkus(summary.topProducts)).slice(0, 20);

  const isFinancingReport =
    reportSummary?.schema === "financing" || reportSummary?.reportCategory === "financing";

  const isStoreSalesReport =
    reportSummary?.schema === "store_sales" || reportSummary?.reportCategory === "sales";

  const maxTopStoreRevenue = Math.max(...summary.topStores.map((s) => s.revenue), 1);

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
            <Link
              href={(() => {
                const params = new URLSearchParams();
                appendDateParams(params, dateRange);
                if (filterStore) params.set("store", filterStore);
                if (filterDepartment) params.set("department", filterDepartment);
                if (filterDesign) params.set("design", filterDesign);
                if (filterVendor) params.set("vendor", filterVendor);
                if (filterClass) params.set("class", filterClass);
                const qs = params.toString();
                return qs ? `/sales/visualizations?${qs}` : "/sales/visualizations";
              })()}
            >
              <Button size="sm" className="gap-1.5">
                <LineChart size={14} />
                Visualization
              </Button>
            </Link>
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
              reportRange={reportSummary?.dateRange ?? null}
              value={dateRange}
              onChange={setDateRange}
            />
            {availableStores.length > 0 && (
              <select
                value={filterStore}
                onChange={(e) => setFilterStore(e.target.value)}
                className={selectClass}
                aria-label="Filter by store"
              >
                <option value="">All stores</option>
                {availableStores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            {availableDepartments.length > 0 && (
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className={selectClass}
                aria-label="Filter by department"
              >
                <option value="">All departments</option>
                {availableDepartments.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            {availableDesigns.length > 0 && (
              <select
                value={filterDesign}
                onChange={(e) => setFilterDesign(e.target.value)}
                className={selectClass}
                aria-label="Filter by design"
              >
                <option value="">All designs</option>
                {availableDesigns.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            {availableVendors.length > 0 && (
              <select
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
                className={selectClass}
                aria-label="Filter by vendor"
              >
                <option value="">All vendors</option>
                {availableVendors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            {availableClasses.length > 0 && (
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className={selectClass}
                aria-label="Filter by class"
              >
                <option value="">All classes</option>
                {availableClasses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </PageShellHeader>

        <PageShellBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
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
          </div>

          {reportSummary && dataSource === "report" && (
            <ReportInsightsCards summary={reportSummary} onRankClick={openRank} />
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {isStoreSalesReport && summary.topStores.length > 0 && (
              <Card className="p-0 overflow-hidden">
                <CardHeader className="px-4 pt-4 pb-3 border-b border-white/10">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Store size={17} className="text-emerald-300" />
                    Top Performing Stores
                  </CardTitle>
                  <span className="text-xs text-ink-muted">Highest net sales in this report</span>
                </CardHeader>
                <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-4 space-y-3">
                  {summary.topStores.slice(0, 12).map((store, i) => (
                    <button
                      key={store.name}
                      type="button"
                      onClick={() => openRank("store", store.name)}
                      className="w-full grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_2.75rem] sm:grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_3rem] gap-x-2 sm:gap-x-3 items-center rounded-lg hover:bg-white/[0.04] px-1 -mx-1 py-1 transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-ink-muted tabular-nums">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate mb-1.5">{store.name}</p>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400/80 rounded-full transition-all"
                            style={{ width: `${(store.revenue / maxTopStoreRevenue) * 100}%` }}
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
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-0 overflow-hidden">
              <CardHeader className="px-4 pt-4 pb-3 border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store size={17} className="text-accent-rose" />
                  {isStoreSalesReport ? "Lowest Revenue Stores" : "Worst Performing Stores"}
                </CardTitle>
                <span className="text-xs text-ink-muted">Lowest revenue in report</span>
              </CardHeader>
              <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-4 space-y-3">
                {worstStores.map((store, i) => (
                  <button
                    key={store.name}
                    type="button"
                    onClick={() => openRank("store", store.name)}
                    className="w-full grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_2.75rem] sm:grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_3rem] gap-x-2 sm:gap-x-3 items-center rounded-lg hover:bg-white/[0.04] px-1 -mx-1 py-1 transition-colors text-left"
                  >
                    <span className="text-xs font-medium text-ink-muted tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate mb-1.5">{store.name}</p>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-rose/80 rounded-full transition-all"
                          style={{ width: `${(store.revenue / maxWorstRevenue) * 100}%` }}
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
                ))}
              </div>
            </Card>

            <Card className="p-0 overflow-hidden xl:col-span-2">
              <CardHeader className="px-4 pt-4 pb-3 border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package size={17} className="text-sky-300" />
                  {isFinancingReport ? "Top Pay Programs" : "Top Vendor Models"}
                </CardTitle>
                <span className="text-xs text-ink-muted">
                  {isFinancingReport
                    ? "By net sales amount"
                    : "Top 20 by quantity sold · with revenue & product photos"}
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
        filterStore={filterStore || undefined}
        filterDepartment={filterDepartment || undefined}
        filterDesign={filterDesign || undefined}
        filterVendor={filterVendor || undefined}
        filterClass={filterClass || undefined}
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
