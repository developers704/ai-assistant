"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatPieceCount, cn } from "@/lib/utils";

export type SkuStoreBreakdownLine = {
  name: string;
  units: number;
  onhand?: number | null;
};

export type SkuBreakdownRow = {
  sku: string;
  units: number;
  onHandTotal?: number;
  stores?: SkuStoreBreakdownLine[];
};

function formatOnhand(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** SKU list with click-to-expand store / sold / on-hand grid. */
export function SkuStoreBreakdownList({
  lines,
  className,
}: {
  lines: SkuBreakdownRow[];
  className?: string;
}) {
  const [openSku, setOpenSku] = useState<string | null>(null);

  if (!lines.length) return null;

  return (
    <ul className={cn("mt-2 space-y-1.5", className)}>
      {lines.map((line) => {
        const expanded = openSku === line.sku;
        const storeCount = line.stores?.length ?? 0;
        const showOnhand = (line.stores ?? []).some(
          (s) => s.onhand != null && s.onhand !== undefined
        );
        const totalOnhand = (line.stores ?? []).reduce(
          (sum, s) => sum + (typeof s.onhand === "number" ? s.onhand : 0),
          0
        );
        const canExpand = storeCount > 0;

        return (
          <li key={line.sku} className="min-w-0">
            <button
              type="button"
              disabled={!canExpand}
              onClick={() =>
                setOpenSku((cur) => (cur === line.sku ? null : line.sku))
              }
              className={cn(
                "w-full flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-md px-1.5 py-1 text-left transition-colors",
                canExpand
                  ? "hover:bg-white/[0.05] cursor-pointer"
                  : "cursor-default opacity-90"
              )}
              aria-expanded={expanded}
            >
              <span className="inline-flex items-center gap-1 min-w-0">
                {canExpand && (
                  <ChevronRight
                    size={12}
                    className={cn(
                      "shrink-0 text-white/40 transition-transform",
                      expanded && "rotate-90"
                    )}
                  />
                )}
                <span className="font-mono text-[11px] text-cyan-300/90 tracking-normal underline-offset-2 group-hover:underline">
                  SKU #{line.sku}
                </span>
              </span>
              <span className="tabular-nums text-[11px] font-medium">
                <span className="text-emerald-300/75">
                  {formatPieceCount(line.units)} sold
                </span>
                {showOnhand && (
                  <span className="text-amber-200/70 font-normal">
                    {" "}
                    · {formatOnhand(totalOnhand)} on hand
                  </span>
                )}
              </span>
            </button>

            {expanded && line.stores && line.stores.length > 0 && (
              <div className="mt-1 ml-3 overflow-hidden rounded-md ring-1 ring-white/8 bg-black/20 max-h-64 overflow-y-auto">
                <div
                  className={cn(
                    "sticky top-0 z-[1] grid gap-x-2 px-2 py-1 text-[9px] uppercase tracking-wide text-white/35 border-b border-white/8 bg-black/50 backdrop-blur-sm",
                    showOnhand
                      ? "grid-cols-[minmax(0,1.4fr)_3.25rem_3.5rem]"
                      : "grid-cols-[minmax(0,1fr)_3.5rem]"
                  )}
                >
                  <span>Store</span>
                  <span className="text-right">Sold</span>
                  {showOnhand && <span className="text-right">On hand</span>}
                </div>
                <ul className="divide-y divide-white/[0.04]">
                  {line.stores.map((s) => (
                    <li
                      key={s.name}
                      className={cn(
                        "grid gap-x-2 items-baseline px-2 py-1 text-[10px] font-sans tracking-normal",
                        showOnhand
                          ? "grid-cols-[minmax(0,1.4fr)_3.25rem_3.5rem]"
                          : "grid-cols-[minmax(0,1fr)_3.5rem]",
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
                          s.units > 0 ? "text-emerald-300/60" : "text-white/25"
                        )}
                      >
                        {formatPieceCount(s.units)}
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
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
