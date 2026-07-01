"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, sortTopProducts } from "@/lib/utils";
import type { SalesSummary } from "@/types";
import type { ReportSummary } from "@/lib/reports/types";
import { ReportInsightsCards } from "@/components/reports/ReportInsightsCards";
import { TopProductsTable } from "@/components/reports/TopProductsTable";
import { TrendingUp, TrendingDown, Package, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SalesPage() {
  const { sendChat } = useApp();
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [dataSource, setDataSource] = useState<"mock" | "report">("mock");

  useEffect(() => {
    fetch("/api/sales")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
        setDataSource(d.source === "report" ? "report" : "mock");
        if (d.source === "report") setReportSummary(d.summary as ReportSummary);
      });
  }, []);

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
  const topProducts = sortTopProducts(summary.topProducts).slice(0, 20);

  const isFinancingReport =
    reportSummary?.schema === "financing" || reportSummary?.reportCategory === "financing";

  return (
    <div className="flex flex-col min-h-0">
      <div className="glass-panel-strong rounded-3xl ring-1 ring-white/10 overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
          <PageHeader
            title={isFinancingReport ? "Financing & Sales Reports" : "Sales Reports"}
            subtitle={
              dataSource === "report" && reportSummary?.reportLabel
                ? reportSummary.reportLabel
                : isFinancingReport
                  ? "Payment mix, financing programs, and store performance"
                  : "Daily performance · Valliani Jewelers"
            }
            action={
              <div className="flex items-center gap-2">
                {dataSource === "report" && (
                  <Badge variant="success">Live report</Badge>
                )}
                <Button size="sm" onClick={() => sendChat("Show me today's sales across all stores")}>
                  Ask Assistant
                </Button>
              </div>
            }
          />
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label={isFinancingReport ? "Net Sales" : "Total Revenue"}
              value={formatCurrency(summary.totalRevenue)}
              footer={
                <div className="flex items-center gap-1.5">
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
            <MetricCard
              label={isFinancingReport ? "Sales Transactions" : "Pieces Sold"}
              value={summary.totalTransactions.toLocaleString()}
              footer={
                <p className="text-sm text-ink-muted">
                  {isFinancingReport
                    ? "Sales rows in report period"
                    : "Across reporting stores today"}
                </p>
              }
            />
            <MetricCard
              label={isFinancingReport ? "Total Profit" : "Avg. Sale Value"}
              value={
                isFinancingReport
                  ? formatCurrency(reportSummary?.totalProfit ?? 0)
                  : formatCurrency(summary.averageOrderValue)
              }
              footer={
                <p className="text-sm text-ink-muted">
                  {isFinancingReport
                    ? `Avg sale ${formatCurrency(summary.averageOrderValue)}`
                    : `+${summary.comparisonPreviousWeek.toFixed(1)}% vs last week`}
                </p>
              }
            />
          </div>

          {reportSummary && dataSource === "report" && (
            <ReportInsightsCards summary={reportSummary} />
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card className="p-0 overflow-hidden">
              <CardHeader className="px-4 pt-4 pb-3 border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store size={17} className="text-accent-rose" />
                  Worst Performing Stores
                </CardTitle>
                <span className="text-xs text-ink-muted">Lowest revenue in report</span>
              </CardHeader>
              <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-4 space-y-3">
                {worstStores.map((store, i) => (
                  <div key={store.name} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-3 items-center">
                    <span className="text-xs font-medium text-ink-muted tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="flex justify-between gap-3 mb-1.5">
                        <span className="text-sm font-medium text-ink truncate">{store.name}</span>
                        <span className="text-sm font-semibold text-ink tabular-nums shrink-0">
                          {formatCurrency(store.revenue)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-rose/80 rounded-full transition-all"
                          style={{ width: `${(store.revenue / maxWorstRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums w-12 text-right",
                        store.change >= 0 ? "text-emerald-400" : "text-accent-rose"
                      )}
                    >
                      {store.change >= 0 ? "+" : ""}
                      {store.change.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <CardHeader className="px-4 pt-4 pb-3 border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package size={17} className="text-sky-300" />
                  {isFinancingReport ? "Top Pay Programs" : "Top Products"}
                </CardTitle>
                <span className="text-xs text-ink-muted">
                  {isFinancingReport ? "By net sales amount" : "Highest revenue first"}
                </span>
              </CardHeader>
              <div className="p-3 sm:p-4">
                <TopProductsTable products={topProducts} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  footer,
}: {
  label: string;
  value: string;
  footer: React.ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-ink-secondary">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold text-ink mt-1 tabular-nums">{value}</p>
      <div className="mt-2">{footer}</div>
    </Card>
  );
}
