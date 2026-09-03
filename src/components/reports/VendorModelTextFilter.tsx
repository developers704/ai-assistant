"use client";

import { cn } from "@/lib/utils";
import type { VendorModelTextFilterMode } from "@/lib/sales/vendor-model-text-filter";
import { useSurfaceTone } from "@/components/ui/surface-tone";

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
  const light = useSurfaceTone() === "light";
  const active = query.trim().length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter description / model / SKU — use commas to combine (e.g. uv, novello)"
          className={cn(
            "flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1",
            light
              ? "bg-[#fbfcfe] border border-[#d5dbe6] text-[#121826] placeholder:text-[#8b95a5] focus:ring-[#6c4dff]/30"
              : "bg-white/5 border border-white/10 text-ink placeholder:text-ink-muted/50 focus:ring-cyan-400/40"
          )}
        />
        <div
          className={cn(
            "flex shrink-0 rounded-lg overflow-hidden",
            light ? "ring-1 ring-[#e4e8f0]" : "ring-1 ring-white/10"
          )}
        >
          <button
            type="button"
            onClick={() => onModeChange("include")}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors",
              mode === "include"
                ? light
                  ? "bg-[#f1eeff] text-[#6c4dff]"
                  : "bg-cyan-500/20 text-cyan-200"
                : light
                  ? "bg-white text-[#5e6b7a] hover:text-[#121826]"
                  : "bg-white/[0.03] text-ink-muted hover:text-ink"
            )}
          >
            Show only
          </button>
          <button
            type="button"
            onClick={() => onModeChange("exclude")}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors border-l",
              light ? "border-[#e4e8f0]" : "border-white/10",
              mode === "exclude"
                ? light
                  ? "bg-[#fff1f3] text-[#e11d48]"
                  : "bg-rose-500/20 text-rose-200"
                : light
                  ? "bg-white text-[#5e6b7a] hover:text-[#121826]"
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
            className={cn(
              "shrink-0 px-2.5 py-2 text-xs",
              light ? "text-[#5e6b7a] hover:text-[#121826]" : "text-ink-muted hover:text-ink"
            )}
          >
            Clear
          </button>
        )}
      </div>
      <p className={cn("text-[11px] tabular-nums", light ? "text-[#8b95a5]" : "text-ink-muted/70")}>
        {active
          ? `${matchCount} of ${totalCount} models${
              mode === "include" ? " · showing matches" : " · hiding matches"
            }`
          : `${totalCount} models`}
      </p>
    </div>
  );
}
