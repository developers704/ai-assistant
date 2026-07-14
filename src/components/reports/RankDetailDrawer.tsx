"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatPieceCount, formatProductDisplayName, cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { RankDimension } from "@/lib/reports/types";
import { ProductLightbox, ProductThumb } from "@/components/reports/ProductImagePreview";

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
    imageDir?: string | null;
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
  filterDateFrom?: string;
  filterDateTo?: string;
  filterStore?: string;
  filterDepartment?: string;
  filterDesign?: string;
  filterVendor?: string;
  filterClass?: string;
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
  filterDateFrom,
  filterDateTo,
  filterStore,
  filterDepartment,
  filterDesign,
  filterVendor,
  filterClass,
  reportId,
  onClose,
}: RankDetailDrawerProps) {
  const [data, setData] = useState<RankDetailResponse | null>(null);
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
      setPreview(null);
      return;
    }
    const params = new URLSearchParams({
      dimension: selection.dimension,
      value: selection.value,
    });
    if (filterDateFrom && filterDateTo) {
      params.set("from", filterDateFrom);
      params.set("to", filterDateTo);
    } else if (filterDate) {
      params.set("date", filterDate);
    }
    // Don't re-apply the same dimension as a global AND filter (avoids empty matches).
    if (filterStore && selection.dimension !== "store") params.set("store", filterStore);
    if (filterDepartment && selection.dimension !== "department") {
      params.set("department", filterDepartment);
    }
    if (filterDesign && selection.dimension !== "design") params.set("design", filterDesign);
    if (filterVendor && selection.dimension !== "vendor") params.set("vendor", filterVendor);
    if (filterClass && selection.dimension !== "class") params.set("class", filterClass);
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
  }, [
    selection,
    filterDate,
    filterDateFrom,
    filterDateTo,
    filterStore,
    filterDepartment,
    filterDesign,
    filterVendor,
    filterClass,
    reportId,
  ]);

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
      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#0f1624] shadow-2xl">
        <div className="shrink-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0f1624]/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {DIMENSION_LABEL[selection.dimension]} detail
            </p>
            <h2 className="text-lg font-semibold text-ink truncate mt-0.5">
              {selection.value}
            </h2>
            {(filterDate ||
              filterDateFrom ||
              (filterStore && selection.dimension !== "store") ||
              (filterDepartment && selection.dimension !== "department") ||
              (filterDesign && selection.dimension !== "design") ||
              (filterVendor && selection.dimension !== "vendor") ||
              (filterClass && selection.dimension !== "class")) && (
              <p className="text-[10px] text-amber-200/70 mt-1 truncate">
                Filtered
                {filterClass && selection.dimension !== "class" ? ` · class ${filterClass}` : ""}
                {filterVendor && selection.dimension !== "vendor" ? ` · vendor ${filterVendor}` : ""}
                {filterDepartment && selection.dimension !== "department"
                  ? ` · dept ${filterDepartment}`
                  : ""}
                {filterDesign && selection.dimension !== "design" ? ` · design ${filterDesign}` : ""}
                {filterStore && selection.dimension !== "store" ? ` · store ${filterStore}` : ""}
                {filterDateFrom && filterDateTo
                  ? filterDateFrom === filterDateTo
                    ? ` · ${filterDateFrom}`
                    : ` · ${filterDateFrom} → ${filterDateTo}`
                  : filterDate
                    ? ` · ${filterDate}`
                    : ""}
              </p>
            )}
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
            <p className="text-sm text-white/40 animate-pulse">Loading details…</p>
          )}
          {error && <p className="text-sm text-rose-300">{error}</p>}

          {t && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Net sales", value: formatCurrency(t.revenue) },
                { label: "Units", value: formatPieceCount(t.units) },
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
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-3">
                Top vendor models
              </p>
              <ul className="space-y-2.5">
                {b.models.slice(0, 10).map((m) => {
                  const label = formatProductDisplayName(m.name);
                  return (
                    <li key={m.vendorModel} className="flex items-center gap-3">
                      <ProductThumb
                        imageUrl={m.imageUrl}
                        alt={label}
                        subtitle={m.vendorModel}
                        onOpen={(src, alt, subtitle) =>
                          setPreview({ src, alt, subtitle })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-ink/95 font-medium leading-snug tracking-[0.01em] line-clamp-2">
                          {label}
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
                  );
                })}
              </ul>
            </div>
          )}

          {data && data.lineItems.length > 0 && (
            <div className="flex h-[min(70vh,40rem)] flex-col rounded-xl ring-1 ring-white/10 overflow-hidden">
              <p className="shrink-0 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/40 bg-white/[0.03] border-b border-white/10">
                Line items ({data.totals.lineCount}
                {data.lineItems.length < data.totals.lineCount
                  ? ` · showing ${data.lineItems.length}`
                  : ""}
                )
              </p>
              <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-white/5">
                {data.lineItems.map((row, i) => {
                  const label = formatProductDisplayName(row.description);
                  const skuOrModel = row.vendorModel || row.sku;
                  return (
                    <li
                      key={`${row.transactionId ?? row.date}-${row.sku}-${i}`}
                      className={cn(
                        "px-3 py-2.5 flex items-start gap-3",
                        i % 2 === 0 ? "bg-white/[0.015]" : ""
                      )}
                    >
                      <ProductThumb
                        imageDir={row.imageDir ?? undefined}
                        imageUrl={row.imageUrl ?? undefined}
                        alt={label}
                        subtitle={skuOrModel}
                        onOpen={(src, alt, subtitle) =>
                          setPreview({ src, alt, subtitle })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-ink/95 font-medium leading-snug tracking-[0.01em] line-clamp-2">
                          {label}
                        </p>
                        <p className="text-[11px] text-white/40 mt-0.5 truncate">
                          {[row.date, row.storeName, skuOrModel, row.department]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0 min-w-[4.5rem]">
                        <p className="text-sm tabular-nums text-ink">
                          {formatCurrency(row.netRevenue)}
                        </p>
                        <p className="text-[11px] text-white/40 tabular-nums">
                          {formatPieceCount(row.quantity)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
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
