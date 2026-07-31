"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { X } from "lucide-react";
import {
  formatCurrency,
  formatPieceCount,
  formatProductDisplayName,
} from "@/lib/utils";
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

const CHART_H = 280;

type ChartRow = {
  label: string;
  units: number;
  unitsLy: number;
  revenue: number;
  revenueLy: number;
};

function UnitsTrendChart({
  trend,
  trendLastYear,
  trendLabel,
  compareLabel,
}: {
  trend: VendorModelDetail["trend"];
  trendLastYear: VendorModelDetail["trendLastYear"];
  trendLabel: string;
  compareLabel: string;
}) {
  const [ready, setReady] = useState(false);
  const rows = useMemo(() => {
    const byMd = new Map<string, ChartRow>();
    for (const p of trend ?? []) {
      const md = p.date.slice(5);
      byMd.set(md, {
        label: md,
        units: p.units,
        unitsLy: 0,
        revenue: p.revenue,
        revenueLy: 0,
      });
    }
    for (const p of trendLastYear ?? []) {
      const md = p.date.slice(5);
      const cur = byMd.get(md) ?? {
        label: md,
        units: 0,
        unitsLy: 0,
        revenue: 0,
        revenueLy: 0,
      };
      cur.unitsLy = p.units;
      cur.revenueLy = p.revenue;
      byMd.set(md, cur);
    }
    // Calendar order by month-day (MM-DD sorts lexicographically).
    return [...byMd.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [trend, trendLastYear]);

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
    <div
      className="w-full min-w-0 relative"
      style={{
        height: CHART_H,
        perspective: "900px",
      }}
    >
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background:
            "linear-gradient(160deg, rgba(56,189,248,0.12) 0%, transparent 42%, rgba(251,191,36,0.08) 100%)",
          transform: "rotateX(8deg) translateZ(0)",
          transformOrigin: "center bottom",
        }}
        aria-hidden
      />
      {ready ? (
        <ResponsiveContainer width="100%" height={CHART_H} minWidth={0}>
          <AreaChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="vmUnitsFillTy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.55} />
                <stop offset="55%" stopColor="#0ea5e9" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#0284c7" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="vmUnitsFillLy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} />
                <stop offset="55%" stopColor="#f59e0b" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#d97706" stopOpacity={0.02} />
              </linearGradient>
              <filter id="vmTrendGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="6"
                  stdDeviation="4"
                  floodColor="#38bdf8"
                  floodOpacity="0.35"
                />
              </filter>
              <filter id="vmTrendGlowLy" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="5"
                  stdDeviation="3.5"
                  floodColor="#fbbf24"
                  floodOpacity="0.3"
                />
              </filter>
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
                backgroundColor: "rgba(15, 23, 42, 0.96)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "12px",
                fontSize: "12px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              }}
              formatter={(value, name) => {
                const n = typeof value === "number" ? value : Number(value) || 0;
                const key = String(name);
                if (key === "units") return [formatPieceCount(n), trendLabel];
                if (key === "unitsLy") return [formatPieceCount(n), compareLabel];
                return [formatCurrency(n), key];
              }}
              labelFormatter={(label) => `Day ${String(label)}`}
            />
            <Legend
              verticalAlign="top"
              height={28}
              formatter={(value) =>
                value === "units"
                  ? trendLabel
                  : value === "unitsLy"
                    ? compareLabel
                    : value
              }
              wrapperStyle={{ fontSize: 11, color: "rgba(241,245,249,0.55)" }}
            />
            <Area
              type="monotone"
              dataKey="unitsLy"
              name="unitsLy"
              stroke="#fbbf24"
              strokeWidth={2.5}
              fill="url(#vmUnitsFillLy)"
              filter="url(#vmTrendGlowLy)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="units"
              name="units"
              stroke="#38bdf8"
              strokeWidth={2.75}
              fill="url(#vmUnitsFillTy)"
              filter="url(#vmTrendGlow)"
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
  const [mounted, setMounted] = useState(false);
  const [preview, setPreview] = useState<{
    src: string;
    alt: string;
    subtitle?: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        if (!cancelled) setData({ ...json, trendLastYear: json.trendLastYear ?? [] });
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selection, onClose]);

  if (!selection || !mounted) return null;

  const title = formatProductDisplayName(
    data?.description || selection.description || selection.vendorModel
  );

  const periodLabel =
    data?.dateFrom && data?.dateTo
      ? data.dateFrom === data.dateTo
        ? data.dateFrom
        : `${data.dateFrom} → ${data.dateTo}`
      : null;

  const primaryUnits = (data?.trend ?? []).reduce((s, p) => s + p.units, 0);
  const compareUnits = (data?.trendLastYear ?? []).reduce((s, p) => s + p.units, 0);
  const trendLabel = data?.trendLabel;
  const compareLabel = data?.compareLabel;

  const metaLine = [
    periodLabel,
    filterStore
      ? filterStore.split(",")[0] + (filterStore.includes(",") ? " +" : "")
      : null,
    data?.compareMode === "calendar-years" && trendLabel && compareLabel
      ? `${formatPieceCount(primaryUnits)} in ${trendLabel} · ${formatPieceCount(compareUnits)} in ${compareLabel}`
      : [
          data?.totals ? formatPieceCount(data.totals.units) + " sold" : null,
          compareUnits > 0 && compareLabel
            ? `${formatPieceCount(compareUnits)} in ${compareLabel}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-stretch sm:items-center justify-center sm:p-6"
      style={{ height: "100dvh" }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Close trend"
        onClick={onClose}
      />
      <aside
        className="relative z-10 mt-auto sm:mt-0 flex w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0f1624] shadow-2xl overflow-hidden h-[min(88dvh,720px)] sm:h-auto sm:max-h-[min(85vh,640px)]"
        role="dialog"
        aria-modal="true"
        aria-label="Sales trend"
      >
        <div className="sm:hidden flex justify-center pt-2 pb-0.5 shrink-0">
          <span className="h-1 w-10 rounded-full bg-white/25" aria-hidden />
        </div>

        <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:px-5 sm:py-3 shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <ProductThumb
              imageDir={selection.imageDir}
              imageUrl={data?.imageUrl ?? selection.imageUrl}
              alt={title}
              subtitle={selection.vendorModel}
              onOpen={(src, alt, subtitle) => setPreview({ src, alt, subtitle })}
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[12px] font-semibold text-cyan-300 truncate">
                {selection.vendorModel}
              </p>
              <h2 className="text-[13px] sm:text-base font-medium text-ink line-clamp-1 sm:line-clamp-2 mt-0.5">
                {title}
              </h2>
              {metaLine && (
                <p className="text-[10px] text-white/40 mt-0.5 truncate">{metaLine}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 -mr-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5">
          {loading && (
            <p className="text-sm text-white/40 animate-pulse py-10 text-center">
              Loading trend…
            </p>
          )}
          {error && <p className="text-sm text-rose-300 py-4">{error}</p>}
          {data && !loading && (
            <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="text-[11px] text-white/35 mb-1">
                Daily units · {data.trendLabel ?? "—"} vs {data.compareLabel ?? "—"}
              </p>
              <UnitsTrendChart
                trend={data.trend}
                trendLastYear={data.trendLastYear ?? []}
                trendLabel={data.trendLabel || "This year"}
                compareLabel={data.compareLabel || "Last year"}
              />
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
    </div>,
    document.body
  );
}
