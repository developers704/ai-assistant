"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { X, Sparkles } from "lucide-react";
import {
  formatCurrency,
  formatPieceCount,
  formatProductDisplayName,
} from "@/lib/utils";
import { formatReportDateDisplay } from "@/lib/reports/date-utils";
import {
  formatInventoryTurn,
  formatVelocityPerStore,
} from "@/lib/sales/inventory-metrics";
import type { VendorModelDetail } from "@/lib/sales/vendor-model-detail";
import { ProductLightbox, ProductThumb } from "@/components/reports/ProductImagePreview";
import { SkuStoreBreakdownList } from "@/components/reports/SkuStoreBreakdownList";

export type VendorModelDetailSelection = {
  vendorModel: string;
  description?: string;
  imageUrl?: string | null;
};

type VendorModelDetailDrawerProps = {
  selection: VendorModelDetailSelection | null;
  filterDateFrom?: string;
  filterDateTo?: string;
  filterDate?: string;
  filterStore?: string;
  reportId?: string;
  onClose: () => void;
};

function AttrRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
      <p className="text-sm text-white/80 truncate" title={value}>
        {value || "—"}
      </p>
    </div>
  );
}

function UnitsTrendChart({ data }: { data: VendorModelDetail["trend"] }) {
  const rows = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatReportDateDisplay(d.date) || d.date.slice(5),
      })),
    [data]
  );

  if (!rows.length) {
    return (
      <p className="text-sm text-white/40 py-10 text-center">
        No daily sales in this period.
      </p>
    );
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vmUnitsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(241,245,249,0.45)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "rgba(241,245,249,0.45)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.94)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "12px",
              fontSize: "12px",
            }}
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : Number(value) || 0;
              const key = String(name);
              return [
                key === "units" ? formatPieceCount(n) : formatCurrency(n),
                key === "units" ? "Units" : "Revenue",
              ];
            }}
            labelFormatter={(label) => String(label)}
          />
          <Area
            type="monotone"
            dataKey="units"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#vmUnitsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VendorModelDetailDrawer({
  selection,
  filterDateFrom,
  filterDateTo,
  filterDate,
  filterStore,
  reportId,
  onClose,
}: VendorModelDetailDrawerProps) {
  const [data, setData] = useState<VendorModelDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    src: string;
    alt: string;
    subtitle?: string;
  } | null>(null);

  useEffect(() => {
    if (!selection) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ vendorModel: selection.vendorModel });
    if (filterDateFrom && filterDateTo) {
      params.set("from", filterDateFrom);
      params.set("to", filterDateTo);
    } else if (filterDate) {
      params.set("date", filterDate);
    }
    if (filterStore) params.set("store", filterStore);
    if (reportId) params.set("id", reportId);

    fetch(`/api/reports/vendor-model-detail?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed (${res.status})`);
        }
        return res.json() as Promise<VendorModelDetail>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selection, filterDateFrom, filterDateTo, filterDate, filterStore, reportId]);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, onClose]);

  if (!selection) return null;

  const title = formatProductDisplayName(data?.description || selection.description || selection.vendorModel);
  const t = data?.totals;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#0f1624] shadow-2xl">
        <div className="shrink-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0f1624]/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start gap-3 min-w-0">
            <ProductThumb
              imageUrl={data?.imageUrl ?? selection.imageUrl}
              alt={title}
              subtitle={selection.vendorModel}
              onOpen={(src, alt, subtitle) => setPreview({ src, alt, subtitle })}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Vendor model detail
              </p>
              <h2 className="text-lg font-semibold text-ink truncate mt-0.5">{title}</h2>
              <p className="font-mono text-[11px] text-cyan-300/80 mt-0.5">{selection.vendorModel}</p>
              {data?.dateFrom && data?.dateTo && (
                <p className="text-[10px] text-white/40 mt-1">
                  {data.dateFrom === data.dateTo
                    ? data.dateFrom
                    : `${data.dateFrom} → ${data.dateTo}`}
                  {filterStore ? ` · ${filterStore}` : ""}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            {loading && (
              <p className="text-sm text-white/40 animate-pulse">Loading model insights…</p>
            )}
            {error && <p className="text-sm text-rose-300">{error}</p>}

            {t && data && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Units sold", value: formatPieceCount(t.units) },
                    { label: "Net sales", value: formatCurrency(t.revenue) },
                    { label: "On hand", value: t.onHandTotal != null ? formatPieceCount(t.onHandTotal) : "—" },
                    { label: "Margin", value: `${(t.marginRate * 100).toFixed(0)}%` },
                    { label: "Turn / yr", value: formatInventoryTurn(t.inventoryTurn) },
                    { label: "Vel / store", value: formatVelocityPerStore(t.velocityPerStore) },
                    {
                      label: "Sell-through",
                      value: t.sellThrough != null ? `${(t.sellThrough * 100).toFixed(0)}%` : "—",
                    },
                    { label: "Active stores", value: String(t.activeStores) },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 px-3 py-2.5"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-white/35">{m.label}</p>
                      <p className="text-sm font-semibold text-ink mt-1 tabular-nums">{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-3">
                    Product attributes
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <AttrRow label="Vendor" value={data.attributes.vendor} />
                    <AttrRow label="Department" value={data.attributes.department} />
                    <AttrRow label="Design" value={data.attributes.design} />
                    <AttrRow label="Class" value={data.attributes.productClass} />
                    <AttrRow label="Sub-class" value={data.attributes.subClass} />
                  </div>
                </div>

                <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">
                    Sales trend
                  </p>
                  <p className="text-[11px] text-white/35 mb-3">Daily units sold in selected period</p>
                  <UnitsTrendChart data={data.trend} />
                </div>

                {data.insights.length > 0 && (
                  <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-amber-300/80" />
                      Analysis
                    </p>
                    <ul className="space-y-2">
                      {data.insights.map((line) => (
                        <li key={line} className="text-sm text-white/70 leading-relaxed pl-3 border-l-2 border-sky-400/30">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.skus.length > 0 && (
                  <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                        SKUs ({data.skus.length})
                      </p>
                    </div>
                    <ul className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                      {data.skus.map((sku) => (
                        <li key={sku.sku} className="px-4 py-3 space-y-2">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-mono text-[12px] text-cyan-300/90">#{sku.sku}</span>
                            <span className="text-[11px] text-white/45 tabular-nums">
                              {formatPieceCount(sku.units)} sold
                              {sku.onHandTotal != null ? ` · ${formatPieceCount(sku.onHandTotal)} on hand` : ""}
                            </span>
                          </div>
                          <p className="text-[12px] text-white/65 line-clamp-2">{sku.description}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[10px] text-white/40">
                            <span>Vendor: {sku.vendor}</span>
                            <span>Dept: {sku.department}</span>
                            <span>Design: {sku.design}</span>
                            <span>Class: {sku.productClass}</span>
                            <span>Sub: {sku.subClass}</span>
                            <span>Turn: {formatInventoryTurn(sku.inventoryTurn)}</span>
                          </div>
                          {sku.stores && sku.stores.length > 0 && (
                            <SkuStoreBreakdownList
                              lines={[{ sku: sku.sku, units: sku.units, stores: sku.stores }]}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.stores.length > 0 && (
                  <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                      Top stores
                    </p>
                    <ul className="space-y-1.5">
                      {data.stores.slice(0, 8).map((s) => (
                        <li key={s.name} className="flex justify-between gap-2 text-sm">
                          <span className="text-white/70 truncate">{s.name}</span>
                          <span className="tabular-nums text-white/90 shrink-0">
                            {formatPieceCount(s.units)} · {formatCurrency(s.revenue)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </aside>

      {preview && (
        <ProductLightbox
          src={preview.src}
          alt={preview.alt}
          subtitle={preview.subtitle}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
