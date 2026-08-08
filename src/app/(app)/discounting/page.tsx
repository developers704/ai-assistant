"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { PageShell, PageShellHeader, PageShellBody } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn, formatCurrency } from "@/lib/utils";
import { AlertTriangle, Loader2, Percent, RefreshCw } from "lucide-react";

type Hit = {
  date: string;
  store: string;
  transactionId: string;
  sku: string;
  design: string;
  department: string;
  description: string;
  salesAmount: number;
  discAmt: number;
  givenPct: number;
  allowedPct: number;
  overagePct: number;
  overageDollars: number;
  payChannelLabel: string;
  payCode: string;
  financingMonths: number | null;
  approver: { code: string; name: string; role: string };
  approvalHints: string[];
};

type ApiResponse = {
  filterDate: string | null;
  availableDates: string[];
  stores: string[];
  count: number;
  scannedProductLines: number;
  hits: Hit[];
  error?: string;
};

const selectClass =
  "select-dark w-full max-w-xs px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30";

export default function DiscountingPage() {
  const [date, setDate] = useState("");
  const [store, setStore] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { date?: string; store?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (opts?.date) params.set("date", opts.date);
      if (opts?.store) params.set("store", opts.store);
      const res = await fetch(`/api/discounting?${params}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
      if (!opts?.date && json.filterDate) setDate(json.filterDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const storeOptions = useMemo(() => {
    const fromHits = data?.stores ?? [];
    return fromHits;
  }, [data?.stores]);

  return (
    <PageShell>
      <PageShellHeader>
        <PageHeader
          title="Discounting"
          subtitle="High discounts vs Price Calculator limits — DM approvers (SM2 / AJ)"
        />
      </PageShellHeader>
      <PageShellBody>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="text-xs text-white/50 space-y-1">
            <span className="block">Date</span>
            <select
              className={selectClass}
              value={date}
              onChange={(e) => {
                const v = e.target.value;
                setDate(v);
                void load({ date: v, store: store || undefined });
              }}
            >
              {(data?.availableDates ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-white/50 space-y-1">
            <span className="block">Store</span>
            <select
              className={selectClass}
              value={store}
              onChange={(e) => {
                const v = e.target.value;
                setStore(v);
                void load({ date: date || undefined, store: v || undefined });
              }}
            >
              <option value="">All stores</option>
              {storeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load({ date: date || undefined, store: store || undefined })}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            <span className="ml-1.5">Refresh</span>
          </Button>
          {data && (
            <Badge variant="warning" className="mb-0.5">
              <Percent size={12} className="mr-1" />
              {data.count} high · scanned {data.scannedProductLines} lines
            </Badge>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-500/10 ring-1 ring-rose-400/30 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center gap-2 text-white/40 text-sm py-12 justify-center">
            <Loader2 className="animate-spin" size={16} /> Scanning sales…
          </div>
        ) : !data?.hits?.length ? (
          <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 px-6 py-10 text-center text-sm text-white/45">
            No high discounts for DM approvers on this day.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Store</th>
                  <th className="px-3 py-2.5 font-medium">SKU</th>
                  <th className="px-3 py-2.5 font-medium">Approver</th>
                  <th className="px-3 py-2.5 font-medium">Given</th>
                  <th className="px-3 py-2.5 font-medium">Allowed</th>
                  <th className="px-3 py-2.5 font-medium">Overage</th>
                  <th className="px-3 py-2.5 font-medium">Pay</th>
                  <th className="px-3 py-2.5 font-medium">Txn</th>
                </tr>
              </thead>
              <tbody>
                {data.hits.map((h) => (
                  <tr
                    key={`${h.transactionId}-${h.sku}-${h.discAmt}`}
                    className="border-t border-white/[0.06] hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2.5 text-white/80 whitespace-nowrap">{h.store}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-cyan-300/90 text-xs">{h.sku}</div>
                      <div className="text-[11px] text-white/35 line-clamp-1">
                        {h.design || h.department || h.description}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-white/80">{h.approver.name}</span>
                      <span className="text-white/35 text-xs ml-1">({h.approver.code})</span>
                    </td>
                    <td className="px-3 py-2.5 text-amber-200/90 whitespace-nowrap">
                      {h.givenPct.toFixed(1)}%
                      <div className="text-[11px] text-white/35">{formatCurrency(h.discAmt)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-white/60 whitespace-nowrap">
                      {h.allowedPct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-rose-300">
                        <AlertTriangle size={12} />
                        +{h.overagePct.toFixed(1)}%
                      </span>
                      <div className="text-[11px] text-rose-200/50">
                        {formatCurrency(h.overageDollars)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-white/55 text-xs">
                      {h.payChannelLabel}
                      {h.financingMonths ? (
                        <div className="text-white/35">{h.financingMonths} mo</div>
                      ) : null}
                      {h.payCode ? (
                        <div className="font-mono text-[10px] text-white/30">{h.payCode}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-white/40">
                      {h.transactionId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={cn("mt-4 text-[11px] text-white/30 max-w-3xl")}>
          Flags when Disc Amt ÷ Sales Amount exceeds Price Calculator allowed % for the APP
          approver’s tier. v1 matches District Managers <strong>SM2</strong> (Shaun) and{" "}
          <strong>AJ</strong> only. Pay Code spellings are normalized for display context.
        </p>
      </PageShellBody>
    </PageShell>
  );
}
