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
  stores?: { name: string; units: number }[];
}

export interface TopProductRow {
  name: string;
  itemNumber?: string;
  vendorModel?: string;
  imageDir?: string;
  imageUrl?: string | null;
  revenue: number;
  units: number;
  /** Profit = net sales − inventory cost (hidden in UI for now) */
  margin?: number;
  /** Profit margin = profit / net sales (0–1) (hidden in UI for now) */
  marginRate?: number;
  /** Distinct SKUs sold under this vendor model */
  skus?: TopProductSkuLine[];
}

interface TopProductsTableProps {
  products: TopProductRow[];
  emptyLabel?: string;
}

const ROW_GRID =
  "grid grid-cols-1 sm:grid-cols-[2rem_3.25rem_5rem_minmax(0,1fr)_3.75rem_5.5rem] lg:grid-cols-[2rem_3.5rem_6rem_minmax(0,2fr)_4rem_6rem] gap-x-3 gap-y-1";

export function TopProductsTable({
  products,
  emptyLabel = "No product data in this report.",
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
            "hidden sm:grid gap-x-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted bg-white/5 border-b border-white/10",
            "sm:grid-cols-[2rem_3.25rem_5rem_minmax(0,1fr)_3.75rem_5.5rem] lg:grid-cols-[2rem_3.5rem_6rem_minmax(0,2fr)_4rem_6rem]"
          )}
        >
          <span>#</span>
          <span>Pic</span>
          <span>Vendor model</span>
          <span>Product</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Revenue</span>
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
              const skuLines: TopProductSkuLine[] =
                product.skus?.length
                  ? product.skus
                  : product.itemNumber
                    ? [
                        {
                          sku: product.itemNumber,
                          units: product.units,
                          revenue: product.revenue,
                        },
                      ]
                    : [];
              return (
                <li
                  key={`${product.vendorModel ?? ""}-${product.itemNumber ?? ""}-${product.name}-${i}`}
                  className={cn(
                    ROW_GRID,
                    "px-3 py-3 sm:py-2.5 sm:items-start",
                    i % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"
                  )}
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

                  <div className="sm:col-span-1 col-span-full -mt-1 sm:mt-0 min-w-0">
                    <p className="text-[13px] sm:text-sm text-ink/95 font-medium leading-snug tracking-[0.01em] break-words whitespace-normal line-clamp-3">
                      {displayName}
                    </p>
                    {skuLines.length > 0 && (
                      <SkuStoreBreakdownList lines={skuLines} />
                    )}
                  </div>

                  <div className="flex sm:contents items-center justify-between gap-3 sm:col-span-2 col-span-full pt-1 sm:pt-0 border-t border-white/5 sm:border-0">
                    <span className="sm:hidden text-[11px] text-ink-muted uppercase tracking-wide">
                      Qty / Revenue
                    </span>
                    <span className="text-sm font-semibold text-emerald-300/90 tabular-nums sm:text-right shrink-0">
                      {formatPieceCount(product.units)}
                    </span>
                    <span className="font-medium text-ink text-sm tabular-nums sm:text-right shrink-0">
                      {formatCurrency(product.revenue)}
                    </span>
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
