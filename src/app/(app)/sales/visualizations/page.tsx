"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  PageShell,
  PageShellHeader,
  PageShellBody,
  LushMetric,
} from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatPieceCount, cn } from "@/lib/utils";
import {
  formatReportDateDisplay,
  formatReportDateRange,
  isValidIsoDate,
} from "@/lib/reports/date-utils";
import type { SalesVisualizationPayload } from "@/lib/sales/visualizations";
import {
  SalesTrendChart,
  SalesHBarChart,
  SalesDonutChart,
  SalesModelsChart,
} from "@/components/sales/SalesVizCharts";
import { ArrowLeft, CalendarDays, LineChart, Sparkles } from "lucide-react";

const selectClass =
  "select-dark px-3 py-2 rounded-xl text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/40 min-w-[8.5rem]";

export default function SalesVisualizationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64 text-ink-muted animate-pulse">
          Loading visualizations…
        </div>
      }
    >
      <SalesVisualizationsContent />
    </Suspense>
  );
}

function SalesVisualizationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<SalesVisualizationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterDate, setFilterDate] = useState(() => {
    const d = searchParams.get("date");
    return d && isValidIsoDate(d) ? d : "";
  });
  const [filterStore, setFilterStore] = useState(() => searchParams.get("store") ?? "");
  const [filterDepartment, setFilterDepartment] = useState(
    () => searchParams.get("department") ?? ""
  );
  const [filterDesign, setFilterDesign] = useState(() => searchParams.get("design") ?? "");
  const [filterVendor, setFilterVendor] = useState(() => searchParams.get("vendor") ?? "");
  const [filterClass, setFilterClass] = useState(() => searchParams.get("class") ?? "");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterDate) params.set("date", filterDate);
    if (filterStore) params.set("store", filterStore);
    if (filterDepartment) params.set("department", filterDepartment);
    if (filterDesign) params.set("design", filterDesign);
    if (filterVendor) params.set("vendor", filterVendor);
    if (filterClass) params.set("class", filterClass);
    const qs = params.toString();
    router.replace(qs ? `/sales/visualizations?${qs}` : "/sales/visualizations", {
      scroll: false,
    });

    setLoading(true);
    setError(null);
    let cancelled = false;
    fetch(`/api/sales/visualizations${qs ? `?${qs}` : ""}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load visualizations");
        return r.json() as Promise<SalesVisualizationPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    filterDate,
    filterStore,
    filterDepartment,
    filterDesign,
    filterVendor,
    filterClass,
    router,
  ]);

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filterDate) params.set("date", filterDate);
    if (filterStore) params.set("store", filterStore);
    if (filterDepartment) params.set("department", filterDepartment);
    if (filterDesign) params.set("design", filterDesign);
    if (filterClass) params.set("class", filterClass);
    const qs = params.toString();
    return qs ? `/sales?${qs}` : "/sales";
  }, [filterDate, filterStore, filterDepartment, filterDesign, filterClass]);

  const clearFilters = () => {
    setFilterDate("");
    setFilterStore("");
    setFilterDepartment("");
    setFilterDesign("");
    setFilterVendor("");
    setFilterClass("");
  };

  const hasFilters = Boolean(
    filterDate || filterStore || filterDepartment || filterDesign || filterVendor || filterClass
  );

  return (
    <PageShell>
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Sales"
          title="Sales Visualizations"
          subtitle={
            data?.reportLabel
              ? `${data.reportLabel} · interactive trends & rankings`
              : "Interactive trends, designs, stores & vendors"
          }
          action={
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Badge variant="success" className="gap-1">
                <Sparkles size={12} />
                Live charts
              </Badge>
              <Link href={backHref}>
                <Button size="sm" variant="secondary" className="gap-1.5">
                  <ArrowLeft size={14} />
                  Sales dashboard
                </Button>
              </Link>
            </div>
          }
        />
      </PageShellHeader>

      <PageShellBody>
        <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3 sm:p-4 mb-4 sm:mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays size={15} className="text-ink-muted shrink-0" />
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={selectClass}
              aria-label="Filter by date"
            >
              <option value="">
                All dates
                {data?.dateRange.from && data.dateRange.to
                  ? ` (${formatReportDateRange(data.dateRange.from, data.dateRange.to)})`
                  : ""}
              </option>
              {[...(data?.filters.dates ?? [])].reverse().map((d) => (
                <option key={d} value={d}>
                  {formatReportDateDisplay(d)}
                </option>
              ))}
            </select>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className={selectClass}
              aria-label="Filter by store"
            >
              <option value="">All stores</option>
              {(data?.filters.stores ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className={selectClass}
              aria-label="Filter by department"
            >
              <option value="">All departments</option>
              {(data?.filters.departments ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterDesign}
              onChange={(e) => setFilterDesign(e.target.value)}
              className={selectClass}
              aria-label="Filter by design"
            >
              <option value="">All designs</option>
              {(data?.filters.designs ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              className={selectClass}
              aria-label="Filter by vendor"
            >
              <option value="">All vendors</option>
              {(data?.filters.vendors ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className={selectClass}
              aria-label="Filter by class"
            >
              <option value="">All classes</option>
              {(data?.filters.classes ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-cyan-300/90 hover:text-cyan-200 px-2 py-1"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center h-64 text-ink-muted animate-pulse">
            Loading visualizations…
          </div>
        ) : error && !data ? (
          <div className="rounded-2xl ring-1 ring-rose-400/30 bg-rose-500/10 p-6 text-center">
            <p className="text-sm text-rose-200">{error}</p>
          </div>
        ) : data ? (
          <>
            <div
              className={cn(
                "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5",
                loading && "opacity-70 transition-opacity"
              )}
            >
              <LushMetric
                label="Net Sales"
                value={formatCurrency(data.summary.netSales)}
                accent="emerald"
                footer={
                  <p className="text-xs text-white/40">
                    {data.summary.matchingRowCount.toLocaleString()} lines
                  </p>
                }
              />
              <LushMetric
                label="Units Sold"
                value={formatPieceCount(data.summary.unitsSold)}
                footer={
                  <p className="text-xs text-white/40">
                    {data.summary.transactions.toLocaleString()} transactions
                  </p>
                }
              />
              <LushMetric
                label="Avg Sale"
                value={formatCurrency(data.summary.averageUnitPrice)}
                footer={<p className="text-xs text-white/40">Per unit</p>}
              />
              <LushMetric
                label="Discounts"
                value={formatCurrency(data.summary.discounts)}
                footer={
                  <p className="text-xs text-white/40">
                    Gross {formatCurrency(data.summary.grossSales)}
                  </p>
                }
              />
            </div>

            <div className="flex items-center gap-2 mb-3 text-ink-muted">
              <LineChart size={14} className="text-cyan-300" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Trends & mix</p>
            </div>

            <div
              className={cn(
                "grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4",
                loading && "opacity-70 transition-opacity"
              )}
            >
              <SalesTrendChart data={data.charts.byDate} />
              <SalesDonutChart
                title="Design mix"
                subtitle="Share of net sales by design"
                data={data.charts.byDesign}
              />
              <SalesHBarChart
                title="Top stores"
                subtitle="Click Revenue / Units"
                data={data.charts.byStore}
              />
              <SalesHBarChart
                title="Departments"
                subtitle="Net sales by department"
                data={data.charts.byDepartment}
              />
              <SalesDonutChart
                title="Class mix"
                subtitle="Product class share"
                data={data.charts.byClass}
              />
              <SalesHBarChart
                title="Top vendors"
                subtitle="Vendor ranking"
                data={data.charts.byVendor}
              />
              <SalesModelsChart data={data.charts.topVendorModels} />
            </div>
          </>
        ) : null}
      </PageShellBody>
    </PageShell>
  );
}
