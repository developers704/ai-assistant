"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  formatPieceCount,
  formatProductDisplayName,
  cn,
  filterTopProductSkus,
} from "@/lib/utils";
import {
  formatInventoryTurn,
  formatVelocityPerStore,
} from "@/lib/sales/inventory-metrics";
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
  inventoryTurn?: number | null;
  velocityPerStore?: number | null;
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
  inventoryTurn?: number | null;
  velocityPerStore?: number | null;
  /** Distinct SKUs sold under this vendor model */
  skus?: TopProductSkuLine[];
}

interface TopProductsTableProps {
  products: TopProductRow[];
  emptyLabel?: string;
  onVendorModelDetail?: (product: TopProductRow) => void;
}

/** Left identity cols + fixed metrics block so headers and values share one sub-grid. */
const MAIN_ROW_GRID =
  "sm:grid-cols-[2rem_3.5rem_5.5rem_minmax(0,1fr)_auto]";
const METRICS_GRID =
  "grid grid-cols-5 sm:grid-cols-[3.25rem_5rem_3rem_3.5rem_4rem] gap-x-2 sm:gap-x-2.5";

function formatMarginPct(rate: number | undefined | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(0)}%`;
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
            MAIN_ROW_GRID
          )}
        >
          <span>#</span>
          <span>Pic</span>
          <span>Vendor model</span>
          <span>Product</span>
          <div className={METRICS_GRID}>
            <span className="text-right">Qty</span>
            <span className="text-right">Revenue</span>
            <span className="text-right" title="Profit ÷ Net sales (Total − Cost) / Total">
              Margin
            </span>
            <span
              className="text-right"
              title="Annualized inventory turn = (sold × 365 ÷ days) ÷ on-hand"
            >
              Turn
            </span>
            <span
              className="text-right"
              title="Annualized units per active store = (sold × 365 ÷ days) ÷ store count"
            >
              Vel/store
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
                    "grid grid-cols-1 gap-y-1 px-3 py-3 sm:py-2.5 sm:items-start gap-x-3",
                    MAIN_ROW_GRID,
                    onVendorModelDetail && "cursor-pointer hover:bg-white/[0.04] transition-colors",
                    i % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"
                  )}
                  onClick={() => onVendorModelDetail?.(product)}
                  onKeyDown={(e) => {
                    if (!onVendorModelDetail) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onVendorModelDetail(product);
                    }
                  }}
                  role={onVendorModelDetail ? "button" : undefined}
                  tabIndex={onVendorModelDetail ? 0 : undefined}
                >
                  <span className="text-xs font-medium text-ink-muted tabular-nums sm:text-sm sm:pt-1">
                    {i + 1}
                  </span>

                  <ProductThumb
                    imageDir={product.imageDir}
                    imageUrl={product.imageUrl}
                    alt={displayName || model}
                    subtitle={model !== "—" ? model : undefined}
                    onOpen={(src, alt, subtitle) => setPreview({ src, alt, subtitle })}
                  />

                  <span className="font-mono text-[11px] text-cyan-300/90 tabular-nums break-all sm:pt-1">
                    {model}
                  </span>

                  <div
                    className="sm:col-span-1 col-span-full -mt-1 sm:mt-0 min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-[13px] sm:text-sm text-ink/95 font-medium leading-snug tracking-[0.01em] break-words whitespace-normal line-clamp-3">
                      {displayName}
                    </p>
                    {onVendorModelDetail && (
                      <button
                        type="button"
                        onClick={() => onVendorModelDetail(product)}
                        className="mt-1 text-[11px] font-medium text-sky-300/80 hover:text-sky-200 underline-offset-2 hover:underline"
                      >
                        More detail & trend
                      </button>
                    )}
                    {skuLines.length > 0 && (
                      <SkuStoreBreakdownList lines={skuLines} />
                    )}
                  </div>

                  <div
                    className={cn(
                      "col-span-full sm:col-span-1 sm:pt-1 pt-2 border-t border-white/5 sm:border-0"
                    )}
                  >
                    <p className="sm:hidden text-[11px] text-ink-muted uppercase tracking-wide mb-1.5">
                      Qty / Revenue / Margin / Turn / Vel
                    </p>
                    <div className={METRICS_GRID}>
                    <span className="text-sm font-semibold text-emerald-300/90 tabular-nums text-right">
                      {formatPieceCount(product.units)}
                    </span>
                    <span className="font-medium text-ink text-sm tabular-nums text-right">
                      {formatCurrency(product.revenue)}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums text-right",
                        marginRate != null && marginRate >= 0.5
                          ? "text-amber-200/85"
                          : marginRate != null && marginRate >= 0
                            ? "text-white/70"
                            : "text-accent-rose/80"
                      )}
                      title={
                        product.margin != null
                          ? `Profit ${formatCurrency(product.margin)} on ${formatCurrency(product.revenue)} net`
                          : "Profit ÷ Net sales"
                      }
                    >
                      {formatMarginPct(marginRate)}
                    </span>
                    <span
                      className="text-sm font-medium tabular-nums text-sky-200/80 text-right"
                      title={
                        product.onHandTotal != null
                          ? `${formatPieceCount(product.units)} sold · ${formatPieceCount(product.onHandTotal)} on hand`
                          : "On-hand file not loaded"
                      }
                    >
                      {formatInventoryTurn(product.inventoryTurn)}
                    </span>
                    <span
                      className="text-sm font-medium tabular-nums text-violet-200/75 text-right"
                      title="Annualized units per store that sold or holds this model"
                    >
                      {formatVelocityPerStore(product.velocityPerStore)}
                    </span>
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
