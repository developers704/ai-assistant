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
  imageDir?: string;
  imageUrl?: string | null;
};

type VendorModelDetailDrawerProps = {
  selection: VendorModelDetailSelection | null;
  filterStore?: string;
  dateFrom?: string;
  dateTo?: string;
  reportId?: string;
  onClose: () => void;
};

const CHART_H = 220;

function UnitsTrendChart({ data }: { data: VendorModelDetail["trend"] }) {
  const [ready, setReady] = useState(false);
  const rows = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatReportDateDisplay(d.date) || d.date.slice(5),
      })),
    [data]
  );

  // Recharts ResponsiveContainer often paints blank on first modal mount.
  useEffect(() => {
    setReady(false);
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [rows]);

  if (!rows.length) {
    return (
      <p className="text-sm text-white/40 py-6 text-center">
        No daily sales for this model in the selected period.
      </p>
    );
  }

  return (
    <div className="w-full min-w-0" style={{ height: CHART_H }}>
      {ready ? (
        <ResponsiveContainer width="100%" height={CHART_H} minWidth={0}>
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
              minTickGap={28}
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
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export function VendorModelDetailDrawer({
  selection,
  filterStore,
  dateFrom,
  dateTo,
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
    setData(null);

    const params = new URLSearchParams({ vendorModel: selection.vendorModel });
    if (filterStore) params.set("store", filterStore);
    if (reportId) params.set("id", reportId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

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
  }, [selection, filterStore, reportId, dateFrom, dateTo]);

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

  const periodLabel =
    data?.dateFrom && data?.dateTo
      ? data.dateFrom === data.dateTo
        ? data.dateFrom
        : `${data.dateFrom} → ${data.dateTo}`
      : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close trend"
        onClick={onClose}
      />
      <aside className="relative flex w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#0f1624] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3 min-w-0">
            <ProductThumb
              imageDir={selection.imageDir}
              imageUrl={data?.imageUrl ?? selection.imageUrl}
              alt={title}
              subtitle={selection.vendorModel}
              onOpen={(src, alt, subtitle) => setPreview({ src, alt, subtitle })}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Sales trend
              </p>
              <h2 className="text-base font-semibold text-ink line-clamp-2 mt-0.5">{title}</h2>
              <p className="font-mono text-[11px] text-cyan-300/80 mt-0.5 truncate">
                {selection.vendorModel}
              </p>
              {(periodLabel || data?.totals) && (
                <p className="text-[10px] text-white/40 mt-1">
                  {[
                    periodLabel,
                    filterStore ? filterStore.split(",")[0] + (filterStore.includes(",") ? " +" : "") : null,
                    data?.totals ? formatPieceCount(data.totals.units) + " sold" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {loading && (
            <p className="text-sm text-white/40 animate-pulse py-8 text-center">
              Loading trend…
            </p>
          )}
          {error && <p className="text-sm text-rose-300 py-4">{error}</p>}
          {data && !loading && (
            <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-3 sm:p-4">
              <p className="text-[11px] text-white/35 mb-2">Daily units sold</p>
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
