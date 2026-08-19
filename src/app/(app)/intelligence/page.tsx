"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import {
  PageShell,
  PageShellHeader,
  PageShellBody,
  LushMetric,
} from "@/components/layout/PageShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn, formatCurrency } from "@/lib/utils";
import type { IntelligenceReport } from "@/lib/intelligence/types";
import {
  AlertTriangle,
  Brain,
  Building2,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

type Tab =
  | "overview"
  | "stores"
  | "departments"
  | "products"
  | "people"
  | "customers"
  | "forecast"
  | "issues";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stores", label: "Stores" },
  { id: "departments", label: "Dept & Design" },
  { id: "products", label: "Products" },
  { id: "people", label: "Salespeople" },
  { id: "customers", label: "Customers" },
  { id: "forecast", label: "Forecast" },
  { id: "issues", label: "Issues" },
];

const selectClass =
  "select-dark px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30";

function indexColor(index: number): string {
  if (index >= 115) return "text-emerald-400";
  if (index >= 95) return "text-white/70";
  return "text-rose-400";
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === "high"
      ? "bg-rose-500/20 text-rose-200 ring-rose-400/30"
      : severity === "medium"
        ? "bg-amber-500/20 text-amber-100 ring-amber-400/30"
        : "bg-white/10 text-white/60 ring-white/15";
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ring-1", cls)}>
      {severity}
    </span>
  );
}

export default function IntelligencePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [store, setStore] = useState("");
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [stores, setStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (store) params.set("store", store);
      const qs = params.toString();
      const res = await fetch(`/api/intelligence${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setReport(json.report);
      setStores(json.availableStores ?? []);
      if (!from && json.report?.filter?.dateFrom) setFrom(json.report.filter.dateFrom);
      if (!to && json.report?.filter?.dateTo) setTo(json.report.filter.dateTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, store]);

  useEffect(() => {
    void load();
  }, [load]);

  const yoyClass = useMemo(() => {
    const y = report?.summary.yoyNetPct;
    if (y == null) return "text-white/50";
    return y >= 0 ? "text-emerald-400" : "text-rose-400";
  }, [report?.summary.yoyNetPct]);

  return (
    <PageShell accent="violet">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Analytics"
          title="Sales Intelligence"
          subtitle="Stores · departments · designs · customers · forecast · issues"
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-white/70 ring-1 ring-white/15 hover:bg-white/10"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          }
        />
      </PageShellHeader>

      <PageShellBody>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-white/40">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={cn(selectClass, "mt-1 block")}
            />
          </label>
          <label className="text-xs text-white/40">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={cn(selectClass, "mt-1 block")}
            />
          </label>
          <label className="text-xs text-white/40">
            Store
            <select
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className={cn(selectClass, "mt-1 block min-w-[10rem]")}
            >
              <option value="">All stores</option>
              {stores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-violet-500/25 px-4 py-2 text-sm font-medium text-violet-100 ring-1 ring-violet-400/35 hover:bg-violet-500/35"
          >
            Apply
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-violet-500/30 text-violet-50 ring-1 ring-violet-400/40"
                  : "text-white/45 hover:bg-white/5 hover:text-white/70"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && !report && (
          <div className="flex h-48 items-center justify-center gap-2 text-white/40">
            <Loader2 className="animate-spin" size={18} />
            Building intelligence report…
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100 ring-1 ring-rose-400/30">
            {error}
          </div>
        )}

        {report && (
          <>
            {(tab === "overview" || tab === "stores") && (
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <LushMetric
                  label="Net Sales"
                  value={formatCurrency(report.summary.netSales)}
                  accent="violet"
                  footer={
                    <span className={cn("text-sm", yoyClass)}>
                      {report.summary.yoyNetPct != null
                        ? `${report.summary.yoyNetPct >= 0 ? "+" : ""}${report.summary.yoyNetPct.toFixed(1)}% ${report.summary.yoyLabel}`
                        : "—"}
                    </span>
                  }
                />
                <LushMetric
                  label="Customers"
                  value={report.summary.customerCount.toLocaleString()}
                  footer={
                    <span className="text-sm text-white/45">
                      {report.customers.retention.repeatRatePct}% repeat rate
                    </span>
                  }
                />
                <LushMetric
                  label="Avg Ticket"
                  value={formatCurrency(report.summary.avgTicket)}
                  footer={
                    <span className="text-sm text-white/45">
                      {report.summary.transactions.toLocaleString()} txns
                    </span>
                  }
                />
                <LushMetric
                  label="Forecast (next mo.)"
                  value={
                    report.forecast.projectedMonthNet
                      ? formatCurrency(report.forecast.projectedMonthNet)
                      : "—"
                  }
                  accent="amber"
                  footer={
                    <span className="text-sm text-white/45">
                      {report.forecast.trendPct != null
                        ? `${report.forecast.trendPct >= 0 ? "+" : ""}${report.forecast.trendPct}% MoM`
                        : "Trend n/a"}
                    </span>
                  }
                />
              </div>
            )}

            {tab === "overview" && (
              <Card className="mb-4 border border-violet-400/20 bg-violet-500/5">
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 shrink-0 text-violet-300" size={18} />
                  <div>
                    <p className="text-sm font-medium text-violet-100">Athena Brief</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/60">{report.brief}</p>
                  </div>
                </div>
              </Card>
            )}

            {(tab === "overview" || tab === "stores") && (
              <Card className="mb-4 overflow-hidden p-0">
                <CardHeader className="border-b border-white/10 px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 size={16} className="text-violet-300" />
                    Store performance
                  </CardTitle>
                  <span className="text-xs text-white/40">Index 100 = chain average</span>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/35">
                        <th className="px-4 py-2">Store</th>
                        <th className="px-4 py-2 text-right">Net</th>
                        <th className="px-4 py-2 text-right">Index</th>
                        <th className="px-4 py-2 text-right">Disc %</th>
                        <th className="px-4 py-2 text-right">Avg ticket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.stores.slice(0, 20).map((s) => (
                        <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                          <td className="px-4 py-2 font-medium text-white/85">{s.label}</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {formatCurrency(s.netSales)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-2 text-right tabular-nums font-semibold",
                              indexColor(s.indexVsChain ?? 100)
                            )}
                          >
                            {s.indexVsChain ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-white/55">
                            {s.discountPct.toFixed(1)}%
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-white/55">
                            {formatCurrency(s.avgTicket)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {(tab === "overview" || tab === "departments") && (
              <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="overflow-hidden p-0">
                  <CardHeader className="border-b border-white/10 px-4 py-3">
                    <CardTitle className="text-base">Best store by department</CardTitle>
                    <span className="text-xs text-white/40">Highest index vs chain</span>
                  </CardHeader>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase text-white/35">
                          <th className="px-4 py-2">Department</th>
                          <th className="px-4 py-2">Store</th>
                          <th className="px-4 py-2 text-right">Index</th>
                          <th className="px-4 py-2 text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.bestStoreByDepartment.map((r) => (
                          <tr key={r.department} className="border-t border-white/5">
                            <td className="px-4 py-2 text-white/80">{r.department}</td>
                            <td className="px-4 py-2 text-violet-200">{r.store}</td>
                            <td
                              className={cn(
                                "px-4 py-2 text-right font-semibold tabular-nums",
                                indexColor(r.index)
                              )}
                            >
                              {r.index}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-white/50">
                              {formatCurrency(r.netSales)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="overflow-hidden p-0">
                  <CardHeader className="border-b border-white/10 px-4 py-3">
                    <CardTitle className="text-base">Best store by design</CardTitle>
                  </CardHeader>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase text-white/35">
                          <th className="px-4 py-2">Design</th>
                          <th className="px-4 py-2">Store</th>
                          <th className="px-4 py-2 text-right">Index</th>
                          <th className="px-4 py-2 text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.bestStoreByDesign.map((r) => (
                          <tr key={r.department} className="border-t border-white/5">
                            <td className="px-4 py-2 text-white/80">{r.department}</td>
                            <td className="px-4 py-2 text-violet-200">{r.store}</td>
                            <td
                              className={cn(
                                "px-4 py-2 text-right font-semibold tabular-nums",
                                indexColor(r.index)
                              )}
                            >
                              {r.index}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-white/50">
                              {formatCurrency(r.netSales)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {tab === "departments" && (
              <Card className="mb-4 overflow-hidden p-0">
                <CardHeader className="border-b border-white/10 px-4 py-3">
                  <CardTitle className="text-base">Store × department matrix (top cells)</CardTitle>
                </CardHeader>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-white/35">
                        <th className="px-4 py-2">Store</th>
                        <th className="px-4 py-2">Department</th>
                        <th className="px-4 py-2 text-right">Index</th>
                        <th className="px-4 py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.storeByDepartment.map((c, i) => (
                        <tr key={`${c.store}-${c.department}-${i}`} className="border-t border-white/5">
                          <td className="px-4 py-2">{c.store}</td>
                          <td className="px-4 py-2 text-white/75">{c.department}</td>
                          <td
                            className={cn(
                              "px-4 py-2 text-right font-semibold tabular-nums",
                              indexColor(c.indexVsChain)
                            )}
                          >
                            {c.indexVsChain}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-white/50">
                            {formatCurrency(c.netSales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {(tab === "overview" || tab === "products") && (
              <Card className="mb-4 overflow-hidden p-0">
                <CardHeader className="border-b border-white/10 px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package size={16} className="text-amber-300" />
                    Top vendor models
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-white/35">
                        <th className="px-4 py-2">Model</th>
                        <th className="px-4 py-2">Dept</th>
                        <th className="px-4 py-2 text-right">Net</th>
                        <th className="px-4 py-2 text-right">Units</th>
                        <th className="px-4 py-2 text-right">On hand</th>
                        <th className="px-4 py-2 text-right">Sell-through</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.products.topModels.map((p) => (
                        <tr key={p.vendorModel} className="border-t border-white/5">
                          <td className="px-4 py-2 font-medium text-white/85">{p.vendorModel}</td>
                          <td className="px-4 py-2 text-white/50">{p.department || p.design}</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {formatCurrency(p.netSales)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{p.units}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-white/45">
                            {p.onHand ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-white/45">
                            {p.sellThroughPct != null ? `${p.sellThroughPct}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {(tab === "overview" || tab === "people") && (
              <Card className="mb-4 overflow-hidden p-0">
                <CardHeader className="border-b border-white/10 px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users size={16} className="text-sky-300" />
                    Salesperson specialties
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-white/35">
                        <th className="px-4 py-2">Associate</th>
                        <th className="px-4 py-2 text-right">Net credited</th>
                        <th className="px-4 py-2">Top department</th>
                        <th className="px-4 py-2 text-right">Avg ticket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.salespersons.map((sp) => (
                        <tr key={sp.code} className="border-t border-white/5">
                          <td className="px-4 py-2">
                            <span className="font-medium text-white/85">{sp.name}</span>
                            <span className="ml-1 text-white/35">({sp.code})</span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {formatCurrency(sp.netSales)}
                          </td>
                          <td className="px-4 py-2 text-violet-200/90">{sp.topDepartment || "—"}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-white/50">
                            {formatCurrency(sp.avgTicket)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {(tab === "overview" || tab === "customers") && (
              <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                  <CardTitle className="mb-3 flex items-center gap-2 text-base">
                    <Brain size={16} className="text-violet-300" />
                    Retention
                  </CardTitle>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-white/40">Repeat rate</dt>
                      <dd className="text-lg font-semibold text-white">
                        {report.customers.retention.repeatRatePct}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/40">Avg visits / customer</dt>
                      <dd className="text-lg font-semibold text-white">
                        {report.customers.retention.avgVisitsPerCustomer}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/40">Cross-store shoppers</dt>
                      <dd className="text-lg font-semibold text-white">
                        {report.customers.crossStoreShoppers.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/40">Days between visits</dt>
                      <dd className="text-lg font-semibold text-white">
                        {report.customers.retention.avgDaysBetweenVisits ?? "—"}
                      </dd>
                    </div>
                  </dl>
                </Card>

                <Card className="overflow-hidden p-0">
                  <CardHeader className="border-b border-white/10 px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin size={16} className="text-emerald-300" />
                      Top zip codes
                    </CardTitle>
                  </CardHeader>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {report.customers.topZips.map((z) => (
                          <tr key={z.zip} className="border-t border-white/5">
                            <td className="px-4 py-2 font-medium">{z.zip}</td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {formatCurrency(z.netSales)}
                            </td>
                            <td className="px-4 py-2 text-right text-white/45">
                              {z.customers} cust
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {(tab === "overview" || tab === "forecast") && report.forecast.monthly.length > 0 && (
              <Card className="mb-4">
                <CardTitle className="mb-3 flex items-center gap-2 text-base">
                  <TrendingUp size={16} className="text-emerald-300" />
                  Monthly net + forecast
                </CardTitle>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-white/35">
                        <th className="px-2 py-1">Month</th>
                        <th className="px-2 py-1 text-right">Actual</th>
                        <th className="px-2 py-1 text-right">Forecast</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.forecast.monthly.map((p) => (
                        <tr key={p.period} className="border-t border-white/5">
                          <td className="px-2 py-1.5">{p.period}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-white/70">
                            {p.actual != null ? formatCurrency(p.actual) : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-amber-200/90">
                            {p.forecast != null && p.actual == null
                              ? formatCurrency(p.forecast)
                              : p.forecast != null && p.actual != null
                                ? "—"
                                : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {(tab === "overview" || tab === "issues") && (
              <Card className="mb-4">
                <CardTitle className="mb-3 flex items-center gap-2 text-base">
                  <AlertTriangle size={16} className="text-amber-300" />
                  Issues & solutions
                </CardTitle>
                <div className="space-y-3">
                  {report.issues.length === 0 && (
                    <p className="text-sm text-white/45">No major issues flagged for this window.</p>
                  )}
                  {report.issues.map((issue, i) => (
                    <div
                      key={`${issue.title}-${i}`}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={issue.severity} />
                        <span className="text-xs text-white/35">{issue.category}</span>
                        {issue.store && (
                          <span className="text-xs text-violet-200/80">{issue.store}</span>
                        )}
                      </div>
                      <p className="mt-1 font-medium text-white/90">{issue.title}</p>
                      <p className="mt-0.5 text-sm text-white/50">{issue.detail}</p>
                      <p className="mt-2 text-sm text-emerald-200/80">
                        <span className="font-medium text-emerald-300/90">Solution:</span>{" "}
                        {issue.solution}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <p className="text-[11px] text-white/30">
              {report.rowCount.toLocaleString()} lines · {report.filter.dateFrom} →{" "}
              {report.filter.dateTo}
              {report.filter.store ? ` · ${report.filter.store}` : ""} · Index 100 = chain average
              per category
            </p>
          </>
        )}
      </PageShellBody>
    </PageShell>
  );
}
