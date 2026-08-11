"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatCurrency, formatPieceCount, cn } from "@/lib/utils";

export type SkuStoreBreakdownLine = {
  name: string;
  units: number;
  /** Return qty in window — Sold column shows e.g. 2 (−1 rtn). */
  returned?: number;
  /** Net sales at this store for this SKU. */
  revenue?: number;
  onhand?: number | null;
};

export type SkuBreakdownRow = {
  sku: string;
  units: number;
  /** Net sales (Total) for this SKU in the filter window. */
  revenue?: number;
  onHandTotal?: number;
  /** Shown as "tag $" — Sales Amount (gross), not inventory Tag. */
  tagPrice?: number;
  stores?: SkuStoreBreakdownLine[];
};

function formatOnhand(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatMoneyCompact(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: n >= 100 ? 0 : 2,
    minimumFractionDigits: 0,
  });
}

/** SKU list with click-to-expand store / sold / on-hand grid. */
export function SkuStoreBreakdownList({
  lines,
  className,
  openSku: openSkuProp,
  onOpenSkuChange,
}: {
  lines: SkuBreakdownRow[];
  className?: string;
  /** Controlled expanded SKU (e.g. open first SKU from product title click). */
  openSku?: string | null;
  onOpenSkuChange?: (sku: string | null) => void;
}) {
  const [internalOpen, setInternalOpen] = useState<string | null>(null);
  const controlled = openSkuProp !== undefined;
  const openSku = controlled ? openSkuProp ?? null : internalOpen;
  const setOpenSku = (next: string | null | ((cur: string | null) => string | null)) => {
    const resolved =
      typeof next === "function" ? next(controlled ? openSkuProp ?? null : internalOpen) : next;
    if (!controlled) setInternalOpen(resolved);
    onOpenSkuChange?.(resolved);
  };

  if (!lines.length) return null;

  return (
    <ul className={cn("mt-2 space-y-2", className)} data-sku-detail>
      {lines.map((line) => {
        const expanded = openSku === line.sku;
        const storeCount = line.stores?.length ?? 0;
        const showOnhand = (line.stores ?? []).some(
          (s) => s.onhand != null && s.onhand !== undefined
        );
        const totalOnhand =
          typeof line.onHandTotal === "number"
            ? line.onHandTotal
            : (line.stores ?? []).reduce(
                (sum, s) => sum + (typeof s.onhand === "number" ? s.onhand : 0),
                0
              );
        const canExpand = storeCount > 0;
        const hasTag = typeof line.tagPrice === "number" && line.tagPrice > 0;
        const hasNet = typeof line.revenue === "number" && Number.isFinite(line.revenue);

        return (
          <li key={line.sku} className="min-w-0">
            <button
              type="button"
              disabled={!canExpand}
              onClick={() =>
                setOpenSku((cur) => (cur === line.sku ? null : line.sku))
              }
              className={cn(
                "w-full rounded-md px-1.5 py-1.5 text-left transition-colors",
                canExpand
                  ? "hover:bg-white/[0.05] cursor-pointer"
                  : "cursor-default opacity-90"
              )}
              aria-expanded={expanded}
            >
              <div className="flex items-start gap-1 min-w-0">
                {canExpand && (
                  <ChevronRight
                    size={12}
                    className={cn(
                      "mt-0.5 shrink-0 text-white/40 transition-transform",
                      expanded && "rotate-90"
                    )}
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="font-mono text-[11px] text-cyan-300/90 tracking-normal">
                    SKU #{line.sku}
                  </span>

                  {/* Mobile: 2×2 chips · Desktop: single compact row */}
                  <div
                    className={cn(
                      "grid grid-cols-2 gap-x-2 gap-y-1",
                      "sm:flex sm:flex-wrap sm:items-center sm:gap-x-0",
                      "sm:[&>:not(:last-child)]:after:content-['·'] sm:[&>:not(:last-child)]:after:mx-1.5 sm:[&>:not(:last-child)]:after:text-white/25",
                      "text-[11px] tabular-nums font-medium"
                    )}
                  >
                    {hasTag && (
                      <span className="text-white/45 font-normal" title="Sales Amount">
                        tag ${formatMoneyCompact(line.tagPrice!)}
                      </span>
                    )}
                    {hasNet && (
                      <span
                        className="text-white/80 font-normal"
                        title={formatCurrency(line.revenue!)}
                      >
                        net ${formatMoneyCompact(line.revenue!)}
                      </span>
                    )}
                    <span className="text-emerald-300/75">
                      {formatPieceCount(line.units)} sold
                    </span>
                    {showOnhand && (
                      <span className="text-amber-200/70 font-normal">
                        {formatOnhand(totalOnhand)} on hand
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            {expanded && line.stores && line.stores.length > 0 && (
              <div className="mt-1 ml-3 overflow-hidden rounded-md ring-1 ring-white/8 bg-black/20 max-h-64 overflow-y-auto">
                <div
                  className={cn(
                    "sticky top-0 z-[1] grid gap-x-1.5 sm:gap-x-2 px-2 py-1 text-[9px] uppercase tracking-wide text-white/35 border-b border-white/8 bg-black/50 backdrop-blur-sm",
                    showOnhand
                      ? "grid-cols-[minmax(0,1.1fr)_minmax(3rem,0.9fr)_minmax(3.5rem,1.1fr)_2.75rem]"
                      : "grid-cols-[minmax(0,1.1fr)_minmax(3rem,0.9fr)_minmax(3.5rem,1.1fr)]"
                  )}
                >
                  <span>Store</span>
                  <span className="text-right">Net</span>
                  <span className="text-right">Sold</span>
                  {showOnhand && <span className="text-right">On hand</span>}
                </div>
                <ul className="divide-y divide-white/[0.04]">
                  {line.stores.map((s) => {
                    const storeNet = Number(s.revenue) || 0;
                    const returned = Number(s.returned) || 0;
                    const soldLabel =
                      returned > 0
                        ? `${formatPieceCount(s.units)} (−${formatPieceCount(returned)} rtn)`
                        : formatPieceCount(s.units);
                    return (
                      <li
                        key={s.name}
                        className={cn(
                          "grid gap-x-1.5 sm:gap-x-2 items-baseline px-2 py-1 text-[10px] font-sans tracking-normal",
                          showOnhand
                            ? "grid-cols-[minmax(0,1.1fr)_minmax(3rem,0.9fr)_minmax(3.5rem,1.1fr)_2.75rem]"
                            : "grid-cols-[minmax(0,1.1fr)_minmax(3rem,0.9fr)_minmax(3.5rem,1.1fr)]",
                          s.units <= 0 && (s.onhand ?? 0) > 0
                            ? "bg-amber-500/[0.04]"
                            : undefined
                        )}
                      >
                        <span className="truncate text-white/55" title={s.name}>
                          {s.name}
                        </span>
                        <span
                          className={cn(
                            "tabular-nums text-right",
                            storeNet !== 0 ? "text-white/75" : "text-white/25"
                          )}
                          title={storeNet !== 0 ? formatCurrency(storeNet) : undefined}
                        >
                          {storeNet !== 0
                            ? `$${formatMoneyCompact(storeNet)}`
                            : "—"}
                        </span>
                        <span
                          className={cn(
                            "tabular-nums text-right leading-tight",
                            s.units > 0 ? "text-emerald-300/60" : "text-white/25",
                            returned > 0 && "text-amber-200/80"
                          )}
                          title={
                            returned > 0
                              ? `${formatPieceCount(s.units)} sold, ${formatPieceCount(returned)} returned — net $ includes both`
                              : undefined
                          }
                        >
                          {soldLabel}
                        </span>
                        {showOnhand && (
                          <span
                            className={cn(
                              "tabular-nums text-right",
                              (s.onhand ?? 0) > 0
                                ? "text-amber-200/70"
                                : "text-white/30"
                            )}
                          >
                            {s.onhand != null ? formatOnhand(s.onhand) : "—"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
