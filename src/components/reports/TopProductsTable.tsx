"use client";

import { useState } from "react";
import {
  formatCurrency,
  formatPieceCount,
  formatProductDisplayName,
  cn,
  filterTopProductSkus,
} from "@/lib/utils";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { ImageOff } from "lucide-react";

export interface TopProductRow {
  name: string;
  itemNumber?: string;
  vendorModel?: string;
  imageDir?: string;
  imageUrl?: string | null;
  revenue: number;
  units: number;
}

interface TopProductsTableProps {
  products: TopProductRow[];
  emptyLabel?: string;
}

const ROW_GRID =
  "grid grid-cols-1 sm:grid-cols-[2rem_3.25rem_5.5rem_minmax(0,1fr)_4.5rem_6.5rem] lg:grid-cols-[2rem_3.5rem_6.5rem_minmax(0,2fr)_4.5rem_7rem] gap-x-3 gap-y-1";

function ProductThumb({
  imageDir,
  imageUrl,
  alt,
}: {
  imageDir?: string;
  imageUrl?: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  // Prefer client-side resolve so NEXT_PUBLIC_* from the browser build is used.
  const src = resolveProductImageUrl(imageDir) || imageUrl || null;
  if (!src || failed) {
    return (
      <span
        className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/10 text-white/25"
        title={src ? `Image not found: ${src}` : "No image path in report"}
      >
        <ImageOff size={14} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-11 w-11 rounded-lg object-cover ring-1 ring-white/15 bg-white/[0.04]"
    />
  );
}

export function TopProductsTable({
  products,
  emptyLabel = "No product data in this report.",
}: TopProductsTableProps) {
  const rows = filterTopProductSkus(products);

  if (!rows.length) {
    return (
      <p className="text-sm text-ink-muted py-6 text-center">{emptyLabel}</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
      <div
        className={cn(
          "hidden sm:grid gap-x-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted bg-white/5 border-b border-white/10",
          "sm:grid-cols-[2rem_3.25rem_5.5rem_minmax(0,1fr)_4.5rem_6.5rem] lg:grid-cols-[2rem_3.5rem_6.5rem_minmax(0,2fr)_4.5rem_7rem]"
        )}
      >
        <span>#</span>
        <span>Pic</span>
        <span>Vendor model</span>
        <span>Product</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Revenue</span>
      </div>
      <ul className="max-h-[min(36rem,70vh)] overflow-y-auto divide-y divide-white/5">
        {rows.map((product, i) => {
          const displayName = formatProductDisplayName(product.name);
          const model = product.vendorModel?.trim() || product.itemNumber || "—";
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
              />

              <span className="font-mono text-[11px] text-cyan-300/90 tabular-nums break-all">
                {model}
              </span>

              <p className="text-sm text-ink leading-relaxed break-words whitespace-normal sm:col-span-1 col-span-full -mt-1 sm:mt-0">
                {displayName}
                {product.itemNumber && product.vendorModel && (
                  <span className="block text-[11px] text-ink-muted mt-0.5 font-mono">
                    sample SKU #{product.itemNumber}
                  </span>
                )}
              </p>

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
    </div>
  );
}
