"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Package, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/Sidebar";
import { PageShell, PageShellHeader, PageShellBody } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";
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
  priority: "rush" | "high" | "fill";
  priorityRank: number;
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
  availableDates?: string[];
  reportRange?: { from: string; to: string };
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
  { id: "priorityRank", label: "Priority" },
  { id: "fromSoldQty", label: "Sold qty" },
  { id: "fromOnhand", label: "On hand" },
  { id: "fromRevenue", label: "Sold revenue" },
  { id: "tagPrice", label: "Tag" },
  { id: "costPrice", label: "Cost" },
  { id: "vendorModel", label: "Vendor model" },
  { id: "fromStore", label: "From store" },
  { id: "toStore", label: "Need store" },
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

const FALLBACK_RANGE = { from: "2025-01-01", to: "2026-09-16" };
const FALLBACK_DATES = datesBetween(FALLBACK_RANGE.from, FALLBACK_RANGE.to);

function QtyBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-md bg-amber-400/20 px-2 py-0.5 font-semibold tabular-nums text-amber-100 ring-1 ring-amber-400/20">
      {formatPieceCount(n)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "rush" | "high" | "fill" }) {
  const meta = {
    rush: {
      label: "Rush",
      title: "Empty and selling — move today",
      className: "bg-rose-500/20 text-rose-100 ring-rose-400/35",
    },
    high: {
      label: "High",
      title: "A / New store running thin — move soon",
      className: "bg-amber-400/20 text-amber-100 ring-amber-400/30",
    },
    fill: {
      label: "Fill",
      title: "Restock when Rush and High are done",
      className: "bg-white/10 text-white/70 ring-white/15",
    },
  }[priority];
  return (
    <span title={meta.title} className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1", meta.className)}>
      {meta.label}
    </span>
  );
}

function StoreBadge({ tier, kind }: { tier: string; kind?: string }) {
  if (kind === "main") return null;
  if (kind === "new") {
    return (
      <span className="rounded-full bg-fuchsia-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-200">
        New
      </span>
    );
  }
  if (tier !== "A") return null;
  return <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">A</span>;
}

function StoreName({
  store,
  tier,
  kind,
  tone,
}: {
  store: string;
  tier: string;
  kind: string;
  tone?: "need" | "from";
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={cn(
          "truncate font-semibold",
          tone === "need" && "text-rose-200",
          tone === "from" && "text-emerald-200"
        )}
      >
        {store}
      </span>
      <StoreBadge tier={tier} kind={kind} />
    </span>
  );
}

function StoreBreakdownBody({
  rows,
  highlightTo,
  highlightFrom,
}: {
  rows: ModelStoreRow[] | "loading" | "error" | undefined;
  highlightTo?: string;
  highlightFrom?: string;
}) {
  const need = (highlightTo ?? "").toUpperCase();
  const from = (highlightFrom ?? "").toUpperCase();
  if (rows === "loading" || rows == null) {
    return <div className="py-2 text-white/40">Loading stores…</div>;
  }
  if (rows === "error") {
    return <div className="py-2 text-rose-300">Could not load stores.</div>;
  }
  if (rows.length === 0) {
    return <div className="py-2 text-white/40">No other store stock for this vendor model.</div>;
  }
  return (
    <div className="w-full max-w-xl overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4rem] gap-x-2 text-[10px] uppercase tracking-wide text-white/35">
        <div className="py-1">Store</div>
        <div className="py-1">Onhand</div>
        <div className="py-1">Sold</div>
      </div>
      {rows.map((s) => {
        const key = s.store.toUpperCase();
        const isNeed = key === need;
        const isFrom = key === from;
        return (
          <div
            key={s.store}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_4.5rem_4rem] gap-x-2 rounded-md px-1.5 py-0.5 text-[12px]",
              isNeed && "bg-rose-500/15 text-rose-100",
              isFrom && "bg-emerald-500/15 text-emerald-100"
            )}
          >
            <div className="min-w-0 truncate">
              <span className="inline-flex max-w-full items-center gap-1.5">
                <span className="truncate">{s.store}</span>
                <StoreBadge tier={s.tier} kind={s.kind} />
              </span>
            </div>
            <div className="tabular-nums">{formatPieceCount(s.onhand)}</div>
            <div className="tabular-nums">{s.kind === "main" ? "—" : formatPieceCount(s.soldQty)}</div>
          </div>
        );
      })}
    </div>
  );
}

function StoreBreakdown({
  colSpan,
  rows,
  highlightTo,
  highlightFrom,
}: {
  colSpan: number;
  rows: ModelStoreRow[] | "loading" | "error" | undefined;
  highlightTo?: string;
  highlightFrom?: string;
}) {
  return (
    <tr className="border-t border-white/[0.06] bg-white/[0.02]">
      <td colSpan={colSpan} className="px-4 py-2">
        <StoreBreakdownBody rows={rows} highlightTo={highlightTo} highlightFrom={highlightFrom} />
      </td>
    </tr>
  );
}

function TransferMobileCard({
  row,
  open,
  costLabel,
  breakdown,
  onToggle,
}: {
  row: TransferRow;
  open: boolean;
  costLabel: string;
  breakdown: ModelStoreRow[] | "loading" | "error" | undefined;
  onToggle: () => void;
}) {
  return (
    <li className="border-t border-white/[0.06] first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full min-w-0 px-3 py-3 text-left transition-colors hover:bg-white/[0.04]",
          open && "bg-white/[0.04]"
        )}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <ChevronDown
            size={14}
            className={cn("mt-1 shrink-0 text-white/40 transition-transform", open && "rotate-180")}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="break-all font-semibold text-ink">{row.vendorModel}</div>
                <div className="break-all text-[12px] text-white/45">
                  {row.sku}
                  {row.vendor ? ` · ${row.vendor}` : ""}
                </div>
              </div>
              <PriorityBadge priority={row.priority ?? "fill"} />
            </div>
            <div className="min-w-0">
              <div className="whitespace-normal break-words text-[13px] text-ink">{row.description || "—"}</div>
              <div className="whitespace-normal break-words text-[12px] text-white/45">{row.department || "—"}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-lg bg-rose-500/[0.10] px-2.5 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-200/80">Need</div>
                <StoreName store={row.toStore} tier={row.toTier} kind={row.toKind} tone="need" />
                <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-[11px] text-white/50">
                  <dt>Oh</dt>
                  <dd className="min-w-0 justify-self-end">
                    <QtyBadge n={row.onhand} />
                  </dd>
                  <dt>Sold</dt>
                  <dd className="min-w-0 justify-self-end">
                    <QtyBadge n={row.soldQty} />
                  </dd>
                </dl>
              </div>
              <div className="min-w-0 rounded-lg bg-emerald-500/[0.10] px-2.5 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/80">From</div>
                <StoreName store={row.fromStore} tier={row.fromTier} kind={row.fromKind} tone="from" />
                <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-[11px] text-white/50">
                  <dt>Oh</dt>
                  <dd className="min-w-0 justify-self-end">
                    <QtyBadge n={row.fromOnhand} />
                  </dd>
                  <dt>Sold</dt>
                  <dd className="min-w-0 justify-self-end">
                    <QtyBadge n={row.fromSoldQty} />
                  </dd>
                </dl>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] tabular-nums text-white/70">
              <span>Tag {money(row.tagPrice)}</span>
              <span>
                {costLabel} {money(row.costPrice)}
              </span>
              <span>Rev {money(row.revenue)}</span>
            </div>
          </div>
        </div>
      </button>
      {open ? (
        <div className="px-3 pb-3">
          <StoreBreakdownBody rows={breakdown} highlightTo={row.toStore} highlightFrom={row.fromStore} />
        </div>
      ) : null}
    </li>
  );
}

function StockMobileCard({
  row,
  open,
  costLabel,
  breakdown,
  onToggle,
}: {
  row: StockRow;
  open: boolean;
  costLabel: string;
  breakdown: ModelStoreRow[] | "loading" | "error" | undefined;
  onToggle: () => void;
}) {
  return (
    <li className="border-t border-white/[0.06] first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full min-w-0 px-3 py-3 text-left transition-colors hover:bg-white/[0.04]",
          open && "bg-white/[0.04]"
        )}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <ChevronDown
            size={14}
            className={cn("mt-1 shrink-0 text-white/40 transition-transform", open && "rotate-180")}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-ink">{row.store}</span>
              <StoreBadge tier={row.tier} kind={row.kind} />
            </div>
            <div className="min-w-0">
              <div className="break-all font-semibold text-ink">{row.vendorModel}</div>
              <div className="break-all text-[12px] text-white/45">
                {row.sku}
                {row.vendor ? ` · ${row.vendor}` : ""}
              </div>
            </div>
            <div className="min-w-0">
              <div className="whitespace-normal break-words text-[13px] text-ink">{row.description || "—"}</div>
              <div className="whitespace-normal break-words text-[12px] text-white/45">
                {[row.department, row.design, row.productClass].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="text-white/50">
                On hand <span className="font-semibold tabular-nums text-ink">{formatPieceCount(row.onhand)}</span>
              </span>
              <span className="tabular-nums text-white/70">
                Tag {money(row.tagPrice)} · {costLabel} {money(row.costPrice)}
              </span>
            </div>
          </div>
        </div>
      </button>
      {open ? (
        <div className="px-3 pb-3">
          <StoreBreakdownBody rows={breakdown} highlightTo={row.store} />
        </div>
      ) : null}
    </li>
  );
}

export default function InventoryPage() {
  const [view, setView] = useState<View>("transfers");
  const [dateRange, setDateRange] = useState<SalesDateRangeValue>(FALLBACK_RANGE);
  const [reportRange, setReportRange] = useState(FALLBACK_RANGE);
  const [availableDates, setAvailableDates] = useState<string[]>(FALLBACK_DATES);
  const [stores, setStores] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [designs, setDesigns] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [subclasses, setSubclasses] = useState<string[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [sort, setSort] = useState("priorityRank");
  const [dir, setDir] = useState<Dir>("asc");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [breakdowns, setBreakdowns] = useState<Record<string, ModelStoreRow[] | "loading" | "error">>({});
  const limit = 50;

  // Live search: model / SKU / description (debounced)
  useEffect(() => {
    const next = qDraft.trim();
    const t = window.setTimeout(() => {
      setQ((prev) => (prev === next ? prev : next));
    }, 250);
    return () => window.clearTimeout(t);
  }, [qDraft]);

  useEffect(() => {
    setOffset(0);
  }, [q]);

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
        if (json.availableDates?.length) setAvailableDates(json.availableDates);
        if (json.reportRange?.from && json.reportRange?.to) setReportRange(json.reportRange);
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
  const ready = Boolean(data && data.view === view);

  const header = useMemo(
    () =>
      view === "transfers"
        ? "Transfer needs — keep 1 at every selling store, slow surplus only."
        : "On-hand including MAIN warehouse. MAIN never transfers.",
    [view]
  );

  return (
    <PageShell accent="amber" className="min-w-0">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Inventory"
          title="Inventory"
          subtitle={header}
        />
      </PageShellHeader>
      <PageShellBody className="min-w-0 space-y-4 overflow-x-hidden">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <Button size="sm" variant={view === "transfers" ? "primary" : "ghost"} onClick={() => { setView("transfers"); setOffset(0); setSort("priorityRank"); setDir("asc"); setStores((s) => s.filter((x) => x.toUpperCase() !== "MAIN")); }}>
              Transfers
            </Button>
            <Button size="sm" variant={view === "stock" ? "primary" : "ghost"} onClick={() => { setView("stock"); setOffset(0); setSort("onhand"); setDir("desc"); }}>
              All on-hand
            </Button>
          </div>
          <div className="min-w-0 max-w-full">
            <SalesDateRangePicker
              availableDates={availableDates}
              reportRange={reportRange}
              value={dateRange}
              onChange={(next) => {
                if (!next) return;
                setDateRange(next);
                setOffset(0);
              }}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center">
          <div className="grid min-w-0 grid-cols-2 gap-2 xl:contents">
            <SalesMultiSelectFilter fullWidth className="min-w-0 w-full xl:w-fit xl:min-w-[8.75rem]" label="Store" allLabel="All stores" options={available.stores} value={stores} onChange={(v) => { setStores(v); setOffset(0); }} />
            <SalesMultiSelectFilter fullWidth className="min-w-0 w-full xl:w-fit xl:min-w-[8.75rem]" label="Department" allLabel="All departments" options={available.departments} value={departments} onChange={(v) => { setDepartments(v); setOffset(0); }} />
            <SalesMultiSelectFilter fullWidth className="min-w-0 w-full xl:w-fit xl:min-w-[8.75rem]" label="Design" allLabel="All designs" options={available.designs} value={designs} onChange={(v) => { setDesigns(v); setOffset(0); }} />
            <SalesMultiSelectFilter fullWidth className="min-w-0 w-full xl:w-fit xl:min-w-[8.75rem]" label="Class" allLabel="All classes" options={available.classes} value={classes} onChange={(v) => { setClasses(v); setOffset(0); }} />
            <SalesMultiSelectFilter fullWidth className="min-w-0 w-full xl:w-fit xl:min-w-[8.75rem]" label="Subclass" allLabel="All subclasses" options={available.subclasses} value={subclasses} onChange={(v) => { setSubclasses(v); setOffset(0); }} />
            <SalesMultiSelectFilter fullWidth className="min-w-0 w-full xl:w-fit xl:min-w-[8.75rem]" label="Vendor #" allLabel="All vendors" options={available.vendors} value={vendors} onChange={(v) => { setVendors(v); setOffset(0); }} />
          </div>
          <form
            className="min-w-0 w-full xl:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              const next = qDraft.trim();
              setQ(next);
              setOffset(0);
            }}
          >
            <div className="relative min-w-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="Model, SKU, or description"
                title="Search vendor model, SKU, or description (e.g. cuban chain)"
                className="h-9 w-full min-w-0 rounded-xl bg-white/5 pl-8 pr-3 text-sm text-ink ring-1 ring-white/10 placeholder:text-white/30 xl:w-72"
              />
            </div>
          </form>
          <div className="flex min-w-0 items-center gap-2">
            <select
              value={sort}
              onChange={(e) => {
                const id = e.target.value;
                setSort(id);
                setDir(id === "priorityRank" || id === "vendorModel" || id === "fromStore" || id === "toStore" ? "asc" : "desc");
                setOffset(0);
              }}
              className="h-9 min-w-0 flex-1 rounded-xl bg-white/5 px-2 text-sm text-ink ring-1 ring-white/10 xl:flex-none"
            >
              {(view === "transfers" ? TRANSFER_SORTS : STOCK_SORTS).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {dir === "asc" ? "Asc" : "Desc"}
            </Button>
          </div>
        </div>

        <Card className="min-w-0 overflow-hidden p-0">
          {loading && !ready ? (
            <div className="p-8 text-center text-ink-muted">Loading inventory…</div>
          ) : error ? (
            <div className="p-8 text-center text-rose-300">{error}</div>
          ) : view === "transfers" ? (
            <>
              <ul className="lg:hidden">
                {(data?.rows as TransferRow[]).map((r, i) => {
                  const rowKey = `${r.vendorModel}-${r.toStore}-${r.fromStore}-${i}`;
                  return (
                    <TransferMobileCard
                      key={rowKey}
                      row={r}
                      open={expandedKey === rowKey}
                      costLabel={data?.costLabel ?? "Cost"}
                      breakdown={breakdowns[r.vendorModel]}
                      onToggle={() => toggleRow(rowKey, r.vendorModel)}
                    />
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Vendor model</th>
                  <th className="px-3 py-2">Description / department</th>
                  <th className="whitespace-nowrap px-3 py-2">Onhand</th>
                  <th className="whitespace-nowrap px-3 py-2">Sold</th>
                  <th className="whitespace-nowrap px-3 py-2 text-rose-200/80">Need</th>
                  <th className="whitespace-nowrap px-3 py-2">Onhand</th>
                  <th className="whitespace-nowrap px-3 py-2">Sold</th>
                  <th className="whitespace-nowrap px-3 py-2 text-emerald-200/80">From</th>
                  <th className="px-3 py-2">Tag price</th>
                  <th className="px-3 py-2">{data?.costLabel ?? "Cost price"}</th>
                  <th className="px-3 py-2">Sold revenue</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows as TransferRow[]).map((r, i) => {
                  const rowKey = `${r.vendorModel}-${r.toStore}-${r.fromStore}-${i}`;
                  const open = expandedKey === rowKey;
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className={cn(
                          "cursor-pointer border-t border-white/[0.06] transition-colors hover:bg-white/[0.04]",
                          open && "bg-white/[0.04]"
                        )}
                        onClick={() => toggleRow(rowKey, r.vendorModel)}
                      >
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <PriorityBadge priority={r.priority ?? "fill"} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1.5 font-semibold text-ink">
                        <ChevronDown size={14} className={cn("shrink-0 text-white/40 transition-transform", open && "rotate-180")} />
                        {r.vendorModel}
                      </div>
                      <div className="pl-5 text-white/45">{r.sku}{r.vendor ? ` · ${r.vendor}` : ""}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-ink">{r.description || "—"}</div>
                      <div className="text-white/45">{r.department || "—"}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <QtyBadge n={r.onhand} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <QtyBadge n={r.soldQty} />
                    </td>
                    <td className="whitespace-nowrap bg-rose-500/[0.10] px-3 py-2 align-middle">
                      <StoreName store={r.toStore} tier={r.toTier} kind={r.toKind} tone="need" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <QtyBadge n={r.fromOnhand} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <QtyBadge n={r.fromSoldQty} />
                    </td>
                    <td className="whitespace-nowrap bg-emerald-500/[0.10] px-3 py-2 align-middle">
                      <StoreName store={r.fromStore} tier={r.fromTier} kind={r.fromKind} tone="from" />
                    </td>
                    <td className="px-3 py-2 align-top tabular-nums">{money(r.tagPrice)}</td>
                    <td className="px-3 py-2 align-top tabular-nums">{money(r.costPrice)}</td>
                    <td className="px-3 py-2 align-top tabular-nums">{money(r.revenue)}</td>
                      </tr>
                      {open ? (
                        <StoreBreakdown
                          colSpan={12}
                          rows={breakdowns[r.vendorModel]}
                          highlightTo={r.toStore}
                          highlightFrom={r.fromStore}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
              </div>
            </>
          ) : (
            <>
              <ul className="lg:hidden">
                {(data?.rows as StockRow[]).map((r, i) => {
                  const rowKey = `${r.store}-${r.sku}-${i}`;
                  return (
                    <StockMobileCard
                      key={rowKey}
                      row={r}
                      open={expandedKey === rowKey}
                      costLabel={data?.costLabel ?? "Cost"}
                      breakdown={breakdowns[r.vendorModel]}
                      onToggle={() => toggleRow(rowKey, r.vendorModel)}
                    />
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-3 py-2">Store</th>
                  <th className="px-3 py-2">Vendor model / SKU</th>
                  <th className="px-3 py-2">Description / department</th>
                  <th className="px-3 py-2">On hand</th>
                  <th className="px-3 py-2">Tag / {data?.costLabel ?? "Cost"}</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows as StockRow[]).map((r, i) => {
                  const rowKey = `${r.store}-${r.sku}-${i}`;
                  const open = expandedKey === rowKey;
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className={cn(
                          "cursor-pointer border-t border-white/[0.06] transition-colors hover:bg-white/[0.04]",
                          open && "bg-white/[0.04]"
                        )}
                        onClick={() => toggleRow(rowKey, r.vendorModel)}
                      >
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1.5">
                        <ChevronDown size={14} className={cn("shrink-0 text-white/40 transition-transform", open && "rotate-180")} />
                        <span>{r.store}</span>
                        <StoreBadge tier={r.tier} kind={r.kind} />
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold text-ink">{r.vendorModel}</div>
                      <div className="text-white/45">{r.sku}{r.vendor ? ` · ${r.vendor}` : ""}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-ink">{r.description || "—"}</div>
                      <div className="text-white/45">{[r.department, r.design, r.productClass].filter(Boolean).join(" · ") || "—"}</div>
                    </td>
                    <td className="px-3 py-2 align-top">{formatPieceCount(r.onhand)}</td>
                    <td className="px-3 py-2 align-top tabular-nums">{money(r.tagPrice)} · {money(r.costPrice)}</td>
                      </tr>
                      {open ? (
                        <StoreBreakdown
                          colSpan={5}
                          rows={breakdowns[r.vendorModel]}
                          highlightTo={r.store}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
              </div>
            </>
          )}
          {ready && data && data.rows.length === 0 && !loading ? (
            <div className="p-8 text-center text-ink-muted">No rows for this filter.</div>
          ) : null}
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/60">
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
