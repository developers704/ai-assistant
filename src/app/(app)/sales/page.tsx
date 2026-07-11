"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import {
  PageShell,
  PageShellHeader,
  PageShellBody,
  LushMetric,
} from "@/components/layout/PageShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
import {
  formatReportDateDisplay,
  formatReportDateRange,
  isValidIsoDate,
} from "@/lib/reports/date-utils";
import { TrendingUp, TrendingDown, Package, Store, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const selectClass =
  "select-dark px-3 py-2 rounded-xl text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/40";

export default function SalesPage() {
  const { sendChat } = useApp();
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams.get("date");
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
  const [filterDate, setFilterDate] = useState<string>(() =>
    dateFromUrl && isValidIsoDate(dateFromUrl) ? dateFromUrl : ""
  );
  const [filterStore, setFilterStore] = useState(() => storeFromUrl ?? "");
  const [filterDepartment, setFilterDepartment] = useState(() => departmentFromUrl ?? "");
  const [filterDesign, setFilterDesign] = useState(() => designFromUrl ?? "");
  const [reportId, setReportId] = useState<string | undefined>();
  const [rankDetail, setRankDetail] = useState<RankDetailSelection | null>(null);

  useEffect(() => {
    if (dateFromUrl && isValidIsoDate(dateFromUrl) && dateFromUrl !== filterDate) {
      setFilterDate(dateFromUrl);
    }
    if (storeFromUrl != null && storeFromUrl !== filterStore) setFilterStore(storeFromUrl);
    if (departmentFromUrl != null && departmentFromUrl !== filterDepartment) {
      setFilterDepartment(departmentFromUrl);
    }
    if (designFromUrl != null && designFromUrl !== filterDesign) setFilterDesign(designFromUrl);
  }, [
    dateFromUrl,
    storeFromUrl,
    departmentFromUrl,
    designFromUrl,
    filterDate,
    filterStore,
    filterDepartment,
    filterDesign,
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

  // vendor/class URL params open detail when present (dashboard may not have vendor/class selects yet)
  useEffect(() => {
    if (vendorFromUrl) {
      setRankDetail({ dimension: "vendor", value: vendorFromUrl });
    } else if (classFromUrl) {
      setRankDetail({ dimension: "class", value: classFromUrl });
    }
  }, [vendorFromUrl, classFromUrl]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterDate) params.set("date", filterDate);
    if (filterStore) params.set("store", filterStore);
    if (filterDepartment) params.set("department", filterDepartment);
    if (filterDesign) params.set("design", filterDesign);
    const qs = params.toString() ? `?${params}` : "";
    fetch(`/api/sales${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
        setDataSource(d.source === "report" ? "report" : "mock");
        if (d.source === "report") {
          setReportSummary(d.summary as ReportSummary);
          setAvailableDates(d.availableDates ?? []);
          setAvailableStores(d.availableStores ?? []);
          setAvailableDepartments(d.availableDepartments ?? []);
          setAvailableDesigns(d.availableDesigns ?? []);
          setReportId(d.report?.id ?? filterDate ?? d.reportDate ?? "latest");
          // Drop stale date filter if the new latest report doesn't include it
          const dates: string[] = d.availableDates ?? [];
          if (filterDate && dates.length && !dates.includes(filterDate)) {
            setFilterDate("");
          }
        } else {
          setReportSummary(null);
          setAvailableDates([]);
          setAvailableStores([]);
          setAvailableDepartments([]);
          setAvailableDesigns([]);
          setReportId(undefined);
        }
      });
  }, [filterDate, filterStore, filterDepartment, filterDesign, refreshNonce]);

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

  const subtitleDate =
    filterDate && reportSummary?.dateRange
      ? formatReportDateDisplay(filterDate)
      : reportSummary?.dateRange
        ? formatReportDateRange(reportSummary.dateRange.from, reportSummary.dateRange.to)
        : null;

  const pageSubtitle =
    dataSource === "report" && reportSummary?.reportLabel
      ? subtitleDate
        ? `${reportSummary.reportLabel} · ${subtitleDate}`
        : reportSummary.reportLabel
      : isFinancingReport
        ? "Payment mix, financing programs, and store performance"
        : isStoreSalesReport
          ? "Company-wide store sales · departments, vendors & designs"
          : "Daily performance · Valliani Jewelers";

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
            subtitle={pageSubtitle}
            action={
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {(availableDates.length > 0 ||
                  availableStores.length > 0 ||
                  availableDepartments.length > 0 ||
                  availableDesigns.length > 0 ||
                  reportSummary?.dateRange) && (
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <CalendarDays size={15} className="text-ink-muted shrink-0" />
                    <select
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className={selectClass}
                      aria-label="Filter by date"
                    >
                      <option value="">
                        All dates
                        {reportSummary?.dateRange
                          ? ` (${formatReportDateRange(
                              reportSummary.dateRange.from,
                              reportSummary.dateRange.to
                            )})`
                          : ""}
                      </option>
                      {[...availableDates].reverse().map((d) => (
                        <option key={d} value={d}>
                          {formatReportDateDisplay(d)}
                        </option>
                      ))}
                    </select>
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
                  </div>
                )}
                {dataSource === "report" && (
                  <Badge variant="success">Live report</Badge>
                )}
                <Button size="sm" onClick={() => sendChat("Show me today's sales across all stores")}>
                  Ask Assistant
                </Button>
              </div>
            }
          />
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
        filterDate={filterDate || undefined}
        filterStore={filterStore || undefined}
        filterDepartment={filterDepartment || undefined}
        filterDesign={filterDesign || undefined}
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
