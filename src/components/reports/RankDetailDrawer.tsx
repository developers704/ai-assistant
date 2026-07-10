"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatPieceCount, formatProductDisplayName, cn } from "@/lib/utils";
import { X, ImageOff } from "lucide-react";
import type { RankDimension } from "@/lib/reports/types";

type RankDetailResponse = {
  dimension: RankDimension;
  value: string;
  totals: {
    revenue: number;
    units: number;
    margin: number;
    grossSales: number;
    discountTotal: number;
    inventoryCost: number;
    lineCount: number;
    uniqueTransactions: number;
  };
  breakdowns: {
    stores: { name: string; revenue: number; units: number }[];
    departments: { name: string; revenue: number; units: number }[];
    designs: { name: string; revenue: number; units: number }[];
    classes: { name: string; revenue: number; units: number }[];
    vendors: { name: string; revenue: number; units: number }[];
    models: {
      name: string;
      vendorModel: string;
      revenue: number;
      units: number;
      imageUrl?: string | null;
      sku?: string;
    }[];
  };
  lineItems: Array<{
    date: string;
    transactionId?: string;
    storeName: string;
    department: string;
    design: string;
    vendor: string;
    vendorModel: string;
    sku: string;
    description: string;
    productClass: string;
    quantity: number;
    netRevenue: number;
    margin: number;
    imageUrl?: string | null;
  }>;
};

const DIMENSION_LABEL: Record<RankDimension, string> = {
  store: "Store",
  department: "Department",
  vendor: "Vendor",
  design: "Design line",
  class: "Metal / class",
  vendorModel: "Vendor model",
};

export type RankDetailSelection = {
  dimension: RankDimension;
  value: string;
};

type RankDetailDrawerProps = {
  selection: RankDetailSelection | null;
  filterDate?: string;
  filterStore?: string;
  filterDepartment?: string;
  filterDesign?: string;
  reportId?: string;
  onClose: () => void;
};

function MiniList({
  title,
  items,
}: {
  title: string;
  items: { name: string; revenue: number; units?: number }[];
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.slice(0, 6).map((item) => (
          <li key={item.name} className="flex justify-between gap-2 text-sm">
            <span className="text-white/70 truncate">{item.name}</span>
            <span className="tabular-nums text-white/90 shrink-0">
              {formatCurrency(item.revenue)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankDetailDrawer({
  selection,
  filterDate,
  filterStore,
  filterDepartment,
  filterDesign,
  reportId,
  onClose,
}: RankDetailDrawerProps) {
  const [data, setData] = useState<RankDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selection) {
      setData(null);
      setError(null);
      return;
    }
    const params = new URLSearchParams({
      dimension: selection.dimension,
      value: selection.value,
    });
    if (filterDate) params.set("date", filterDate);
    if (filterStore) params.set("store", filterStore);
    if (filterDepartment) params.set("department", filterDepartment);
    if (filterDesign) params.set("design", filterDesign);
    if (reportId) params.set("id", reportId);

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/reports/rank-detail?${params}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load details");
        return json as RankDetailResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selection, filterDate, filterStore, filterDepartment, filterDesign, reportId]);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, onClose]);

  if (!selection) return null;

  const t = data?.totals;
  const b = data?.breakdowns;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0f1624] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0f1624]/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {DIMENSION_LABEL[selection.dimension]} detail
            </p>
            <h2 className="text-lg font-semibold text-ink truncate mt-0.5">
              {selection.value}
            </h2>
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

        <div className="p-5 space-y-5">
          {loading && (
            <p className="text-sm text-white/40 animate-pulse">Loading details…</p>
          )}
          {error && <p className="text-sm text-rose-300">{error}</p>}

          {t && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Net sales", value: formatCurrency(t.revenue) },
                { label: "Units", value: formatPieceCount(t.units) },
                { label: "Est. margin", value: formatCurrency(t.margin) },
                { label: "Gross", value: formatCurrency(t.grossSales) },
                { label: "Discounts", value: formatCurrency(t.discountTotal) },
                {
                  label: "Transactions",
                  value: t.uniqueTransactions.toLocaleString(),
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 px-3 py-2.5"
                >
                  <p className="text-[10px] uppercase tracking-wider text-white/35">
                    {m.label}
                  </p>
                  <p className="text-sm font-semibold text-ink mt-1 tabular-nums">
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {b && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selection.dimension !== "store" && (
                <MiniList title="By store" items={b.stores} />
              )}
              {selection.dimension !== "department" && (
                <MiniList title="By department" items={b.departments} />
              )}
              {selection.dimension !== "vendor" && (
                <MiniList title="By vendor" items={b.vendors} />
              )}
              {selection.dimension !== "design" && (
                <MiniList title="By design" items={b.designs} />
              )}
              {selection.dimension !== "class" && (
                <MiniList title="By class / metal" items={b.classes} />
              )}
            </div>
          )}

          {b && b.models.length > 0 && (
            <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-3">
              {/* <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-3">
                Top vendor models
              </p> */}
              <ul className="space-y-2.5">
                {b.models.slice(0, 10).map((m) => (
                  <li key={m.vendorModel} className="flex items-center gap-3">
                    {m.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/10 bg-white/[0.04]"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/10 text-white/25">
                        <ImageOff size={14} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink truncate">
                        {formatProductDisplayName(m.name)}
                      </p>
                      <p className="text-[11px] font-mono text-cyan-300/80">
                        {m.vendorModel}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm tabular-nums text-ink">
                        {formatCurrency(m.revenue)}
                      </p>
                      <p className="text-[11px] text-white/40 tabular-nums">
                        {formatPieceCount(m.units)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data && data.lineItems.length > 0 && (
            <div className="rounded-xl ring-1 ring-white/10 overflow-hidden">
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/40 bg-white/[0.03] border-b border-white/10">
                Line items ({data.totals.lineCount})
              </p>
              <ul className="max-h-80 overflow-y-auto divide-y divide-white/5">
                {data.lineItems.map((row, i) => (
                  <li
                    key={`${row.transactionId ?? row.date}-${row.sku}-${i}`}
                    className={cn(
                      "px-3 py-2.5 text-sm",
                      i % 2 === 0 ? "bg-white/[0.015]" : ""
                    )}
                  >
                    <div className="flex justify-between gap-2">
                      <p className="text-ink truncate">
                        {formatProductDisplayName(row.description)}
                      </p>
                      <span className="tabular-nums text-ink shrink-0">
                        {formatCurrency(row.netRevenue)}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 truncate">
                      {[
                        row.date,
                        row.storeName,
                        row.vendorModel || row.sku,
                        row.department,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {" · "}
                      {formatPieceCount(row.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
