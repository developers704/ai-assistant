"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export interface TopProductSkuLine {
  sku: string;
  units: number;
  revenue: number;
  margin?: number;
  marginRate?: number;
  tagPrice?: number;
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
  /** Dominant department by revenue under this model */
  department?: string;
  /** Latest ISO sale date in the current filter window */
  lastSaleDate?: string;
  onHandTotal?: number;
  /** Distinct SKUs sold under this vendor model */
  skus?: TopProductSkuLine[];
}

interface TopProductsTableProps {
  products: TopProductRow[];
  emptyLabel?: string;
  onVendorModelDetail?: (product: TopProductRow) => void;
  /** When true, show Date column/sort (multi-day range selected). */
  showDateSort?: boolean;
}

type SortKey = "qty" | "revenue" | "margin" | "department" | "date";
type SortDir = "asc" | "desc";

const DESKTOP_ROW_GRID =
  "sm:grid-cols-[2rem_3.5rem_5.5rem_minmax(0,1fr)_auto]";
const DESKTOP_METRICS =
  "grid grid-cols-[3.25rem_5rem_3rem] gap-x-2.5";

function formatMarginPct(rate: number | undefined | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(0)}%`;
}

function shortIso(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
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

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
  title,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
  title?: string;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      title={title ?? `Sort by ${label}`}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-0.5 hover:text-white/80 transition-colors",
        active ? "text-sky-300" : "text-ink-muted",
        className
      )}
    >
      {label}
      <Icon size={11} className="opacity-80" />
    </button>
  );
}

export function TopProductsTable({
  products,
  emptyLabel = "No product data in this report.",
  onVendorModelDetail,
  showDateSort = false,
}: TopProductsTableProps) {
  const baseRows = filterTopProductSkus(products);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<VendorModelTextFilterMode>("include");
  const [sortKey, setSortKey] = useState<SortKey>("qty");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  /** Expanded SKU per vendor-model row (shared mobile/desktop). */
  const [openSkuByRow, setOpenSkuByRow] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<{
    src: string;
    alt: string;
    subtitle?: string;
  } | null>(null);

  // Close expanded SKU store details on any click outside the SKU detail UI
  useEffect(() => {
    const hasOpen = Object.values(openSkuByRow).some(Boolean);
    if (!hasOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.("[data-sku-detail]")) return;
      setOpenSkuByRow({});
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openSkuByRow]);

  const filtered = useMemo(
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

  const rows = useMemo(() => {
    const list = [...filtered];
    const mul = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "department") {
        const cmp = (a.department || "zzz").localeCompare(b.department || "zzz");
        if (cmp !== 0) return cmp * mul;
      } else if (sortKey === "date") {
        const cmp = (a.lastSaleDate || "").localeCompare(b.lastSaleDate || "");
        if (cmp !== 0) return cmp * mul;
      } else if (sortKey === "qty") {
        if (a.units !== b.units) return (a.units - b.units) * mul;
      } else if (sortKey === "revenue") {
        if (a.revenue !== b.revenue) return (a.revenue - b.revenue) * mul;
      } else if (sortKey === "margin") {
        const ar =
          a.marginRate ??
          (a.revenue > 0 && a.margin != null ? a.margin / a.revenue : 0);
        const br =
          b.marginRate ??
          (b.revenue > 0 && b.margin != null ? b.margin / b.revenue : 0);
        if (ar !== br) return (ar - br) * mul;
      }
      // Stable tie-breakers
      if (a.units !== b.units) return b.units - a.units;
      if (a.revenue !== b.revenue) return b.revenue - a.revenue;
      return (a.vendorModel || a.name).localeCompare(b.vendorModel || b.name);
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "department" ? "asc" : "desc");
    }
  };

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
            "hidden sm:grid gap-x-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wide bg-white/5 border-b border-white/10 items-center",
            DESKTOP_ROW_GRID
          )}
        >
          <span className="text-ink-muted">#</span>
          <span className="text-ink-muted">Pic</span>
          <span className="text-ink-muted">Vendor model</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            <span className="text-ink-muted">Product</span>
            <SortHeader
              label="Dept"
              active={sortKey === "department"}
              dir={sortDir}
              onClick={() => toggleSort("department")}
            />
            {showDateSort && (
              <SortHeader
                label="Date"
                active={sortKey === "date"}
                dir={sortDir}
                onClick={() => toggleSort("date")}
                title="Sort by most recent sale date"
              />
            )}
          </div>
          <div className={DESKTOP_METRICS}>
            <SortHeader
              label="Qty"
              active={sortKey === "qty"}
              dir={sortDir}
              onClick={() => toggleSort("qty")}
              className="justify-end w-full"
            />
            <SortHeader
              label="Revenue"
              active={sortKey === "revenue"}
              dir={sortDir}
              onClick={() => toggleSort("revenue")}
              className="justify-end w-full"
            />
            <SortHeader
              label="Margin"
              active={sortKey === "margin"}
              dir={sortDir}
              onClick={() => toggleSort("margin")}
              className="justify-end w-full"
              title="Profit ÷ Net sales"
            />
          </div>
        </div>

        {/* Mobile sort chips */}
        <div className="sm:hidden flex flex-wrap gap-1.5 px-3 py-2 border-b border-white/10 bg-white/[0.03]">
          {(
            [
              ["qty", "Qty"],
              ["revenue", "Rev"],
              ["margin", "Margin"],
              ["department", "Dept"],
              ...(showDateSort ? [["date", "Date"] as const] : []),
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleSort(key)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                sortKey === key
                  ? "bg-sky-500/20 text-sky-200 ring-sky-400/40"
                  : "text-white/50 ring-white/10"
              )}
            >
              {label}
              {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          ))}
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
              const rowKey = `${product.vendorModel ?? ""}|${product.itemNumber ?? ""}|${product.name}|${i}`;
              const marginRate =
                product.marginRate ??
                (product.revenue > 0 && product.margin != null
                  ? product.margin / product.revenue
                  : null);
              const skuLines: TopProductSkuLine[] = product.skus?.length
                ? product.skus
                : [];
              const openSku = openSkuByRow[rowKey] ?? null;
              const firstSku = skuLines[0]?.sku ?? null;
              const firstSkuExpandable = Boolean(
                firstSku && (skuLines[0]?.stores?.length ?? 0) > 0
              );

              const toggleFirstSku = () => {
                if (!firstSku || !firstSkuExpandable) return;
                setOpenSkuByRow((prev) => ({
                  ...prev,
                  [rowKey]: prev[rowKey] === firstSku ? null : firstSku,
                }));
              };

              return (
                <li
                  key={rowKey}
                  className={cn(
                    i % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent",
                    "px-3 py-3 space-y-2.5 sm:space-y-0 sm:py-2.5 sm:grid sm:gap-x-3 sm:items-start",
                    DESKTOP_ROW_GRID,
                    onVendorModelDetail &&
                      "sm:cursor-pointer sm:hover:bg-white/[0.04] transition-colors"
                  )}
                  onClick={() => {
                    if (
                      typeof window !== "undefined" &&
                      window.matchMedia("(min-width: 640px)").matches
                    ) {
                      onVendorModelDetail?.(product);
                    }
                  }}
                >
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
                        {firstSkuExpandable ? (
                          <button
                            type="button"
                            data-sku-detail
                            onClick={toggleFirstSku}
                            className="text-left text-[13px] sm:text-sm text-ink/95 font-medium leading-snug tracking-[0.01em] break-words line-clamp-2 sm:line-clamp-3 hover:text-sky-100 hover:underline underline-offset-2 decoration-sky-400/40"
                            title={`Open first SKU #${firstSku} store details`}
                            aria-expanded={openSku === firstSku}
                          >
                            {displayName}
                          </button>
                        ) : (
                          <p className="text-[13px] sm:text-sm text-ink/95 font-medium leading-snug tracking-[0.01em] break-words line-clamp-2 sm:line-clamp-3">
                            {displayName}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-white/40 truncate">
                          {product.department || "—"}
                          {showDateSort && product.lastSaleDate
                            ? ` · ${shortIso(product.lastSaleDate)}`
                            : ""}
                        </p>
                        <div className="hidden sm:block">
                          {skuLines.length > 0 && (
                            <SkuStoreBreakdownList
                              lines={skuLines}
                              openSku={openSku}
                              onOpenSkuChange={(sku) =>
                                setOpenSkuByRow((prev) => ({ ...prev, [rowKey]: sku }))
                              }
                            />
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
                        <SkuStoreBreakdownList
                          lines={skuLines}
                          className="mt-2"
                          openSku={openSku}
                          onOpenSkuChange={(sku) =>
                            setOpenSkuByRow((prev) => ({ ...prev, [rowKey]: sku }))
                          }
                        />
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
