"use client";

import { useState } from "react";
import {
  formatCurrency,
  formatPieceCount,
  formatProductDisplayName,
  cn,
  filterTopProductSkus,
} from "@/lib/utils";
import { ProductLightbox, ProductThumb } from "@/components/reports/ProductImagePreview";

export interface TopProductRow {
  name: string;
  itemNumber?: string;
  vendorModel?: string;
  imageDir?: string;
  imageUrl?: string | null;
  revenue: number;
  units: number;
  /** Profit = net sales − inventory cost */
  margin?: number;
  /** Profit margin = profit / net sales (0–1) */
  marginRate?: number;
}

interface TopProductsTableProps {
  products: TopProductRow[];
  emptyLabel?: string;
}

const ROW_GRID =
  "grid grid-cols-1 sm:grid-cols-[2rem_3.25rem_5rem_minmax(0,1fr)_3.75rem_5.5rem_5rem] lg:grid-cols-[2rem_3.5rem_6rem_minmax(0,2fr)_4rem_6rem_5.5rem] gap-x-3 gap-y-1";

function marginRateOf(product: TopProductRow): number {
  if (typeof product.marginRate === "number" && Number.isFinite(product.marginRate)) {
    return product.marginRate;
  }
  if (
    typeof product.margin === "number" &&
    product.revenue > 0 &&
    Number.isFinite(product.margin)
  ) {
    return product.margin / product.revenue;
  }
  return 0;
}

export function TopProductsTable({
  products,
  emptyLabel = "No product data in this report.",
}: TopProductsTableProps) {
  const rows = filterTopProductSkus(products);
  const [preview, setPreview] = useState<{
    src: string;
    alt: string;
    subtitle?: string;
  } | null>(null);

  if (!rows.length) {
    return (
      <p className="text-sm text-ink-muted py-6 text-center">{emptyLabel}</p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
        <div
          className={cn(
            "hidden sm:grid gap-x-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted bg-white/5 border-b border-white/10",
            "sm:grid-cols-[2rem_3.25rem_5rem_minmax(0,1fr)_3.75rem_5.5rem_5rem] lg:grid-cols-[2rem_3.5rem_6rem_minmax(0,2fr)_4rem_6rem_5.5rem]"
          )}
        >
          <span>#</span>
          <span>Pic</span>
          <span>Vendor model</span>
          <span>Product</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Revenue</span>
          <span className="text-right">Margin</span>
        </div>
        <ul className="max-h-[min(36rem,70vh)] overflow-y-auto divide-y divide-white/5">
          {rows.map((product, i) => {
            const displayName = formatProductDisplayName(product.name);
            const model = product.vendorModel?.trim() || product.itemNumber || "—";
            const rate = marginRateOf(product);
            const profit = product.margin ?? rate * product.revenue;
            return (
              <li
                key={`${product.vendorModel ?? ""}-${product.itemNumber ?? ""}-${product.name}-${i}`}
                className={cn(
                  ROW_GRID,
                  "px-3 py-3 sm:py-2.5 sm:items-center",
                  i % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"
                )}
              >
                <span className="text-xs font-medium text-ink-muted tabular-nums sm:text-sm">
                  {i + 1}
                </span>

                <ProductThumb
                  imageDir={product.imageDir}
                  imageUrl={product.imageUrl}
                  alt={displayName || model}
                  subtitle={model !== "—" ? model : undefined}
                  onOpen={(src, alt, subtitle) => setPreview({ src, alt, subtitle })}
                />

                <span className="font-mono text-[11px] text-cyan-300/90 tabular-nums break-all">
                  {model}
                </span>

                <p className="text-[13px] sm:text-sm text-ink/95 font-medium leading-snug tracking-[0.01em] break-words whitespace-normal line-clamp-3 sm:col-span-1 col-span-full -mt-1 sm:mt-0">
                  {displayName}
                  {product.itemNumber && product.vendorModel && (
                    <span className="block text-[11px] text-ink-muted/80 mt-1 font-mono font-normal tracking-normal">
                      SKU #{product.itemNumber}
                    </span>
                  )}
                </p>

                <div className="flex sm:contents items-center justify-between gap-3 sm:col-span-3 col-span-full pt-1 sm:pt-0 border-t border-white/5 sm:border-0">
                  <span className="sm:hidden text-[11px] text-ink-muted uppercase tracking-wide">
                    Qty / Revenue / Margin
                  </span>
                  <span className="text-sm font-semibold text-emerald-300/90 tabular-nums sm:text-right shrink-0">
                    {formatPieceCount(product.units)}
                  </span>
                  <span className="font-medium text-ink text-sm tabular-nums sm:text-right shrink-0">
                    {formatCurrency(product.revenue)}
                  </span>
                  <div className="sm:text-right shrink-0">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        rate >= 0.4
                          ? "text-emerald-300"
                          : rate >= 0.25
                            ? "text-amber-200"
                            : "text-rose-300"
                      )}
                    >
                      {(rate * 100).toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-white/40 tabular-nums">
                      {formatCurrency(profit)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
