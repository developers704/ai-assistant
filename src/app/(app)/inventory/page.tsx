"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Search,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/layout/Sidebar";
import {
  PageShell,
  PageShellHeader,
  PageShellBody,
  LushTabBar,
  LushMetric,
  LushEmpty,
} from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatPieceCount, cn } from "@/lib/utils";
import { SalesDateRangePicker, type SalesDateRangeValue } from "@/components/sales/SalesDateRangePicker";
import { SalesMultiSelectFilter } from "@/components/sales/SalesMultiSelectFilter";
import { appendSalesFilterParams } from "@/lib/sales/filter-params";

type View = "transfers" | "stock";
type Dir = "asc" | "desc";

type TransferRow = {
  vendorModel: string;
  sku: string;
  vendor: string;
  description: string;
  department: string;
  design: string;
  productClass: string;
  subClass: string;
  tagPrice: number;
  costPrice: number;
  toStore: string;
  toDm: string;
  toTier: string;
  toKind: string;
  soldQty: number;
  revenue: number;
  onhand: number;
  fromStore: string;
  fromDm: string;
  fromTier: string;
  fromKind: string;
  fromOnhand: number;
  fromSoldQty: number;
  fromRevenue: number;
};

type StockRow = {
  store: string;
  dm: string;
  tier: string;
  kind: string;
  vendorModel: string;
  sku: string;
  vendor: string;
  description: string;
  department: string;
  design: string;
  productClass: string;
  subClass: string;
  tagPrice: number;
  costPrice: number;
  onhand: number;
  soldQty: number;
  revenue: number;
  coverage: number | null;
};

type ModelStoreRow = {
  store: string;
  dm: string;
  tier: string;
  kind: string;
  onhand: number;
  soldQty: number;
};

type Payload = {
  view: View;
  rows: Array<TransferRow | StockRow>;
  total: number;
  dateFrom: string;
  dateTo: string;
  showCost: boolean;
  costLabel: string;
  available: {
    stores: string[];
    departments: string[];
    designs: string[];
    classes: string[];
    subclasses: string[];
    vendors: string[];
  };
};

const TRANSFER_SORTS: { id: string; label: string }[] = [
  { id: "fromSoldQty", label: "Sold qty" },
  { id: "fromOnhand", label: "On hand" },
  { id: "fromRevenue", label: "Sold revenue" },
  { id: "tagPrice", label: "Tag" },
  { id: "costPrice", label: "Cost" },
  { id: "vendorModel", label: "Vendor model" },
  { id: "fromStore", label: "From store" },
  { id: "toStore", label: "To store" },
];

const STOCK_SORTS: { id: string; label: string }[] = [
  { id: "onhand", label: "On hand" },
  { id: "tagPrice", label: "Tag" },
  { id: "costPrice", label: "Cost" },
  { id: "vendorModel", label: "Vendor model" },
  { id: "store", label: "Store" },
];

function money(n: number): string {
  return formatCurrency(n);
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00.000Z`);
  const end = new Date(`${to}T12:00:00.000Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function StoreBadge({ tier, kind }: { tier: string; kind?: string }) {
  if (kind === "main") return null;
  if (kind === "new") {
    return (
      <span className="rounded-full bg-fuchsia-400/20 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-fuchsia-100 ring-1 ring-fuchsia-400/30">
        New
      </span>
    );
  }
  if (tier !== "A") return null;
  return (
    <span className="rounded-full bg-emerald-400/20 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-100 ring-1 ring-emerald-400/30">
      A
    </span>
  );
}

function QtyChip({
  n,
  tone,
  label,
}: {
  n: number;
  tone: "need" | "sold" | "stock";
  label?: string;
}) {
  const zero = n <= 0;
  const cls =
    tone === "need"
      ? zero
        ? "bg-rose-500/20 text-rose-100 ring-rose-400/35"
        : "bg-amber-400/15 text-amber-50 ring-amber-400/25"
      : tone === "stock"
        ? "bg-emerald-500/15 text-emerald-50 ring-emerald-400/30"
        : "bg-white/[0.06] text-white/75 ring-white/10";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-baseline gap-1 rounded-lg px-2 py-0.5 text-[12px] font-semibold tabular-nums ring-1",
        cls
      )}
    >
      {label ? <span className="text-[9px] font-medium uppercase tracking-wide opacity-60">{label}</span> : null}
      {formatPieceCount(n)}
    </span>
  );
}

function StoreLane({
  label,
  store,
  tier,
  kind,
  onhand,
  sold,
  tone,
}: {
  label: string;
  store: string;
  tier: string;
  kind: string;
  onhand: number;
  sold: number;
  tone: "need" | "stock";
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl px-3 py-2.5 ring-1",
        tone === "need"
          ? "bg-rose-500/[0.08] ring-rose-400/20"
          : "bg-emerald-500/[0.08] ring-emerald-400/20"
      )}
    >
      <div
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.14em]",
          tone === "need" ? "text-rose-200/70" : "text-emerald-200/70"
        )}
      >
        {label}
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
        <span className="truncate font-semibold text-white/90">{store}</span>
        <StoreBadge tier={tier} kind={kind} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <QtyChip n={onhand} tone={tone === "need" ? "need" : "stock"} label="OH" />
        <QtyChip n={sold} tone="sold" label="Sold" />
      </div>
    </div>
  );
}

function StoreBreakdown({
  rows,
  highlightTo,
  highlightFrom,
}: {
  rows: ModelStoreRow[] | "loading" | "error" | undefined;
  highlightTo?: string;
  highlightFrom?: string;
}) {
  const toMark = (highlightTo ?? "").toUpperCase();
  const fromMark = (highlightFrom ?? "").toUpperCase();

  if (rows === "loading" || rows == null) {
    return <div className="px-4 py-3 text-sm text-white/40">Loading every store for this model…</div>;
  }
  if (rows === "error") {
    return <div className="px-4 py-3 text-sm text-rose-300">Could not load stores.</div>;
  }
  if (rows.length === 0) {
    return <div className="px-4 py-3 text-sm text-white/40">No other store stock for this vendor model.</div>;
  }

  const maxOh = Math.max(1, ...rows.map((s) => s.onhand));

  return (
    <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((s) => {
        const key = s.store.toUpperCase();
        const isTo = key === toMark;
        const isFrom = key === fromMark;
        const isMain = s.kind === "main";
        return (
          <div
            key={s.store}
            className={cn(
              "rounded-xl px-3 py-2.5 ring-1 transition-colors",
              isTo && "bg-rose-500/12 ring-rose-400/40",
              isFrom && "bg-emerald-500/12 ring-emerald-400/40",
              isMain && !isTo && !isFrom && "bg-sky-500/[0.08] ring-sky-400/25",
              !isTo && !isFrom && !isMain && "bg-white/[0.03] ring-white/[0.08]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-white/90">
                <span className="truncate">{s.store}</span>
                <StoreBadge tier={s.tier} kind={s.kind} />
              </span>
              {isTo ? (
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-rose-200">Need</span>
              ) : isFrom ? (
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-emerald-200">Donor</span>
              ) : isMain ? (
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-sky-200">Warehouse</span>
              ) : null}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full",
                  isMain ? "bg-sky-400/80" : isTo ? "bg-rose-400/80" : isFrom ? "bg-emerald-400/80" : "bg-amber-400/70"
                )}
                style={{ width: `${s.onhand <= 0 ? 0 : Math.max(6, (s.onhand / maxOh) * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[12px] tabular-nums text-white/70">
              <span>{formatPieceCount(s.onhand)}</span>
              <span>{s.kind === "main" ? "—" : formatPieceCount(s.soldQty)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InventoryPage() {
  const [view, setView] = useState<View>("transfers");
  const [dateRange, setDateRange] = useState<SalesDateRangeValue>({
    from: "2025-01-01",
    to: "2026-09-14",
  });
  const [stores, setStores] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [designs, setDesigns] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [subclasses, setSubclasses] = useState<string[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [sort, setSort] = useState("fromSoldQty");
  const [dir, setDir] = useState<Dir>("desc");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [breakdowns, setBreakdowns] = useState<Record<string, ModelStoreRow[] | "loading" | "error">>({});
  const limit = 50;

  const available = data?.available ?? {
    stores: [],
    departments: [],
    designs: [],
    classes: [],
    subclasses: [],
    vendors: [],
  };

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("from", dateRange.from);
    params.set("to", dateRange.to);
    params.set("view", view);
    params.set("sort", sort);
    params.set("dir", dir);
    params.set("offset", String(offset));
    params.set("limit", String(limit));
    if (q) params.set("q", q);
    appendSalesFilterParams(params, {
      stores,
      departments,
      designs,
      vendors,
      classes,
      subclasses,
    });
    fetch(`/api/inventory-mgmt?${params}`, { signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json()) as Payload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load inventory");
        setData(json);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load inventory");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [dateRange.from, dateRange.to, view, sort, dir, offset, q, stores, departments, designs, vendors, classes, subclasses]);

  useEffect(() => {
    setExpandedKey(null);
    setBreakdowns({});
  }, [dateRange.from, dateRange.to, view]);

  function toggleRow(rowKey: string, model: string) {
    if (expandedKey === rowKey) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(rowKey);
    if (breakdowns[model]) return;
    setBreakdowns((prev) => ({ ...prev, [model]: "loading" }));
    const params = new URLSearchParams();
    params.set("from", dateRange.from);
    params.set("to", dateRange.to);
    params.set("view", "model");
    params.set("model", model);
    fetch(`/api/inventory-mgmt?${params}`)
      .then(async (res) => {
        const json = (await res.json()) as { stores?: ModelStoreRow[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Failed");
        setBreakdowns((prev) => ({ ...prev, [model]: json.stores ?? [] }));
      })
      .catch(() => {
        setBreakdowns((prev) => ({ ...prev, [model]: "error" }));
      });
  }

  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  const header = useMemo(
    () =>
      view === "transfers"
        ? "Move slow surplus into stores that are out. Keep 1 at every selling store."
        : "On-hand across selling stores plus MAIN warehouse. MAIN never transfers.",
    [view]
  );

  const transferRows = view === "transfers" ? ((data?.rows ?? []) as TransferRow[]) : [];
  const stockRows = view === "stock" ? ((data?.rows ?? []) as StockRow[]) : [];
  const pageOut = transferRows.filter((r) => r.onhand <= 0).length;

  return (
    <PageShell accent="amber">
      <PageShellHeader>
        <PageHeader gradient eyebrow="Inventory" title="Inventory" subtitle={header} />
      </PageShellHeader>
      <PageShellBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LushTabBar
            tabs={[
              { id: "transfers", label: "Transfers", icon: ArrowLeftRight, color: "text-amber-300" },
              { id: "stock", label: "All on-hand", icon: Warehouse, color: "text-sky-300" },
            ]}
            active={view}
            onChange={(id) => {
              if (id === "transfers") {
                setView("transfers");
                setOffset(0);
                setSort("fromSoldQty");
                setStores((s) => s.filter((x) => x.toUpperCase() !== "MAIN"));
              } else {
                setView("stock");
                setOffset(0);
                setSort("onhand");
              }
            }}
          />
          <SalesDateRangePicker
            availableDates={datesBetween("2025-01-01", "2026-09-14")}
            reportRange={{ from: "2025-01-01", to: "2026-09-14" }}
            value={dateRange}
            onChange={(next) => {
              if (!next) return;
              setDateRange(next);
              setOffset(0);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <LushMetric
            label={view === "transfers" ? "Transfer needs" : "On-hand rows"}
            value={data ? data.total.toLocaleString() : "—"}
            accent="amber"
            footer={loading ? <span className="text-white/35">Updating…</span> : <span className="text-white/40">Matching filters</span>}
          />
          {view === "transfers" ? (
            <LushMetric
              label="Out of stock on this page"
              value={data ? String(pageOut) : "—"}
              accent="default"
              footer={<span className="text-rose-200/70">0 pcs at the To store</span>}
            />
          ) : (
            <LushMetric
              label="Showing"
              value={`${Math.min(limit, data?.rows.length ?? 0)}`}
              accent="sky"
              footer={<span className="text-white/40">This page</span>}
            />
          )}
          <LushMetric
            label="Page"
            value={`${page} / ${pages}`}
            footer={<span className="text-white/40">{limit} per page</span>}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/[0.03] p-2.5 ring-1 ring-white/[0.07]">
          <SalesMultiSelectFilter label="Store" allLabel="All stores" options={available.stores} value={stores} onChange={(v) => { setStores(v); setOffset(0); }} />
          <SalesMultiSelectFilter label="Department" allLabel="All departments" options={available.departments} value={departments} onChange={(v) => { setDepartments(v); setOffset(0); }} />
          <SalesMultiSelectFilter label="Design" allLabel="All designs" options={available.designs} value={designs} onChange={(v) => { setDesigns(v); setOffset(0); }} />
          <SalesMultiSelectFilter label="Class" allLabel="All classes" options={available.classes} value={classes} onChange={(v) => { setClasses(v); setOffset(0); }} />
          <SalesMultiSelectFilter label="Subclass" allLabel="All subclasses" options={available.subclasses} value={subclasses} onChange={(v) => { setSubclasses(v); setOffset(0); }} />
          <SalesMultiSelectFilter label="Vendor #" allLabel="All vendors" options={available.vendors} value={vendors} onChange={(v) => { setVendors(v); setOffset(0); }} />
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(qDraft.trim());
              setOffset(0);
            }}
          >
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="Vendor model or SKU"
                className="h-9 w-48 rounded-xl bg-white/5 pl-8 pr-3 text-sm text-ink ring-1 ring-white/10 placeholder:text-white/30"
              />
            </div>
          </form>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setOffset(0); }}
            className="h-9 rounded-xl bg-white/5 px-2 text-sm text-ink ring-1 ring-white/10"
          >
            {(view === "transfers" ? TRANSFER_SORTS : STOCK_SORTS).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}>
            <ArrowUpDown size={13} />
            {dir === "asc" ? "Asc" : "Desc"}
          </Button>
        </div>

        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[5.5rem] animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.06]" />
            ))}
          </div>
        ) : error ? (
          <LushEmpty message={error} icon={Package} />
        ) : data && data.rows.length === 0 ? (
          <LushEmpty message="No rows for this filter." icon={Package} />
        ) : view === "transfers" ? (
          <div className={cn("space-y-2", loading && "opacity-60")}>
            <div className="hidden px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 xl:grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.55fr)_8.5rem] xl:gap-3">
              <span>Vendor model</span>
              <span>Need → donor</span>
              <span className="text-right">Value</span>
            </div>
            {transferRows.map((r, i) => {
              const rowKey = `${r.vendorModel}-${r.toStore}-${r.fromStore}-${i}`;
              const open = expandedKey === rowKey;
              return (
                <div
                  key={rowKey}
                  className={cn(
                    "overflow-hidden rounded-2xl ring-1 transition-all duration-200",
                    open
                      ? "bg-amber-400/[0.06] ring-amber-400/25 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]"
                      : "bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.05] hover:ring-white/15"
                  )}
                >
                  <button
                    type="button"
                    className="grid w-full grid-cols-1 items-center gap-3 px-3 py-3 text-left sm:px-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.55fr)_8.5rem]"
                    onClick={() => toggleRow(rowKey, r.vendorModel)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <ChevronDown
                          size={14}
                          className={cn("shrink-0 text-white/35 transition-transform duration-200", open && "rotate-180 text-amber-200")}
                        />
                        <span className="truncate font-semibold tracking-tight text-white">{r.vendorModel}</span>
                      </div>
                      <div className="mt-0.5 truncate pl-5 text-[12px] text-white/55">{r.description || "—"}</div>
                      <div className="truncate pl-5 text-[11px] text-white/35">
                        {r.sku}
                        {r.vendor ? ` · ${r.vendor}` : ""}
                        {r.department ? ` · ${r.department}` : ""}
                      </div>
                    </div>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <StoreLane
                        label="Need"
                        store={r.toStore}
                        tier={r.toTier}
                        kind={r.toKind}
                        onhand={r.onhand}
                        sold={r.soldQty}
                        tone="need"
                      />
                      <ArrowRight size={16} className="shrink-0 text-white/25" />
                      <StoreLane
                        label="From"
                        store={r.fromStore}
                        tier={r.fromTier}
                        kind={r.fromKind}
                        onhand={r.fromOnhand}
                        sold={r.fromSoldQty}
                        tone="stock"
                      />
                    </div>
                    <div className="flex gap-4 text-[12px] xl:flex-col xl:items-end xl:gap-0.5">
                      <div className="font-metric-num text-white/90">{money(r.tagPrice)}</div>
                      <div className="text-white/45">{data?.costLabel ?? "Cost"} {money(r.costPrice)}</div>
                      <div className="text-amber-200/80">{money(r.revenue)}</div>
                    </div>
                  </button>
                  {open ? (
                    <div className="border-t border-white/[0.06] bg-black/20">
                      <StoreBreakdown
                        rows={breakdowns[r.vendorModel]}
                        highlightTo={r.toStore}
                        highlightFrom={r.fromStore}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={cn("space-y-2", loading && "opacity-60")}>
            {stockRows.map((r, i) => {
              const rowKey = `${r.store}-${r.sku}-${i}`;
              const open = expandedKey === rowKey;
              return (
                <div
                  key={rowKey}
                  className={cn(
                    "overflow-hidden rounded-2xl ring-1 transition-all duration-200",
                    open
                      ? "bg-sky-400/[0.06] ring-sky-400/25"
                      : "bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.05] hover:ring-white/15"
                  )}
                >
                  <button
                    type="button"
                    className="grid w-full grid-cols-1 items-center gap-3 px-3 py-3 text-left sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:px-4"
                    onClick={() => toggleRow(rowKey, r.vendorModel)}
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronDown
                        size={14}
                        className={cn("shrink-0 text-white/35 transition-transform duration-200", open && "rotate-180 text-sky-200")}
                      />
                      <span className="font-semibold text-white/90">{r.store}</span>
                      <StoreBadge tier={r.tier} kind={r.kind} />
                    </div>
                    <div className="min-w-0 sm:pl-0">
                      <div className="truncate font-semibold text-white">{r.vendorModel}</div>
                      <div className="truncate text-[12px] text-white/55">{r.description || "—"}</div>
                      <div className="truncate text-[11px] text-white/35">
                        {r.sku}
                        {r.vendor ? ` · ${r.vendor}` : ""}
                        {[r.department, r.design].filter(Boolean).length
                          ? ` · ${[r.department, r.design].filter(Boolean).join(" · ")}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                      <QtyChip n={r.onhand} tone="stock" label="OH" />
                      <div className="text-[12px] text-white/50">
                        {money(r.tagPrice)} · {money(r.costPrice)}
                      </div>
                    </div>
                  </button>
                  {open ? (
                    <div className="border-t border-white/[0.06] bg-black/20">
                      <StoreBreakdown rows={breakdowns[r.vendorModel]} highlightTo={r.store} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-white/60">
          <div className="flex items-center gap-2">
            <Package size={14} />
            {data ? `${data.total.toLocaleString()} rows` : "—"}
            {loading ? <span className="text-white/35">updating…</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={offset <= 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
              <ChevronLeft size={14} />
            </Button>
            <span>Page {page} / {pages}</span>
            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setOffset(offset + limit)}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </PageShellBody>
    </PageShell>
  );
}
