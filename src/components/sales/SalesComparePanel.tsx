"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SalesMultiSelectFilter } from "@/components/sales/SalesMultiSelectFilter";
import {
  SalesDateRangePicker,
  type SalesDateRangeValue,
} from "@/components/sales/SalesDateRangePicker";
import { appendMultiParam } from "@/lib/sales/filter-params";
import { formatCurrency, cn } from "@/lib/utils";

type SliceFilters = {
  stores: string[];
  departments: string[];
  designs: string[];
  vendors: string[];
  classes: string[];
};

type DimKey = keyof SliceFilters;

type SliceSummary = {
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  marginRate?: number;
  totalMargin?: number;
  uniqueTransactions?: number;
  label: string;
};

const emptySlice = (): SliceFilters => ({
  stores: [],
  departments: [],
  designs: [],
  vendors: [],
  classes: [],
});

const DIMS: {
  key: DimKey;
  label: string;
  allLabel: string;
  optionsKey: DimKey;
}[] = [
  { key: "stores", label: "Stores", allLabel: "All stores", optionsKey: "stores" },
  {
    key: "departments",
    label: "Departments",
    allLabel: "All departments",
    optionsKey: "departments",
  },
  { key: "designs", label: "Designs", allLabel: "All designs", optionsKey: "designs" },
  { key: "vendors", label: "Vendors", allLabel: "All vendors", optionsKey: "vendors" },
  { key: "classes", label: "Classes", allLabel: "All classes", optionsKey: "classes" },
];

function appendDateParams(params: URLSearchParams, range: SalesDateRangeValue | null) {
  if (!range) return;
  if (range.from === range.to) params.set("date", range.from);
  else {
    params.set("from", range.from);
    params.set("to", range.to);
  }
}

function labelFor(f: SliceFilters, fallback: string) {
  const parts = [
    ...f.stores,
    ...f.designs,
    ...f.departments,
    ...f.vendors,
    ...f.classes,
  ];
  if (!parts.length) return fallback;
  return parts.slice(0, 3).join(" · ") + (parts.length > 3 ? "…" : "");
}

async function fetchSlice(
  range: SalesDateRangeValue | null,
  f: SliceFilters
): Promise<SliceSummary> {
  const params = new URLSearchParams();
  appendDateParams(params, range);
  appendMultiParam(params, "store", f.stores);
  appendMultiParam(params, "department", f.departments);
  appendMultiParam(params, "design", f.designs);
  appendMultiParam(params, "vendor", f.vendors);
  appendMultiParam(params, "class", f.classes);
  const res = await fetch(`/api/sales?${params}`, { cache: "no-store" });
  const d = await res.json();
  const summary = d.summary;
  return {
    totalRevenue: summary?.totalRevenue ?? 0,
    totalTransactions: summary?.totalTransactions ?? 0,
    averageOrderValue: summary?.averageOrderValue ?? 0,
    marginRate: summary?.marginRate,
    totalMargin: summary?.totalMargin,
    uniqueTransactions: summary?.uniqueTransactions,
    label: labelFor(f, "All filters"),
  };
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 max-w-full h-8 pl-2.5 pr-1.5 rounded-lg border border-amber-700/55 bg-transparent text-sm text-slate-100">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-slate-400 hover:text-white hover:bg-slate-700"
        aria-label={`Remove ${label}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

function CompareSide({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: {
    stores: string[];
    departments: string[];
    designs: string[];
    vendors: string[];
    classes: string[];
  };
  value: SliceFilters;
  onChange: (next: SliceFilters) => void;
}) {
  const chips: { key: DimKey; item: string }[] = [];
  for (const dim of DIMS) {
    for (const item of value[dim.key]) {
      chips.push({ key: dim.key, item });
    }
  }

  const removeChip = (key: DimKey, item: string) => {
    onChange({
      ...value,
      [key]: value[key].filter((v) => v !== item),
    });
  };

  return (
    <div className="rounded-xl border border-slate-600 bg-transparent p-3 sm:p-4 min-w-0">
      <p className="text-sm font-medium text-slate-200 mb-3">{title}</p>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {chips.map(({ key, item }) => (
            <FilterChip
              key={`${key}:${item}`}
              label={item}
              onRemove={() => removeChip(key, item)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {DIMS.map((dim) => {
          const opts = options[dim.optionsKey];
          if (!opts.length) return null;
          return (
            <SalesMultiSelectFilter
              key={dim.key}
              label={dim.label}
              allLabel={dim.allLabel}
              options={opts}
              value={value[dim.key]}
              onChange={(next) => onChange({ ...value, [dim.key]: next })}
              fullWidth
              selectionsAsChips
            />
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  availableDates: string[];
  reportRange: { from: string; to: string } | null | undefined;
  options: {
    stores: string[];
    departments: string[];
    designs: string[];
    vendors: string[];
    classes: string[];
  };
  defaultDateRange: SalesDateRangeValue | null;
  hideDatePicker?: boolean;
};

export function SalesComparePanel({
  availableDates,
  reportRange,
  options,
  defaultDateRange,
  hideDatePicker = false,
}: Props) {
  const [dateRange, setDateRange] = useState<SalesDateRangeValue | null>(defaultDateRange);
  const [left, setLeft] = useState<SliceFilters>(emptySlice);
  const [right, setRight] = useState<SliceFilters>(emptySlice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState<SliceSummary | null>(null);
  const [b, setB] = useState<SliceSummary | null>(null);

  useEffect(() => {
    setDateRange(defaultDateRange);
  }, [defaultDateRange?.from, defaultDateRange?.to]);

  const runCompare = async () => {
    setLoading(true);
    setError(null);
    try {
      const [leftSum, rightSum] = await Promise.all([
        fetchSlice(dateRange, left),
        fetchSlice(dateRange, right),
      ]);
      setA(leftSum);
      setB(rightSum);
    } catch {
      setError("Comparison failed");
      setA(null);
      setB(null);
    } finally {
      setLoading(false);
    }
  };

  const MetricRow = ({
    label,
    leftVal,
    rightVal,
    format = "money",
  }: {
    label: string;
    leftVal: number;
    rightVal: number;
    format?: "money" | "num" | "pct";
  }) => {
    const fmt = (n: number) =>
      format === "money"
        ? formatCurrency(n)
        : format === "pct"
          ? `${(n * 100).toFixed(1)}%`
          : n.toLocaleString();
    const delta = leftVal - rightVal;
    const winner = Math.abs(delta) < 1e-9 ? "tie" : delta > 0 ? "left" : "right";
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b border-slate-700 last:border-0">
        <p
          className={cn(
            "font-metric-num text-right",
            winner === "left" && "text-emerald-300",
            winner === "tie" && "text-ink"
          )}
        >
          {fmt(leftVal)}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-slate-500 text-center px-1">
          {label}
        </p>
        <p
          className={cn(
            "font-metric-num text-left",
            winner === "right" && "text-emerald-300",
            winner === "tie" && "text-ink"
          )}
        >
          {fmt(rightVal)}
        </p>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-600 bg-slate-950 text-ink overflow-visible">
      <div className="px-4 pt-4 pb-3 border-b border-slate-700">
        <h3 className="text-base font-semibold text-ink flex items-center gap-2">
          <GitCompareArrows size={17} className="text-amber-300" />
          Compare sales
        </h3>
        <p className="text-xs text-ink-muted mt-1">
          Example: Novello at Modesto vs Inland — set filters on each side
        </p>
      </div>

      <div className="p-4 space-y-4">
        {!hideDatePicker && (
          <SalesDateRangePicker
            availableDates={availableDates}
            reportRange={reportRange ?? null}
            value={dateRange}
            onChange={setDateRange}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CompareSide title="Side A" options={options} value={left} onChange={setLeft} />
          <CompareSide title="Side B" options={options} value={right} onChange={setRight} />
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => void runCompare()}
          disabled={loading}
          className="gap-1.5 rounded-full"
        >
          <GitCompareArrows size={14} />
          {loading ? "Comparing…" : "Run comparison"}
        </Button>

        {error && (
          <p className="text-sm text-rose-300/90 bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {a && b && (
          <div className="rounded-xl border border-slate-600 bg-transparent px-3 py-2">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-xs text-slate-400 pb-2 border-b border-slate-700">
              <p className="text-right text-slate-200 font-medium truncate" title={a.label}>
                {a.label}
              </p>
              <p className="text-center">vs</p>
              <p className="text-left text-slate-200 font-medium truncate" title={b.label}>
                {b.label}
              </p>
            </div>
            <MetricRow label="Net sales" leftVal={a.totalRevenue} rightVal={b.totalRevenue} />
            <MetricRow
              label="Units"
              leftVal={a.totalTransactions}
              rightVal={b.totalTransactions}
              format="num"
            />
            <MetricRow
              label="Avg sale"
              leftVal={a.averageOrderValue}
              rightVal={b.averageOrderValue}
            />
            {a.marginRate != null && b.marginRate != null && (
              <MetricRow
                label="Margin"
                leftVal={a.marginRate}
                rightVal={b.marginRate}
                format="pct"
              />
            )}
            {a.totalMargin != null && b.totalMargin != null && (
              <MetricRow label="Profit" leftVal={a.totalMargin} rightVal={b.totalMargin} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
