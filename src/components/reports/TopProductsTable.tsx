"use client";

import { useEffect, useMemo, useState, Fragment, type CSSProperties, type ReactNode } from "react";
import {
  formatCurrency,
  formatPieceCount,
  formatProductDisplayName,
  cn,
  filterTopProductSkus,
} from "@/lib/utils";
import { ProductLightbox, ProductThumb } from "@/components/reports/ProductImagePreview";
import { VendorModelTextFilter } from "@/components/reports/VendorModelTextFilter";
import { SkuStoreBreakdownList, VendorModelOnhandPanel } from "@/components/reports/SkuStoreBreakdownList";
import { SalesMultiSelectFilter } from "@/components/sales/SalesMultiSelectFilter";
import {
  applyVendorModelTextFilter,
  buildVendorModelSearchText,
  type VendorModelTextFilterMode,
} from "@/lib/sales/vendor-model-text-filter";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";

export interface TopProductSkuLine {
  sku: string;
  units: number;
  revenue: number;
  margin?: number;
  marginRate?: number;
  tagPrice?: number;
  onHandTotal?: number;
  stores?: {
    name: string;
    units: number;
    returned?: number;
    revenue?: number;
    onhand?: number | null;
    transactionId?: string;
    date?: string;
  }[];
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
  /** Distinct sale dates (ISO) for this model in the window */
  saleDates?: string[];
  onHandTotal?: number;
  /** Stores with on-hand qty > 0 (MAIN first). */
  onHandStores?: {
    name: string;
    onhand: number;
    skus?: { sku: string; onhand: number; description?: string }[];
  }[];
  /** Distinct SKUs sold under this vendor model */
  skus?: TopProductSkuLine[];
}

interface TopProductsTableProps {
  products: TopProductRow[];
  emptyLabel?: string;
  /** When true (multi-day range), show date multi-select like departments. */
  showDateFilter?: boolean;
  /** Rozina: keep ITEM / soft-hidden sold lines in the table. */
  includeHiddenTopModels?: boolean;
}

type SortKey = "date" | "qty" | "revenue" | "margin";
type SortDir = "asc" | "desc";
export type MetricColumn = "dept" | "date" | "qty" | "revenue" | "margin";

const ALL_METRIC_COLUMNS: { key: MetricColumn; label: string; width: string }[] = [
  { key: "dept", label: "Dept", width: "4.75rem" },
  { key: "date", label: "Date", width: "2.75rem" },
  { key: "qty", label: "Qty", width: "3.25rem" },
  { key: "revenue", label: "Revenue", width: "5rem" },
  { key: "margin", label: "Margin", width: "3rem" },
];

const COLUMN_STORAGE_KEY = "athena.top-products.columns";

function defaultVisibleColumns(): MetricColumn[] {
  return ALL_METRIC_COLUMNS.map((c) => c.key);
}

function loadVisibleColumns(): MetricColumn[] {
  if (typeof window === "undefined") return defaultVisibleColumns();
  try {
    const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return defaultVisibleColumns();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultVisibleColumns();
    const allowed = new Set(ALL_METRIC_COLUMNS.map((c) => c.key));
    const next = parsed.filter((k): k is MetricColumn => allowed.has(k as MetricColumn));
    return next.length ? next : defaultVisibleColumns();
  } catch {
    return defaultVisibleColumns();
  }
}

function metricsGridStyle(visible: MetricColumn[]): CSSProperties {
  const widths = Object.fromEntries(ALL_METRIC_COLUMNS.map((c) => [c.key, c.width])) as Record<
    MetricColumn,
    string
  >;
  return {
    display: "grid",
    gridTemplateColumns: visible.map((k) => widths[k]).join(" "),
    columnGap: "0.625rem",
  };
}

const DESKTOP_ROW_GRID =
  "lg:grid-cols-[1.75rem_3.25rem_minmax(4.75rem,5.75rem)_minmax(0,1fr)_minmax(0,auto)]";

/** One size for headers + cells in Vendor Models (no mixed 10/11/12/14). */
const TYPE = "text-[13px]";
const TYPE_HEADER = "text-[13px] font-medium uppercase tracking-wide";

function formatMarginPct(rate: number | undefined | null): string {
  // Repair / memo lines pass null → red hyphen (see MetricsBlock marginClass)
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
  department,
  dateLabel,
  mobile,
  visible,
}: {
  units: number;
  revenue: number;
  marginRate: number | null;
  profit?: number;
  department?: string;
  dateLabel?: string;
  mobile?: boolean;
  visible: MetricColumn[];
}) {
  const marginClass =
    marginRate != null && marginRate >= 0.5
      ? "text-amber-200/90"
      : marginRate != null && marginRate >= 0
        ? "text-white/75"
        : "text-accent-rose/80";
  const dept = department?.trim() || "—";
  const date = dateLabel?.trim() || "—";

  const show = (key: MetricColumn) => visible.includes(key);
  const cells: { key: MetricColumn; node: ReactNode }[] = [
    {
      key: "dept",
      node: (
        <span className={cn(TYPE, "text-white/75 truncate text-right")} title={dept}>
          {dept}
        </span>
      ),
    },
    {
      key: "date",
      node: (
        <span className={cn(TYPE, "text-white/75 tabular-nums text-right")} title={date}>
          {date}
        </span>
      ),
    },
    {
      key: "qty",
      node: (
        <span className={cn(TYPE, "font-semibold text-emerald-300/90 tabular-nums text-right")}>
          {formatPieceCount(units)}
        </span>
      ),
    },
    {
      key: "revenue",
      node: (
        <span className={cn(TYPE, "font-medium text-ink tabular-nums text-right")}>
          {formatCurrency(revenue)}
        </span>
      ),
    },
    {
      key: "margin",
      node: (
        <span
          className={cn(TYPE, "font-semibold tabular-nums text-right", marginClass)}
          title={
            profit != null
              ? `Profit ${formatCurrency(profit)} on ${formatCurrency(revenue)} net`
              : "Profit ÷ Net sales"
          }
        >
          {formatMarginPct(marginRate)}
        </span>
      ),
    },
  ];

  if (mobile) {
    const meta = (
      [
        show("dept") ? (
          <div key="dept" className="rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-2.5 py-2">
            <span className={cn("block", TYPE_HEADER, "text-white/45")}>
              Dept
            </span>
            <span className={cn("mt-0.5 block truncate", TYPE, "text-white/80")} title={dept}>
              {dept}
            </span>
          </div>
        ) : null,
        show("date") ? (
          <div key="date" className="rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-2.5 py-2">
            <span className={cn("block", TYPE_HEADER, "text-white/45")}>
              Date
            </span>
            <span className={cn("mt-0.5 block tabular-nums", TYPE, "text-white/80")}>{date}</span>
          </div>
        ) : null,
      ] as const
    ).filter(Boolean);
    const nums = (
      [
        show("qty") ? (
          <div key="qty" className="flex flex-col items-center justify-center px-1.5 py-2.5 text-center">
            <span className={cn(TYPE_HEADER, "text-white/45")}>
              Qty
            </span>
            <span className={cn("mt-0.5 font-semibold text-emerald-300 tabular-nums", TYPE)}>
              {formatPieceCount(units)}
            </span>
          </div>
        ) : null,
        show("revenue") ? (
          <div key="revenue" className="flex flex-col items-center justify-center px-1.5 py-2.5 text-center">
            <span className={cn(TYPE_HEADER, "text-white/45")}>
              Revenue
            </span>
            <span className={cn("mt-0.5 font-semibold text-ink tabular-nums", TYPE)}>
              {formatCurrency(revenue)}
            </span>
          </div>
        ) : null,
        show("margin") ? (
          <div key="margin" className="flex flex-col items-center justify-center px-1.5 py-2.5 text-center">
            <span className={cn(TYPE_HEADER, "text-white/45")}>
              Margin
            </span>
            <span
              className={cn("mt-0.5 font-semibold tabular-nums", TYPE, marginClass)}
              title={
                profit != null
                  ? `Profit ${formatCurrency(profit)} on ${formatCurrency(revenue)} net`
                  : "Profit ÷ Net sales"
              }
            >
              {formatMarginPct(marginRate)}
            </span>
          </div>
        ) : null,
      ] as const
    ).filter(Boolean);

    return (
      <div className="space-y-2">
        {meta.length > 0 && (
          <div className={cn("grid gap-2", TYPE, meta.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {meta}
          </div>
        )}
        {nums.length > 0 && (
          <div
            className="grid divide-x divide-white/10 rounded-xl bg-white/[0.04] ring-1 ring-white/10 overflow-hidden"
            style={{ gridTemplateColumns: `repeat(${nums.length}, minmax(0, 1fr))` }}
          >
            {nums}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={metricsGridStyle(visible)}>
      {cells.filter((c) => show(c.key)).map((c) => (
        <Fragment key={c.key}>{c.node}</Fragment>
      ))}
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
      <Icon size={13} className="opacity-80" />
    </button>
  );
}

function productSaleDates(p: TopProductRow): string[] {
  if (p.saleDates?.length) return p.saleDates;
  return p.lastSaleDate ? [p.lastSaleDate] : [];
}

function formatModelDate(p: TopProductRow): string {
  const dates = productSaleDates(p);
  if (!dates.length) return "—";
  if (dates.length === 1) return shortIso(dates[0]);
  return `${shortIso(dates[0])}–${shortIso(dates[dates.length - 1])}`;
}

/** ISO date used for sorting (latest sale in the model window). */
function sortDateKey(p: TopProductRow): string {
  const dates = productSaleDates(p);
  if (!dates.length) return "";
  return dates[dates.length - 1] ?? "";
}

export function TopProductsTable({
  products,
  emptyLabel = "No product data in this report.",
  showDateFilter = false,
  includeHiddenTopModels = false,
}: TopProductsTableProps) {
  const baseRows = filterTopProductSkus(products, { includeHiddenTopModels });
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<VendorModelTextFilterMode>("include");
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("qty");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleCols, setVisibleCols] = useState<MetricColumn[] | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  /** Expanded SKU per vendor-model row (shared mobile/desktop). */
  const [openSkuByRow, setOpenSkuByRow] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<{
    src: string;
    alt: string;
    subtitle?: string;
  } | null>(null);

  const columns = visibleCols ?? defaultVisibleColumns();

  useEffect(() => {
    setVisibleCols(loadVisibleColumns());
  }, []);

  useEffect(() => {
    if (!visibleCols || typeof window === "undefined") return;
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleCols));
  }, [visibleCols]);

  const toggleColumn = (key: MetricColumn) => {
    setVisibleCols((prev) => {
      const current = prev ?? defaultVisibleColumns();
      if (current.includes(key)) {
        if (current.length <= 1) return current;
        return current.filter((k) => k !== key);
      }
      const order = ALL_METRIC_COLUMNS.map((c) => c.key);
      return order.filter((k) => k === key || current.includes(k));
    });
  };

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

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of baseRows) {
      const d = p.department?.trim();
      if (d) set.add(d);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [baseRows]);

  const dateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of baseRows) {
      for (const d of productSaleDates(p)) set.add(d);
    }
    return [...set].sort();
  }, [baseRows]);

  /** Date filter when parent says multi-day, or when rows span more than one day. */
  const canFilterDates = showDateFilter || dateOptions.length > 1;

  useEffect(() => {
    if (!canFilterDates) setDateFilter([]);
  }, [canFilterDates]);

  const filtered = useMemo(() => {
    let next = applyVendorModelTextFilter(
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
    );
    if (deptFilter.length) {
      const want = new Set(deptFilter);
      next = next.filter((p) => p.department && want.has(p.department));
    }
    if (canFilterDates && dateFilter.length) {
      const want = new Set(dateFilter);
      next = next.filter((p) =>
        productSaleDates(p).some((d) => want.has(d))
      );
    }
    return next;
  }, [baseRows, query, mode, deptFilter, dateFilter, canFilterDates]);

  const rows = useMemo(() => {
    const list = [...filtered];
    const mul = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "date") {
        const cmp = sortDateKey(a).localeCompare(sortDateKey(b));
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
      setSortDir("desc");
    }
  };

  if (!baseRows.length) {
    return (
      <p className="text-sm text-ink-muted py-6 text-center">{emptyLabel}</p>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <VendorModelTextFilter
            query={query}
            mode={mode}
            onQueryChange={setQuery}
            onModeChange={setMode}
            matchCount={rows.length}
            totalCount={baseRows.length}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setColumnsOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-[13px] font-medium text-white/70 ring-1 ring-white/10 hover:bg-white/[0.07] hover:text-white"
              aria-expanded={columnsOpen}
            >
              <Columns3 size={13} />
              Columns
            </button>
            {columnsOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-20 cursor-default"
                  aria-label="Close columns menu"
                  onClick={() => setColumnsOpen(false)}
                />
                <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl bg-[#141c2b] p-2 ring-1 ring-white/15 shadow-xl">
                  <p className="px-1.5 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-white/40">
                    Show / hide
                  </p>
                  {ALL_METRIC_COLUMNS.map((col) => {
                    const on = columns.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-[13px] text-white/80 hover:bg-white/[0.06]"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleColumn(col.key)}
                          className="accent-sky-400"
                        />
                        {col.label}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          {canFilterDates && dateOptions.length > 0 ? (
            <SalesMultiSelectFilter
              label="dates"
              allLabel="All dates"
              options={dateOptions}
              value={dateFilter}
              onChange={setDateFilter}
              formatOption={shortIso}
              className="shrink-0"
            />
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-white/10 min-w-0">
        <div
          className={cn(
            "hidden lg:grid gap-x-3 px-3 py-2",
            TYPE_HEADER,
            "bg-white/5 border-b border-white/10 items-center min-w-0",
            DESKTOP_ROW_GRID
          )}
        >
          <span className="text-ink-muted">#</span>
          <span className="text-ink-muted">Pic</span>
          <span className="text-ink-muted">Vendor model</span>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-w-0">
            <span className="text-ink-muted">Product</span>
            {departmentOptions.length > 0 ? (
              <SalesMultiSelectFilter
                label="departments"
                allLabel="All departments"
                options={departmentOptions}
                value={deptFilter}
                onChange={setDeptFilter}
                className="shrink-0 normal-case tracking-normal font-normal"
              />
            ) : null}
          </div>
          <div className="min-w-0 overflow-hidden" style={metricsGridStyle(columns)}>
            {columns.includes("dept") && (
              <span className="text-ink-muted text-right">Dept</span>
            )}
            {columns.includes("date") && (
              <SortHeader
                label="Date"
                active={sortKey === "date"}
                dir={sortDir}
                onClick={() => toggleSort("date")}
                className="justify-end w-full"
              />
            )}
            {columns.includes("qty") && (
              <SortHeader
                label="Qty"
                active={sortKey === "qty"}
                dir={sortDir}
                onClick={() => toggleSort("qty")}
                className="justify-end w-full"
              />
            )}
            {columns.includes("revenue") && (
              <SortHeader
                label="Revenue"
                active={sortKey === "revenue"}
                dir={sortDir}
                onClick={() => toggleSort("revenue")}
                className="justify-end w-full"
              />
            )}
            {columns.includes("margin") && (
              <SortHeader
                label="Margin"
                active={sortKey === "margin"}
                dir={sortDir}
                onClick={() => toggleSort("margin")}
                className="justify-end w-full"
                title="Profit ÷ Net sales"
              />
            )}
          </div>
        </div>

        {/* Mobile: dept filter + sort chips */}
        <div className="lg:hidden flex flex-col gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.03]">
          {departmentOptions.length > 0 ? (
            <SalesMultiSelectFilter
              label="departments"
              allLabel="All departments"
              options={departmentOptions}
              value={deptFilter}
              onChange={setDeptFilter}
              className="w-full"
              fullWidth
            />
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["date", "Date"],
                ["qty", "Qty"],
                ["revenue", "Rev"],
                ["margin", "Margin"],
              ] as [SortKey, string][]
            )
              .filter(([key]) => columns.includes(key))
              .map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[13px] font-medium ring-1",
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
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted py-8 text-center px-3">
            No vendor models match this filter.
          </p>
        ) : (
          <ul className="max-h-[min(48rem,75dvh)] overflow-y-auto overflow-x-hidden overscroll-contain divide-y divide-white/5 [-webkit-overflow-scrolling:touch]">
            {rows.map((product, i) => {
              // Rozina ITEM/SPO rows: never show "ITEM · description" in the model column
              const rawModel = product.vendorModel?.trim() || "";
              const itemSplit = rawModel.match(/^ITEM\s*[·\-]\s*(.+)$/i);
              const isItemSku =
                (product.itemNumber || "").trim().toUpperCase() === "ITEM" ||
                rawModel.toUpperCase() === "ITEM" ||
                Boolean(itemSplit);
              const model = isItemSku
                ? "ITEM"
                : rawModel || product.itemNumber || "—";
              const displayName = formatProductDisplayName(
                itemSplit?.[1]?.trim() || product.name
              );
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
                    "px-3 py-3 space-y-2.5 lg:space-y-0 lg:py-2.5 lg:grid lg:gap-x-3 lg:items-start min-w-0",
                    DESKTOP_ROW_GRID
                  )}
                >
                  <div className="flex gap-3 min-w-0 lg:contents">
                    <div className="flex flex-col items-center gap-1.5 shrink-0 lg:contents">
                      <span className={cn(TYPE, "font-medium text-ink-muted tabular-nums lg:pt-1")}>
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

                    <div className="min-w-0 flex-1 lg:contents">
                      <span className={cn(TYPE, "font-mono text-cyan-300/90 tabular-nums truncate lg:pt-1 block lg:inline")}>
                        {model}
                      </span>
                      <div className="mt-0.5 lg:mt-0 lg:col-span-1 min-w-0 overflow-hidden">
                        {firstSkuExpandable ? (
                          <button
                            type="button"
                            data-sku-detail
                            onClick={toggleFirstSku}
                            className={cn(
                              "text-left font-medium leading-snug tracking-normal break-words line-clamp-2 lg:line-clamp-3 hover:text-sky-100 hover:underline underline-offset-2 decoration-sky-400/40 touch-manipulation",
                              TYPE,
                              "text-ink/95"
                            )}
                            title={`Open first SKU #${firstSku} store details`}
                            aria-expanded={openSku === firstSku}
                          >
                            {displayName}
                          </button>
                        ) : (
                          <p className={cn(TYPE, "text-ink/95 font-medium leading-snug tracking-normal break-words line-clamp-2 lg:line-clamp-3")}>
                            {displayName}
                          </p>
                        )}
                        {typeof product.onHandTotal === "number" && (
                          <VendorModelOnhandPanel
                            total={product.onHandTotal}
                            stores={product.onHandStores}
                          />
                        )}
                        <div className="hidden lg:block min-w-0">
                          {skuLines.length > 0 && (
                            <SkuStoreBreakdownList
                              lines={skuLines}
                              openSku={openSku}
                              onOpenSkuChange={(sku) =>
                                setOpenSkuByRow((prev) => ({ ...prev, [rowKey]: sku }))
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:pt-1 min-w-0">
                    <div className="lg:hidden">
                      <MetricsBlock
                        mobile
                        units={product.units}
                        revenue={product.revenue}
                        marginRate={marginRate}
                        profit={product.margin}
                        department={product.department}
                        dateLabel={formatModelDate(product)}
                        visible={columns}
                      />
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
                    <div className="hidden lg:block min-w-0 overflow-hidden">
                      <MetricsBlock
                        units={product.units}
                        revenue={product.revenue}
                        marginRate={marginRate}
                        profit={product.margin}
                        department={product.department}
                        dateLabel={formatModelDate(product)}
                        visible={columns}
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
