"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatPieceCount, sortTopProducts } from "@/lib/utils";
import type { SalesSummary } from "@/types";
import type { ReportSummary } from "@/lib/reports/types";
import { ReportInsightsCards } from "@/components/reports/ReportInsightsCards";
import { TrendingUp, TrendingDown, Package } from "lucide-react";

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

  return (
    <div>
      <PageHeader
        title="Sales Reports"
        subtitle={
          dataSource === "report" && reportSummary?.reportLabel
            ? `${reportSummary.vendorCode ? reportSummary.vendorCode + " · " : ""}${reportSummary.reportLabel}`
            : "Daily performance · Valliani Jewelers"
        }
        action={
          <Button size="sm" onClick={() => sendChat("Show me today's sales across all stores")}>
            Ask Assistant
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <Card className="p-5">
          <p className="text-sm text-ink-secondary">Total Revenue</p>
          <p className="text-3xl font-bold text-ink mt-1">{formatCurrency(summary.totalRevenue)}</p>
          <div className="flex items-center gap-1 mt-2 text-sm">
            {summary.comparisonPreviousDay >= 0 ? (
              <TrendingUp size={14} className="text-emerald-600" />
            ) : (
              <TrendingDown size={14} className="text-accent-rose" />
            )}
            <span className={summary.comparisonPreviousDay >= 0 ? "text-emerald-600" : "text-accent-rose"}>
              {summary.comparisonPreviousDay >= 0 ? "+" : ""}{summary.comparisonPreviousDay.toFixed(1)}% vs yesterday
            </span>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-secondary">Pieces Sold</p>
          <p className="text-3xl font-bold text-ink mt-1">{summary.totalTransactions}</p>
          <p className="text-sm text-ink-muted mt-2">Across reporting stores today</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-secondary">Avg. Sale Value</p>
          <p className="text-3xl font-bold text-ink mt-1">{formatCurrency(summary.averageOrderValue)}</p>
          <p className="text-sm text-ink-muted mt-2">+{summary.comparisonPreviousWeek.toFixed(1)}% vs last week</p>
        </Card>
      </div>

      {reportSummary && dataSource === "report" && (
        <div className="mb-6">
          <ReportInsightsCards summary={reportSummary} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown size={18} className="text-accent-rose" /> Worst Performing Stores
            </CardTitle>
            <span className="text-xs text-ink-muted">Lowest revenue in report</span>
          </CardHeader>
          <div className="space-y-3">
            {worstStores.map((store, i) => (
              <div key={store.name} className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink-muted w-6">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-ink">{store.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(store.revenue)}</span>
                  </div>
                  <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-rose/70 rounded-full"
                      style={{ width: `${(store.revenue / maxWorstRevenue) * 100}%` }}
                    />
                  </div>
                </div>
                <span className={`text-xs ${store.change >= 0 ? "text-emerald-600" : "text-accent-rose"}`}>
                  {store.change >= 0 ? "+" : ""}{store.change.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package size={18} className="text-brand-600" /> Top Products
            </CardTitle>
            <span className="text-xs text-ink-muted">Highest revenue first</span>
          </CardHeader>
          <div className="space-y-2.5">
            {topProducts.map((product, i) => (
              <div
                key={`${product.itemNumber ?? ""}-${product.name}-${i}`}
                className="flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="text-sm font-medium text-ink-muted w-5 shrink-0 pt-0.5 tabular-nums">
                    {i + 1}
                  </span>
                  <p className="text-sm text-ink leading-snug min-w-0">
                    {product.itemNumber && (
                      <span className="font-mono text-cyan-300/90 text-xs">#{product.itemNumber} · </span>
                    )}
                    <span className="font-medium break-words">{product.name}</span>
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums whitespace-nowrap pt-0.5">
                  <span className="font-semibold text-ink">{formatCurrency(product.revenue)}</span>
                  <span className="text-ink-muted text-xs font-normal ml-1.5">
                    · {formatPieceCount(product.units)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
