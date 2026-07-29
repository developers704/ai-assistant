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
import { X } from "lucide-react";
import {
  formatCurrency,
  formatPieceCount,
  formatProductDisplayName,
} from "@/lib/utils";
import { formatReportDateDisplay } from "@/lib/reports/date-utils";
import type { VendorModelDetail } from "@/lib/sales/vendor-model-detail";
import { ProductLightbox, ProductThumb } from "@/components/reports/ProductImagePreview";

export type VendorModelDetailSelection = {
  vendorModel: string;
  description?: string;
  imageUrl?: string | null;
};

type VendorModelDetailDrawerProps = {
  selection: VendorModelDetailSelection | null;
  filterStore?: string;
  reportId?: string;
  onClose: () => void;
};

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
        No daily sales for this model.
      </p>
    );
  }

  return (
    <div className="h-[min(420px,55vh)]">
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

    // Full-report trend for this model (ignore day/range filters — a 1-day chart is useless).
    const params = new URLSearchParams({ vendorModel: selection.vendorModel });
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
        if (!cancelled) setError(e.message || "Failed to load trend");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selection, filterStore, reportId]);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, onClose]);

  if (!selection) return null;

  const title = formatProductDisplayName(
    data?.description || selection.description || selection.vendorModel
  );

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close trend"
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
                Sales trend
              </p>
              <h2 className="text-lg font-semibold text-ink truncate mt-0.5">{title}</h2>
              <p className="font-mono text-[11px] text-cyan-300/80 mt-0.5">
                {selection.vendorModel}
              </p>
              {data?.dateFrom && data?.dateTo && (
                <p className="text-[10px] text-white/40 mt-1">
                  {data.dateFrom === data.dateTo
                    ? data.dateFrom
                    : `${data.dateFrom} → ${data.dateTo}`}
                  {filterStore ? ` · ${filterStore}` : ""}
                  {data.totals ? ` · ${formatPieceCount(data.totals.units)} sold` : ""}
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

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && (
            <p className="text-sm text-white/40 animate-pulse">Loading trend…</p>
          )}
          {error && <p className="text-sm text-rose-300">{error}</p>}
          {data && !loading && (
            <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] text-white/35 mb-3">Daily units sold</p>
              <UnitsTrendChart data={data.trend} />
            </div>
          )}
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
