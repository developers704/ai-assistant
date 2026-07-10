"use client";

import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ReportSummary } from "@/lib/reports/types";
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
  Sparkles,
} from "lucide-react";

interface ReportInsightsProps {
  summary: ReportSummary;
  compact?: boolean;
}

function RankedList({
  title,
  icon: Icon,
  iconClass,
  items,
}: {
  title: string;
  icon: typeof Store;
  iconClass: string;
  items: { name: string; revenue: number }[];
}) {
  const max = items[0]?.revenue ?? 1;
  return (
    <section className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]", iconClass)}>
          <Icon size={14} strokeWidth={1.85} />
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.slice(0, 5).map((item, i) => (
          <div key={item.name}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm text-white/75 truncate">{item.name}</span>
              <span className="text-sm font-semibold text-white tabular-nums shrink-0">
                {formatCurrency(item.revenue)}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500/60 to-fuchsia-500/40 transition-all duration-500"
                style={{ width: `${Math.max(8, (item.revenue / max) * 100)}%` }}
              />
            </div>
            {i === 0 && (
              <span className="sr-only">Rank {i + 1}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
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
      {isStoreSales && (
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
          Store sales report
        </span>
      )}
      {isFinancing && (
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/25">
          Financing report
        </span>
      )}

      {isFinancing && (
        <>
          <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4"}`}>
            <MetricCard label="Net sales" value={formatCurrency(summary.totalRevenue)} accent="emerald" />
            <MetricCard label="Total profit" value={formatCurrency(summary.totalProfit ?? 0)} accent="amber" />
            <MetricCard label="Transactions" value={(summary.transactionCount ?? summary.totalTransactions).toLocaleString()} />
            <MetricCard label="Avg. sale" value={formatCurrency(summary.averageOrderValue)} />
          </div>
          <div className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
            <SmallMetric icon={Banknote} label="Cash" value={`${(summary.cashRate ?? 0).toFixed(1)}%`} />
            <SmallMetric icon={CreditCard} label="Credit card" value={`${(summary.creditCardRate ?? 0).toFixed(1)}%`} />
            <SmallMetric icon={Wallet} label="Financing" value={`${(summary.financingRate ?? 0).toFixed(1)}%`} />
          </div>
        </>
      )}

      {isStoreSales && (
        <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3"}`}>
          <MetricCard label="Net sales" value={formatCurrency(summary.totalRevenue)} accent="emerald" />
          <MetricCard
            label="Est. margin"
            value={formatCurrency(summary.totalMargin ?? 0)}
            sub={summary.marginRate != null && summary.marginRate > 0 ? `${(summary.marginRate * 100).toFixed(1)}% of net` : undefined}
            accent="amber"
            icon={TrendingUp}
          />
          <MetricCard
            label="Line items"
            value={(summary.transactionCount ?? summary.totalTransactions).toLocaleString()}
            sub={summary.uniqueTransactions != null ? `${summary.uniqueTransactions.toLocaleString()} transactions` : undefined}
          />
        </div>
      )}

      {isVendor && (
        <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3"}`}>
          <MetricCard label="Net sales" value={formatCurrency(summary.totalRevenue)} accent="emerald" />
          <MetricCard label="Discounts" value={formatCurrency(summary.discountTotal ?? 0)} accent="amber" />
          <MetricCard label="Units sold" value={summary.totalTransactions.toLocaleString()} />
        </div>
      )}

      <div className={`grid gap-4 ${compact ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {isFinancing && summary.paymentMethods && summary.paymentMethods.length > 0 && (
          <ListCard title="Payment methods" icon={CreditCard} iconColor="text-indigo-300" items={summary.paymentMethods} />
        )}
        {isFinancing && summary.financingProviders && summary.financingProviders.length > 0 && (
          <ListCard title="Pay programs" icon={Wallet} iconColor="text-amber-300/75" items={summary.financingProviders} />
        )}
        {summary.topStores.length > 0 && (
          <ListCard title="Top stores" icon={Store} iconColor="text-cyan-300/75" items={summary.topStores} />
        )}
        {summary.topDepartments && summary.topDepartments.length > 0 && (
          <ListCard title="Top departments" icon={Tag} iconColor="text-violet-300/75" items={summary.topDepartments} />
        )}
        {summary.topVendors && summary.topVendors.length > 0 && (
          <ListCard title="Top vendors" icon={Truck} iconColor="text-orange-300/75" items={summary.topVendors} />
        )}
        {summary.topDesigns && summary.topDesigns.length > 0 && (
          <ListCard title="Top design lines" icon={Gem} iconColor="text-fuchsia-300/75" items={summary.topDesigns} />
        )}
        {summary.topClasses && summary.topClasses.length > 0 && (
          <ListCard title="Top metal / class" icon={Layers} iconColor="text-emerald-300/75" items={summary.topClasses} />
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
        <div className="rounded-3xl p-5 glass-panel ring-1 ring-indigo-400/15">
          <p className="text-xs font-medium text-indigo-200 mb-2">Insights</p>
          <ul className="space-y-1.5 text-sm text-ink-secondary">
            {summary.recommendations.slice(0, 4).map((rec) => (
              <li key={rec}>• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "amber";
  icon?: typeof TrendingUp;
}) {
  const valueColor =
    accent === "emerald" ? "text-emerald-300 font-bold" : accent === "amber" ? "text-gold-metric" : "text-ink font-bold";
  return (
    <div className="rounded-3xl p-4 glass-panel">
      <p className="text-xs text-ink-muted flex items-center gap-1.5">
        {Icon && <Icon size={12} />} {label}
      </p>
      <p className={cn("text-xl mt-1", valueColor)}>{value}</p>
      {sub && <p className="text-[11px] text-ink-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function SmallMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl p-4 glass-panel">
      <p className="text-xs text-ink-muted flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </p>
      <p className="text-lg font-bold text-ink mt-1">{value}</p>
    </div>
  );
}

function ListCard({
  title,
  icon: Icon,
  iconColor,
  items,
}: {
  title: string;
  icon: typeof Store;
  iconColor: string;
  items: { name: string; revenue: number; share?: number }[];
}) {
  return (
    <div className="rounded-3xl p-4 glass-panel">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={iconColor} strokeWidth={1.85} />
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      <div className="space-y-2">
        {items.slice(0, 6).map((item) => (
          <div key={item.name} className="flex justify-between text-sm gap-2">
            <span className="text-ink-secondary truncate">
              {item.name}
              {item.share != null && (
                <span className="text-ink-muted text-xs"> ({item.share.toFixed(1)}%)</span>
              )}
            </span>
            <span className="font-medium text-ink shrink-0">{formatCurrency(item.revenue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
