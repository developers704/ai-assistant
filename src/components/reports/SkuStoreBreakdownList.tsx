"use client";

import { useEffect, useRef, useState } from "react";
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
  transactionId?: string;
  date?: string;
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

function shortSaleDate(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso?.trim() || "—";
  const [y, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}/${y}`;
}

function isMainStore(name: string): boolean {
  return name.trim().toUpperCase() === "MAIN";
}

function SaleTxnTable({ sales }: { sales: SkuStoreBreakdownLine[] }) {
  const cols = "grid-cols-[7.25rem_minmax(0,1fr)_6.5rem_5.75rem]";

  return (
    <>
      {/* Phone / iPad portrait: stacked — no sideways scroll */}
      <ul className="md:hidden divide-y divide-white/[0.06]">
        {sales.map((s, i) => {
          const storeNet = Number(s.revenue) || 0;
          const txn = s.transactionId?.trim() || "—";
          return (
            <li
              key={`${s.transactionId ?? ""}|${s.name}|${s.date ?? ""}|${i}`}
              className="px-2.5 py-2.5 space-y-1"
            >
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="truncate text-[13px] font-medium text-white/80" title={s.name}>
                  {s.name}
                </span>
                <span className="shrink-0 text-[13px] tabular-nums text-white/60">
                  {shortSaleDate(s.date)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="truncate font-mono text-[13px] text-white/55" title={txn}>
                  {txn}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[13px] tabular-nums font-medium",
                    storeNet !== 0 ? "text-white/85" : "text-white/30"
                  )}
                >
                  {storeNet !== 0 ? `$${formatMoneyCompact(storeNet)}` : "—"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* iPad landscape + Mac: 4-col table, columns share the same template */}
      <div className="hidden md:block min-w-0">
        <div
          className={cn(
            "sticky top-0 z-[1] grid gap-x-2 px-2.5 py-2 text-[13px] font-semibold uppercase tracking-wide text-white/70 border-b border-white/10 bg-black/55 backdrop-blur-sm",
            cols
          )}
        >
          <span className="min-w-0">Store</span>
          <span className="min-w-0">Transaction #</span>
          <span className="text-right">Net Sale</span>
          <span className="text-right">Date</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {sales.map((s, i) => {
            const storeNet = Number(s.revenue) || 0;
            const txn = s.transactionId?.trim() || "—";
            return (
              <li
                key={`${s.transactionId ?? ""}|${s.name}|${s.date ?? ""}|${i}`}
                className={cn(
                  "grid gap-x-2 items-center px-2.5 py-2 text-[13px] font-sans min-w-0",
                  cols
                )}
              >
                <span className="min-w-0 truncate text-white/80" title={s.name}>
                  {s.name}
                </span>
                <span
                  className="min-w-0 truncate text-[13px] text-white/70"
                  title={txn}
                >
                  {txn}
                </span>
                <span
                  className={cn(
                    "tabular-nums text-right",
                    storeNet !== 0 ? "text-white/85" : "text-white/30"
                  )}
                  title={storeNet !== 0 ? formatCurrency(storeNet) : undefined}
                >
                  {storeNet !== 0 ? `$${formatMoneyCompact(storeNet)}` : "—"}
                </span>
                <span className="tabular-nums text-right text-white/60">
                  {shortSaleDate(s.date)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/** Vendor-model on-hand total; click to open per-store pcs (MAIN included). */
export function VendorModelOnhandPanel({
  total,
  stores,
  className,
}: {
  total: number;
  stores?: { name: string; onhand: number }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const stocked = (stores ?? []).filter((s) => s.onhand > 0);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);
  if (total <= 0 && stocked.length === 0) {
    return (
      <p
        className={cn(
          "mt-1.5 text-[13px] font-medium text-white/40",
          className
        )}
      >
        0 ON HAND
      </p>
    );
  }

  const canOpen = stocked.length > 0;

  return (
    <div ref={panelRef} className={cn("mt-2 w-full min-w-0", className)}>
      <button
        type="button"
        disabled={!canOpen}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full max-w-full items-center gap-1.5 rounded-lg px-2 py-2.5 text-left touch-manipulation",
          "text-[13px] font-semibold tracking-tight text-amber-100 min-h-[44px]",
          canOpen
            ? "hover:bg-amber-400/10 active:bg-amber-400/15 cursor-pointer"
            : "cursor-default"
        )}
      >
        {canOpen && (
          <ChevronRight
            size={16}
            className={cn(
              "shrink-0 text-amber-200/70 transition-transform",
              open && "rotate-90"
            )}
          />
        )}
        <span className="min-w-0 truncate">
          <span className="tabular-nums">{formatOnhand(total)}</span>
          <span className="font-medium text-amber-100/80"> ON HAND</span>
          {stocked.length > 0 && (
            <span className="font-normal text-white/50">
              {" "}
              · {stocked.length} {stocked.length === 1 ? "STORE" : "STORES"}
            </span>
          )}
        </span>
      </button>
      {open && canOpen && (
        <div
          role="listbox"
          onClick={() => setOpen(false)}
          className="mt-1 w-full min-w-0 cursor-pointer overflow-y-auto overscroll-contain rounded-lg ring-1 ring-amber-300/20 bg-black/30 max-h-[min(16rem,50vh)] [overflow-x:hidden] [-webkit-overflow-scrolling:touch]"
        >
          <div className="sticky top-0 z-[1] grid grid-cols-[minmax(0,1fr)_3.25rem] gap-x-2 px-2.5 py-2 text-[13px] font-semibold uppercase tracking-wide text-white/70 border-b border-white/10 bg-black/60 backdrop-blur-sm">
            <span className="min-w-0">Store</span>
            <span className="text-right">Pcs</span>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {stocked.map((s) => {
              const main = isMainStore(s.name);
              return (
                <li
                  key={s.name}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_3.25rem] gap-x-2 items-center px-2.5 py-2 min-h-[40px] text-[13px]",
                    main && "bg-amber-500/[0.10]"
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      main
                        ? "font-semibold text-amber-50"
                        : "font-medium text-white/75"
                    )}
                    title={s.name}
                  >
                    {main ? "MAIN" : s.name}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums text-right font-semibold",
                      main ? "text-amber-200" : "text-amber-200/85"
                    )}
                  >
                    {formatOnhand(s.onhand)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
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
        const saleCount = line.stores?.length ?? 0;
        const canExpand = saleCount > 0;
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
                "w-full rounded-md px-1.5 py-2 text-left transition-colors touch-manipulation min-h-[44px]",
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
                  <span className="text-[13px] font-mono text-cyan-300/90 tracking-normal">
                    SKU #{line.sku}
                  </span>

                  {/* Mobile: 2×2 chips · Desktop: single compact row */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] tabular-nums font-medium">
                    {hasTag && (
                      <span className="text-white/45 font-normal" title="Sales Amount">
                        TAG ${formatMoneyCompact(line.tagPrice!)}
                      </span>
                    )}
                    {hasTag && hasNet && (
                      <span className="text-white/25 select-none" aria-hidden>
                        ·
                      </span>
                    )}
                    {hasNet && (
                      <span
                        className="text-white/80 font-normal"
                        title={formatCurrency(line.revenue!)}
                      >
                        NET ${formatMoneyCompact(line.revenue!)}
                      </span>
                    )}
                    {(hasTag || hasNet) && (
                      <span className="text-white/25 select-none" aria-hidden>
                        ·
                      </span>
                    )}
                    <span className="text-emerald-300/75">
                      {formatPieceCount(line.units).toUpperCase()} SOLD
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {expanded && line.stores && line.stores.length > 0 && (
              <div className="mt-1 w-full min-w-0 overflow-hidden rounded-md ring-1 ring-white/8 bg-black/20 max-h-64 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                <SaleTxnTable sales={line.stores} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
