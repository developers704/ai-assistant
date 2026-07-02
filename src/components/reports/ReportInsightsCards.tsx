"use client";

import { formatCurrency } from "@/lib/utils";
import type { ReportSummary } from "@/lib/reports/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  CreditCard,
  Gem,
  Store,
  Tag,
  Percent,
  Wallet,
  Banknote,
  Truck,
  Layers,
  TrendingUp,
} from "lucide-react";

interface ReportInsightsProps {
  summary: ReportSummary;
  compact?: boolean;
}

export function ReportInsightsCards({ summary, compact }: ReportInsightsProps) {
  if (summary.source !== "report") return null;

  const isStoreSales =
    summary.schema === "store_sales" || summary.reportCategory === "sales";
  const isVendor =
    !isStoreSales &&
    (summary.schema === "vendor_pos" || summary.reportCategory === "vendor");
  const isFinancing =
    summary.schema === "financing" || summary.reportCategory === "financing";

  return (
    <div className="space-y-4">
      {isStoreSales && <Badge variant="success">Store sales report</Badge>}
      {isFinancing && <Badge variant="info">Financing report</Badge>}

      {isFinancing && (
        <>
          <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4"}`}>
            <Card className="p-4">
              <p className="text-xs text-ink-muted">Net sales</p>
              <p className="text-xl font-bold text-emerald-300 mt-1">
                {formatCurrency(summary.totalRevenue)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-muted">Total profit</p>
              <p className="text-xl font-bold text-amber-300 mt-1">
                {formatCurrency(summary.totalProfit ?? 0)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-muted">Transactions</p>
              <p className="text-xl font-bold text-ink mt-1">
                {(summary.transactionCount ?? summary.totalTransactions).toLocaleString()}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-muted">Avg. sale</p>
              <p className="text-xl font-bold text-ink mt-1">
                {formatCurrency(summary.averageOrderValue)}
              </p>
            </Card>
          </div>

          <div className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
            <Card className="p-4">
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <Banknote size={12} /> Cash
              </p>
              <p className="text-lg font-bold text-ink mt-1">
                {(summary.cashRate ?? 0).toFixed(1)}%
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <CreditCard size={12} /> Credit card
              </p>
              <p className="text-lg font-bold text-ink mt-1">
                {(summary.creditCardRate ?? 0).toFixed(1)}%
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <Wallet size={12} /> Financing
              </p>
              <p className="text-lg font-bold text-ink mt-1">
                {(summary.financingRate ?? 0).toFixed(1)}%
              </p>
            </Card>
          </div>
        </>
      )}

      {isStoreSales && (
        <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3"}`}>
          <Card className="p-4">
            <p className="text-xs text-ink-muted">Net sales</p>
            <p className="text-xl font-bold text-emerald-300 mt-1">{formatCurrency(summary.totalRevenue)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-ink-muted flex items-center gap-1.5">
              <TrendingUp size={12} /> Est. margin
            </p>
            <p className="text-xl font-bold text-amber-300 mt-1">
              {formatCurrency(summary.totalMargin ?? 0)}
            </p>
            {summary.marginRate != null && summary.marginRate > 0 && (
              <p className="text-[11px] text-ink-muted mt-0.5">
                {(summary.marginRate * 100).toFixed(1)}% of net
              </p>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-ink-muted">Line items</p>
            <p className="text-xl font-bold text-ink mt-1">
              {(summary.transactionCount ?? summary.totalTransactions).toLocaleString()}
            </p>
            {summary.uniqueTransactions != null && (
              <p className="text-[11px] text-ink-muted mt-0.5">
                {summary.uniqueTransactions.toLocaleString()} transactions
              </p>
            )}
          </Card>
        </div>
      )}

      {isVendor && (
        <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3"}`}>
          <Card className="p-4">
            <p className="text-xs text-ink-muted">Net sales</p>
            <p className="text-xl font-bold text-emerald-300 mt-1">{formatCurrency(summary.totalRevenue)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-ink-muted">Discounts</p>
            <p className="text-xl font-bold text-amber-300 mt-1">
              {formatCurrency(summary.discountTotal ?? 0)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-ink-muted">Units sold</p>
            <p className="text-xl font-bold text-ink mt-1">
              {summary.totalTransactions.toLocaleString()}
            </p>
          </Card>
        </div>
      )}

      <div className={`grid gap-4 ${compact ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {isFinancing && summary.paymentMethods && summary.paymentMethods.length > 0 && (
          <Card className="p-4">
            <CardHeader className="mb-2 p-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard size={14} className="text-indigo-300" /> Payment methods
              </CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {summary.paymentMethods.slice(0, 6).map((p) => (
                <div key={p.name} className="flex justify-between text-sm gap-2">
                  <span className="text-ink-secondary truncate">
                    {p.name}{" "}
                    <span className="text-ink-muted text-xs">({p.share.toFixed(1)}%)</span>
                  </span>
                  <span className="font-medium text-ink shrink-0">{formatCurrency(p.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {isFinancing && summary.financingProviders && summary.financingProviders.length > 0 && (
          <Card className="p-4">
            <CardHeader className="mb-2 p-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet size={14} className="text-amber-300" /> Pay programs
              </CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {summary.financingProviders.slice(0, 6).map((p) => (
                <div key={p.name} className="flex justify-between text-sm gap-2">
                  <span className="text-ink-secondary truncate">
                    {p.name}{" "}
                    <span className="text-ink-muted text-xs">({p.share.toFixed(1)}%)</span>
                  </span>
                  <span className="font-medium text-ink shrink-0">{formatCurrency(p.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {summary.topStores.length > 0 && (
          <Card className="p-4">
            <CardHeader className="mb-2 p-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Store size={14} className="text-cyan-300" /> Top stores
              </CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {summary.topStores.slice(0, 6).map((s) => (
                <div key={s.name} className="flex justify-between text-sm gap-2">
                  <span className="text-ink-secondary truncate">{s.name}</span>
                  <span className="font-medium text-ink shrink-0">{formatCurrency(s.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {summary.topDepartments && summary.topDepartments.length > 0 && (
          <Card className="p-4">
            <CardHeader className="mb-2 p-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag size={14} className="text-violet-300" /> Top departments
              </CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {summary.topDepartments.slice(0, 6).map((d) => (
                <div key={d.name} className="flex justify-between text-sm gap-2">
                  <span className="text-ink-secondary truncate">{d.name}</span>
                  <span className="font-medium text-ink shrink-0">{formatCurrency(d.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {summary.topVendors && summary.topVendors.length > 0 && (
          <Card className="p-4">
            <CardHeader className="mb-2 p-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck size={14} className="text-orange-300" /> Top vendors
              </CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {summary.topVendors.slice(0, 6).map((v) => (
                <div key={v.name} className="flex justify-between text-sm gap-2">
                  <span className="text-ink-secondary truncate">{v.name}</span>
                  <span className="font-medium text-ink shrink-0">{formatCurrency(v.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {summary.topDesigns && summary.topDesigns.length > 0 && (
          <Card className="p-4">
            <CardHeader className="mb-2 p-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gem size={14} className="text-fuchsia-300" /> Top design lines
              </CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {summary.topDesigns.slice(0, 6).map((d) => (
                <div key={d.name} className="flex justify-between text-sm gap-2">
                  <span className="text-ink-secondary truncate">{d.name}</span>
                  <span className="font-medium text-ink shrink-0">{formatCurrency(d.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {summary.topClasses && summary.topClasses.length > 0 && (
          <Card className="p-4">
            <CardHeader className="mb-2 p-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers size={14} className="text-emerald-300" /> Top metal / class
              </CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {summary.topClasses.slice(0, 6).map((c) => (
                <div key={c.name} className="flex justify-between text-sm gap-2">
                  <span className="text-ink-secondary truncate">{c.name}</span>
                  <span className="font-medium text-ink shrink-0">{formatCurrency(c.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {isStoreSales && (summary.discountTotal ?? 0) > 0 && (
        <p className="text-xs text-ink-muted flex items-center gap-1.5">
          <Percent size={12} /> Total discounts: {formatCurrency(summary.discountTotal ?? 0)}
          {summary.grossSales
            ? ` (${(((summary.discountTotal ?? 0) / summary.grossSales) * 100).toFixed(1)}% of gross)`
            : ""}
        </p>
      )}

      {isVendor && summary.avgDiscountRate != null && summary.avgDiscountRate > 0 && (
        <p className="text-xs text-ink-muted flex items-center gap-1.5">
          <Percent size={12} /> Avg discount rate: {(summary.avgDiscountRate * 100).toFixed(1)}%
        </p>
      )}

      {(isFinancing || isStoreSales) && summary.recommendations.length > 0 && (
        <Card className="p-4 ring-1 ring-indigo-400/15">
          <p className="text-xs font-medium text-indigo-200 mb-2">Insights</p>
          <ul className="space-y-1.5 text-sm text-ink-secondary">
            {summary.recommendations.slice(0, 4).map((rec) => (
              <li key={rec}>• {rec}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
