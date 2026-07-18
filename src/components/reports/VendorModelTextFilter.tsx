"use client";

import { cn } from "@/lib/utils";
import type { VendorModelTextFilterMode } from "@/lib/sales/vendor-model-text-filter";

type VendorModelTextFilterProps = {
  query: string;
  mode: VendorModelTextFilterMode;
  onQueryChange: (query: string) => void;
  onModeChange: (mode: VendorModelTextFilterMode) => void;
  matchCount: number;
  totalCount: number;
};

export function VendorModelTextFilter({
  query,
  mode,
  onQueryChange,
  onModeChange,
  matchCount,
  totalCount,
}: VendorModelTextFilterProps) {
  const active = query.trim().length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter description / model / SKU — use commas to combine (e.g. uv, novello)"
          className="flex-1 min-w-0 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        />
        <div className="flex shrink-0 rounded-lg ring-1 ring-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => onModeChange("include")}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors",
              mode === "include"
                ? "bg-cyan-500/20 text-cyan-200"
                : "bg-white/[0.03] text-ink-muted hover:text-ink"
            )}
          >
            Show only
          </button>
          <button
            type="button"
            onClick={() => onModeChange("exclude")}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors border-l border-white/10",
              mode === "exclude"
                ? "bg-rose-500/20 text-rose-200"
                : "bg-white/[0.03] text-ink-muted hover:text-ink"
            )}
          >
            Hide
          </button>
        </div>
        {active && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="shrink-0 px-2.5 py-2 text-xs text-ink-muted hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
      <p className="text-[11px] text-ink-muted/70 tabular-nums">
        {active
          ? `${matchCount} of ${totalCount} models${
              mode === "include" ? " · showing matches" : " · hiding matches"
            }`
          : `${totalCount} models`}
      </p>
    </div>
  );
}
