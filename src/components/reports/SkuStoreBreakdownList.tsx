"use client";

import { formatPieceCount, cn } from "@/lib/utils";

export type SkuStoreBreakdownLine = {
  name: string;
  units: number;
};

export type SkuBreakdownRow = {
  sku: string;
  units: number;
  stores?: SkuStoreBreakdownLine[];
};

/** Compact SKU + per-store sold grid for Top Vendor Models. */
export function SkuStoreBreakdownList({
  lines,
  className,
}: {
  lines: SkuBreakdownRow[];
  className?: string;
}) {
  if (!lines.length) return null;

  return (
    <ul className={cn("mt-2 space-y-2", className)}>
      {lines.map((line) => (
        <li key={line.sku} className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="font-mono text-[11px] text-cyan-300/80 tracking-normal">
              SKU #{line.sku}
            </span>
            <span className="tabular-nums text-[11px] text-emerald-300/75 font-medium">
              {formatPieceCount(line.units)} sold
            </span>
          </div>

          {line.stores && line.stores.length > 0 && (
            <div className="mt-1 overflow-hidden rounded-md ring-1 ring-white/8 bg-black/20">
              <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] gap-x-2 px-2 py-1 text-[9px] uppercase tracking-wide text-white/35 border-b border-white/8">
                <span>Store</span>
                <span className="text-right">Sold</span>
              </div>
              <ul className="divide-y divide-white/[0.04]">
                {line.stores.map((s) => (
                  <li
                    key={s.name}
                    className="grid grid-cols-[minmax(0,1fr)_3.5rem] gap-x-2 items-baseline px-2 py-1 text-[10px] font-sans tracking-normal"
                  >
                    <span className="truncate text-white/55" title={s.name}>
                      {s.name}
                    </span>
                    <span className="tabular-nums text-right text-emerald-300/60">
                      {formatPieceCount(s.units)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
