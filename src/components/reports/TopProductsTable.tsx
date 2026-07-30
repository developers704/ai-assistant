"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  formatPieceCount,
  formatProductDisplayName,
  cn,
  filterTopProductSkus,
} from "@/lib/utils";
import { ProductLightbox, ProductThumb } from "@/components/reports/ProductImagePreview";
import { VendorModelTextFilter } from "@/components/reports/VendorModelTextFilter";
import { SkuStoreBreakdownList } from "@/components/reports/SkuStoreBreakdownList";
import {
  applyVendorModelTextFilter,
  buildVendorModelSearchText,
  type VendorModelTextFilterMode,
} from "@/lib/sales/vendor-model-text-filter";

export interface TopProductSkuLine {
  sku: string;
  units: number;
  revenue: number;
  margin?: number;
  marginRate?: number;
  onHandTotal?: number;
  stores?: { name: string; units: number; onhand?: number | null }[];
}

export interface TopProductRow {
  name: string;
  itemNumber?: string;
  vendorModel?: string;
  imageDir?: string;
  imageUrl?: string | null;
  revenue: number;
  units: number;
  /** Profit = net sales (Total) − inventory cost */
  margin?: number;
  /** Profit margin = profit / net sales (0–1) — CSV Profit Amount ÷ Total when present */
  marginRate?: number;
  onHandTotal?: number;
  /** Distinct SKUs sold under this vendor model */
  skus?: TopProductSkuLine[];
}

interface TopProductsTableProps {
  products: TopProductRow[];
  emptyLabel?: string;
  onVendorModelDetail?: (product: TopProductRow) => void;
}

const DESKTOP_ROW_GRID =
  "sm:grid-cols-[2rem_3.5rem_5.5rem_minmax(0,1fr)_auto]";
const DESKTOP_METRICS =
  "grid grid-cols-[3.25rem_5rem_3rem] gap-x-2.5";

function formatMarginPct(rate: number | undefined | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(0)}%`;
}

function MetricsBlock({
  units,
  revenue,
  marginRate,
  profit,
  mobile,
}: {
  units: number;
  revenue: number;
  marginRate: number | null;
  profit?: number;
  mobile?: boolean;
}) {
  const marginClass =
    marginRate != null && marginRate >= 0.5
      ? "text-amber-200/90"
      : marginRate != null && marginRate >= 0
        ? "text-white/75"
        : "text-accent-rose/80";

  if (mobile) {
    return (
      <div className="grid grid-cols-3 divide-x divide-white/10 rounded-xl bg-white/[0.04] ring-1 ring-white/10 overflow-hidden">
        <div className="flex flex-col items-center justify-center px-1.5 py-2.5 text-center">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
            Qty
          </span>
          <span className="mt-0.5 text-sm font-semibold text-emerald-300 tabular-nums">
            {formatPieceCount(units)}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center px-1.5 py-2.5 text-center">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
            Revenue
          </span>
          <span className="mt-0.5 text-sm font-semibold text-ink tabular-nums">
            {formatCurrency(revenue)}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center px-1.5 py-2.5 text-center">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
            Margin
          </span>
          <span
            className={cn("mt-0.5 text-sm font-semibold tabular-nums", marginClass)}
            title={
              profit != null
                ? `Profit ${formatCurrency(profit)} on ${formatCurrency(revenue)} net`
                : "Profit ÷ Net sales"
            }
          >
            {formatMarginPct(marginRate)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={DESKTOP_METRICS}>
      <span className="text-sm font-semibold text-emerald-300/90 tabular-nums text-right">
        {formatPieceCount(units)}
      </span>
      <span className="font-medium text-ink text-sm tabular-nums text-right">
        {formatCurrency(revenue)}
      </span>
      <span
        className={cn("text-sm font-semibold tabular-nums text-right", marginClass)}
        title={
          profit != null
            ? `Profit ${formatCurrency(profit)} on ${formatCurrency(revenue)} net`
            : "Profit ÷ Net sales"
        }
      >
        {formatMarginPct(marginRate)}
      </span>
    </div>
  );
}

export function TopProductsTable({
  products,
  emptyLabel = "No product data in this report.",
  onVendorModelDetail,
}: TopProductsTableProps) {
  const baseRows = filterTopProductSkus(products);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<VendorModelTextFilterMode>("include");
  const [preview, setPreview] = useState<{
    src: string;
    alt: string;
    subtitle?: string;
  } | null>(null);

  const rows = useMemo(
    () =>
      applyVendorModelTextFilter(
        baseRows,
        (p) =>
          buildVendorModelSearchText({
            name: p.name,
            vendorModel: p.vendorModel,
            itemNumber: p.itemNumber,
            skus: p.skus,
          }),
        query,
        mode
      ),
    [baseRows, query, mode]
  );

  if (!baseRows.length) {
    return (
      <p className="text-sm text-ink-muted py-6 text-center">{emptyLabel}</p>
    );
  }

  return (
    <>
      <div className="mb-3">
        <VendorModelTextFilter
          query={query}
          mode={mode}
          onQueryChange={setQuery}
          onModeChange={setMode}
          matchCount={rows.length}
          totalCount={baseRows.length}
        />
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
        <div
          className={cn(
            "hidden sm:grid gap-x-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted bg-white/5 border-b border-white/10 items-center",
            DESKTOP_ROW_GRID
          )}
        >
          <span>#</span>
          <span>Pic</span>
          <span>Vendor model</span>
          <span>Product</span>
          <div className={DESKTOP_METRICS}>
            <span className="text-right">Qty</span>
            <span className="text-right">Revenue</span>
            <span className="text-right" title="Profit ÷ Net sales (Total − Cost) / Total">
              Margin
            </span>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted py-8 text-center px-3">
            No vendor models match this filter.
          </p>
        ) : (
          <ul className="max-h-[min(48rem,75vh)] overflow-y-auto divide-y divide-white/5">
            {rows.map((product, i) => {
              const displayName = formatProductDisplayName(product.name);
              const model = product.vendorModel?.trim() || product.itemNumber || "—";
              const marginRate =
                product.marginRate ??
                (product.revenue > 0 && product.margin != null
                  ? product.margin / product.revenue
                  : null);
              const skuLines: TopProductSkuLine[] = product.skus?.length
                ? product.skus
                : [];

              return (
                <li
                  key={`${product.vendorModel ?? ""}-${product.itemNumber ?? ""}-${product.name}-${i}`}
                  className={cn(
                    i % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent",
                    // Mobile card
                    "px-3 py-3 space-y-2.5 sm:space-y-0 sm:py-2.5 sm:grid sm:gap-x-3 sm:items-start",
                    DESKTOP_ROW_GRID,
                    onVendorModelDetail &&
                      "sm:cursor-pointer sm:hover:bg-white/[0.04] transition-colors"
                  )}
                  onClick={() => {
                    // Desktop row click opens trend; mobile uses explicit button
                    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
                      onVendorModelDetail?.(product);
                    }
                  }}
                >
                  {/* Mobile header: # + pic + model/title */}
                  <div className="flex gap-3 min-w-0 sm:contents">
                    <div className="flex flex-col items-center gap-1.5 shrink-0 sm:contents">
                      <span className="text-xs font-medium text-ink-muted tabular-nums sm:pt-1">
                        {i + 1}
                      </span>
                      <ProductThumb
                        imageDir={product.imageDir}
                        imageUrl={product.imageUrl}
                        alt={displayName || model}
                        subtitle={model !== "—" ? model : undefined}
                        onOpen={(src, alt, subtitle) => setPreview({ src, alt, subtitle })}
                      />
                    </div>

                    <div
                      className="min-w-0 flex-1 sm:contents"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-mono text-[11px] text-cyan-300/90 tabular-nums break-all sm:pt-1 block sm:inline">
                        {model}
                      </span>
                      <div className="mt-0.5 sm:mt-0 sm:col-span-1 min-w-0">
                        <p className="text-[13px] sm:text-sm text-ink/95 font-medium leading-snug tracking-[0.01em] break-words line-clamp-2 sm:line-clamp-3">
                          {displayName}
                        </p>
                        {/* Desktop: SKUs + trend under product name */}
                        <div className="hidden sm:block">
                          {skuLines.length > 0 && (
                            <SkuStoreBreakdownList lines={skuLines} />
                          )}
                          {onVendorModelDetail && (
                            <button
                              type="button"
                              onClick={() => onVendorModelDetail(product)}
                              className="mt-1 text-[12px] font-medium text-sky-300/80 hover:underline underline-offset-2"
                            >
                              View trend
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics — mobile: right under title; desktop: right column */}
                  <div className="sm:pt-1" onClick={(e) => e.stopPropagation()}>
                    <div className="sm:hidden">
                      <MetricsBlock
                        mobile
                        units={product.units}
                        revenue={product.revenue}
                        marginRate={marginRate}
                        profit={product.margin}
                      />
                      {onVendorModelDetail && (
                        <button
                          type="button"
                          onClick={() => onVendorModelDetail(product)}
                          className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-sky-500/15 px-3 py-2.5 text-[13px] font-semibold text-sky-200 ring-1 ring-sky-400/25 active:bg-sky-500/25"
                        >
                          View trend
                        </button>
                      )}
                      {skuLines.length > 0 && (
                        <SkuStoreBreakdownList lines={skuLines} className="mt-2" />
                      )}
                    </div>
                    <div className="hidden sm:block">
                      <MetricsBlock
                        units={product.units}
                        revenue={product.revenue}
                        marginRate={marginRate}
                        profit={product.margin}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {preview && (
        <ProductLightbox
          src={preview.src}
          alt={preview.alt}
          subtitle={preview.subtitle}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
