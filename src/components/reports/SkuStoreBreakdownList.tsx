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
  /** POS Inventory Cost unit — Kash / Ross / admin only. */
  kashCost?: number;
  /** Wholesale unit cost, labeled Cost Price. AJ, Adeel, Shaun, Rozina. Never Kash inventory cost. */
  wholesaleCost?: number;
  /** Sales Amount (gross) — Tag, shown before Net Sale when expanded. */
  tagPrice?: number;
};

export type SkuBreakdownRow = {
  sku: string;
  units: number;
  /** Net sales (Total) for this SKU in the filter window. */
  revenue?: number;
  onHandTotal?: number;
  /** Shown as "tag $" — Sales Amount (gross), not inventory Tag. */
  tagPrice?: number;
  /** POS Inventory Cost unit — Kash / Ross / admin only. */
  kashCost?: number;
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

type StoreSoldLine = {
  name: string;
  units: number;
  revenue: number;
  tagPrice?: number;
  kashCost?: number;
  wholesaleCost?: number;
};

/** One row per store: that store's pcs, its net, and the one-piece tag. */
function storeSoldLines(stores?: SkuStoreBreakdownLine[]): StoreSoldLine[] {
  const map = new Map<string, StoreSoldLine & { tagUnits: number }>();
  for (const s of stores ?? []) {
    const name = (s.name ?? "").trim();
    if (!name || name === "—") continue;
    const units = Number(s.units) || 0;
    const revenue = Number(s.revenue) || 0;
    if (units <= 0 && revenue === 0) continue;
    const key = name.toUpperCase();
    const cur = map.get(key) ?? { name, units: 0, revenue: 0, tagUnits: 0 };
    cur.units += units;
    cur.revenue += revenue;
    const tag = Number(s.tagPrice) || 0;
    if (tag > 0 && units >= cur.tagUnits) {
      cur.tagPrice = tag;
      cur.tagUnits = units;
    }
    const kash = Number(s.kashCost) || 0;
    if (kash > 0) cur.kashCost = kash;
    const wholesale = Number(s.wholesaleCost) || 0;
    if (wholesale > 0 && !(cur.wholesaleCost && cur.wholesaleCost > 0)) {
      cur.wholesaleCost = wholesale;
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ tagUnits: _, ...line }) => line)
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));
}

function SaleTxnTable({ sales }: { sales: SkuStoreBreakdownLine[] }) {
  const cols = "grid-cols-[5.75rem_minmax(0,1fr)_5rem_4.75rem]";

  return (
    <>
      {/* Phone / iPad portrait: stacked — no sideways scroll */}
      <ul className="md:hidden divide-y divide-white/[0.06]">
        {sales.map((s, i) => {
          const tag = Number(s.tagPrice) || 0;
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
              <div className="min-w-0 font-mono text-[13px] text-white/55 truncate" title={txn}>
                {txn}
              </div>
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Tag
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[13px] tabular-nums font-medium",
                    tag > 0 ? "text-white/70" : "text-white/30"
                  )}
                  title={tag > 0 ? formatCurrency(tag) : "One piece"}
                >
                  {tag > 0 ? `$${formatMoneyCompact(tag)}` : "—"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* iPad landscape + Mac: table, columns share the same template */}
      <div className="hidden md:block min-w-0">
        <div
          className={cn(
            "sticky top-0 z-[1] grid gap-x-2 px-2.5 py-2 text-[13px] font-semibold uppercase tracking-wide text-white/70 border-b border-white/10 bg-black/55 backdrop-blur-sm",
            cols
          )}
        >
          <span className="min-w-0">Store</span>
          <span className="min-w-0">Transaction #</span>
          <span className="text-right">Tag</span>
          <span className="text-right">Date</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {sales.map((s, i) => {
            const tag = Number(s.tagPrice) || 0;
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
                    tag > 0 ? "text-white/70" : "text-white/30"
                  )}
                  title={tag > 0 ? formatCurrency(tag) : "One piece"}
                >
                  {tag > 0 ? `$${formatMoneyCompact(tag)}` : "—"}
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

export type OnhandStoreSkuLine = {
  sku: string;
  onhand: number;
  description?: string;
};

export type OnhandStoreLine = {
  name: string;
  onhand: number;
  skus?: OnhandStoreSkuLine[];
};

/** Vendor-model on-hand total; click store to see which SKUs sit there. */
export function VendorModelOnhandPanel({
  total,
  stores,
  className,
}: {
  total: number;
  stores?: OnhandStoreLine[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openStore, setOpenStore] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stocked = (stores ?? []).filter((s) => s.onhand > 0);

  useEffect(() => {
    if (!open) {
      setOpenStore(null);
      return;
    }
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
          className="mt-1 w-full min-w-0 overflow-y-auto overscroll-contain rounded-lg ring-1 ring-amber-300/20 bg-black/30 max-h-[min(22rem,60vh)] [overflow-x:hidden] [-webkit-overflow-scrolling:touch]"
        >
          <div className="sticky top-0 z-[1] grid grid-cols-[minmax(0,1fr)_3.25rem] gap-x-2 px-2.5 py-2 text-[13px] font-semibold uppercase tracking-wide text-white/70 border-b border-white/10 bg-black/60 backdrop-blur-sm">
            <span className="min-w-0">Store</span>
            <span className="text-right">Pcs</span>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {stocked.map((s) => {
              const main = isMainStore(s.name);
              const skus = (s.skus ?? []).filter((sku) => sku.onhand > 0);
              const expanded = openStore === s.name;
              const canExpandStore = skus.length > 0;
              return (
                <li
                  key={s.name}
                  className={cn(main && "bg-amber-500/[0.08]")}
                >
                  <button
                    type="button"
                    disabled={!canExpandStore}
                    aria-expanded={expanded}
                    onClick={() =>
                      setOpenStore((cur) => (cur === s.name ? null : s.name))
                    }
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1fr)_3.25rem] gap-x-2 items-center px-2.5 py-2 min-h-[40px] text-left text-[13px] touch-manipulation",
                      canExpandStore
                        ? "hover:bg-white/[0.05] cursor-pointer"
                        : "cursor-default"
                    )}
                  >
                    <span className="min-w-0 flex items-center gap-1.5">
                      {canExpandStore && (
                        <ChevronRight
                          size={13}
                          className={cn(
                            "shrink-0 text-white/35 transition-transform",
                            expanded && "rotate-90"
                          )}
                        />
                      )}
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
                    </span>
                    <span
                      className={cn(
                        "tabular-nums text-right font-semibold",
                        main ? "text-amber-200" : "text-amber-200/85"
                      )}
                    >
                      {formatOnhand(s.onhand)}
                    </span>
                  </button>
                  {expanded && canExpandStore && (
                    <ul className="mx-2 mb-2 rounded-md bg-black/35 ring-1 ring-white/[0.06] divide-y divide-white/[0.05]">
                      <li className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-x-2 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        <span>SKU / Item</span>
                        <span className="text-right">Qty</span>
                      </li>
                      {skus.map((sku) => {
                        const desc = sku.description?.trim();
                        return (
                          <li
                            key={sku.sku}
                            className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-x-2 items-start px-2.5 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-mono text-cyan-300/90">
                                SKU #{sku.sku}
                              </p>
                              {desc && (
                                <p
                                  className="mt-0.5 text-[12px] leading-snug text-white/45 line-clamp-2"
                                  title={desc}
                                >
                                  {desc}
                                </p>
                              )}
                            </div>
                            <span className="pt-0.5 tabular-nums text-right text-[13px] font-semibold text-white/80">
                              {formatOnhand(sku.onhand)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
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
  showKashCost = false,
  showWholesaleCost = false,
}: {
  lines: SkuBreakdownRow[];
  className?: string;
  /** Controlled expanded SKU (e.g. open first SKU from product title click). */
  openSku?: string | null;
  onOpenSkuChange?: (sku: string | null) => void;
  /** Kash / Ross / admin: CP (Kash) column on each sale row. */
  showKashCost?: boolean;
  /** AJ: wholesale unit cost on each sale row. */
  showWholesaleCost?: boolean;
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
        const byStore = storeSoldLines(line.stores);

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

                  {byStore.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {byStore.map((store) => {
                        const tag = Number(store.tagPrice) || 0;
                        const net = Number(store.revenue) || 0;
                        const kash = store.kashCost;
                        const hasKash =
                          showKashCost && kash != null && Number.isFinite(kash) && kash !== 0;
                        const wholesale = store.wholesaleCost;
                        const hasWholesale =
                          showWholesaleCost &&
                          !hasKash &&
                          wholesale != null &&
                          Number.isFinite(wholesale) &&
                          wholesale !== 0;
                        return (
                          <li
                            key={store.name}
                            data-store-sale={store.name}
                            className="rounded-md bg-white/[0.04] px-2 py-1.5 ring-1 ring-white/[0.06]"
                          >
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span
                                className="min-w-0 truncate text-[13px] font-semibold text-white/90"
                                title={store.name}
                              >
                                {store.name}
                              </span>
                              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-emerald-300/90">
                                {formatPieceCount(store.units).toUpperCase()}
                              </span>
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] tabular-nums font-medium leading-snug">
                              {tag > 0 && (
                                <span className="text-white/50 font-normal" title="One piece">
                                  TAG ${formatMoneyCompact(tag)}
                                </span>
                              )}
                              {hasKash && (
                                <>
                                  <span className="text-white/25 select-none" aria-hidden>
                                    ·
                                  </span>
                                  <span
                                    className="text-sky-200/90 font-normal"
                                    title="POS Inventory Cost (unit)"
                                  >
                                    CP ${formatMoneyCompact(kash!)}
                                  </span>
                                </>
                              )}
                              {hasWholesale && (
                                <>
                                  <span className="text-white/25 select-none" aria-hidden>
                                    ·
                                  </span>
                                  <span
                                    className="text-sky-200/90 font-normal"
                                    title="Cost Price (unit)"
                                  >
                                    Cost Price ${formatMoneyCompact(wholesale!)}
                                  </span>
                                </>
                              )}
                              {net !== 0 && (
                                <>
                                  <span className="text-white/25 select-none" aria-hidden>
                                    ·
                                  </span>
                                  <span className="text-white/75 font-normal" title={formatCurrency(net)}>
                                    NET ${formatMoneyCompact(net)}
                                  </span>
                                </>
                              )}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-[13px] font-medium text-emerald-300/75">
                      {formatPieceCount(line.units).toUpperCase()} SOLD
                    </p>
                  )}
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
