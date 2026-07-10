"use client";

import { useEffect, useState } from "react";
import {
  formatCurrency,
  formatPieceCount,
  formatProductDisplayName,
  cn,
  filterTopProductSkus,
} from "@/lib/utils";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { ImageOff, X, ZoomIn } from "lucide-react";

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

function ProductLightbox({
  src,
  alt,
  subtitle,
  onClose,
}: {
  src: string;
  alt: string;
  subtitle?: string;
  onClose: () => void;
}) {
  useEffect(() => {
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
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close image preview"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 sm:-right-2 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="overflow-hidden rounded-2xl ring-1 ring-white/15 bg-[#0f1624] shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[min(78vh,720px)] w-full object-contain bg-black/40"
          />
          {(alt || subtitle) && (
            <div className="px-4 py-3 border-t border-white/10">
              {alt && <p className="text-sm text-ink font-medium line-clamp-2">{alt}</p>}
              {subtitle && (
                <p className="text-[11px] font-mono text-cyan-300/80 mt-0.5">{subtitle}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductThumb({
  imageDir,
  imageUrl,
  alt,
  subtitle,
  onOpen,
}: {
  imageDir?: string;
  imageUrl?: string | null;
  alt: string;
  subtitle?: string;
  onOpen: (src: string, alt: string, subtitle?: string) => void;
}) {
  const [failed, setFailed] = useState(false);
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
    <button
      type="button"
      onClick={() => onOpen(src, alt, subtitle)}
      className="group relative h-11 w-11 shrink-0 rounded-lg overflow-hidden ring-1 ring-white/15 bg-white/[0.04] hover:ring-sky-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 transition-all"
      title="Click to enlarge"
      aria-label={`Enlarge photo: ${alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 transition-colors">
        <ZoomIn
          size={14}
          className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
        />
      </span>
    </button>
  );
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
                  subtitle={model !== "—" ? model : undefined}
                  onOpen={(src, alt, subtitle) => setPreview({ src, alt, subtitle })}
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
