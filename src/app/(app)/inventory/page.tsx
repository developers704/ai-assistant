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
  soldQty: number;
  revenue: number;
  onhand: number;
  fromStore: string;
  fromDm: string;
  fromTier: string;
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

function QtyBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-md bg-amber-400/20 px-2 py-0.5 font-semibold tabular-nums text-amber-100">
      {formatPieceCount(n)}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cls =
    tier === "A"
      ? "bg-emerald-400/15 text-emerald-200"
      : tier === "B"
        ? "bg-sky-400/15 text-sky-200"
        : "bg-white/10 text-white/70";
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", cls)}>{tier}</span>;
}

function StoreBreakdown({
  colSpan,
  rows,
  highlight,
}: {
  colSpan: number;
  rows: ModelStoreRow[] | "loading" | "error" | undefined;
  highlight?: string[];
}) {
  const marks = new Set((highlight ?? []).map((s) => s.toUpperCase()));
  return (
    <tr className="border-t border-white/[0.06] bg-white/[0.02]">
      <td colSpan={colSpan} className="px-4 py-2">
        {rows === "loading" || rows == null ? (
          <div className="py-2 text-white/40">Loading stores…</div>
        ) : rows === "error" ? (
          <div className="py-2 text-rose-300">Could not load stores.</div>
        ) : rows.length === 0 ? (
          <div className="py-2 text-white/40">No other store stock for this vendor model.</div>
        ) : (
          <table className="w-full max-w-xl text-left text-[12px]">
            <thead className="text-[10px] uppercase tracking-wide text-white/35">
              <tr>
                <th className="py-1 pr-3">Store</th>
                <th className="py-1 pr-3">Onhand</th>
                <th className="py-1">Sold</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.store}
                  className={cn(marks.has(s.store.toUpperCase()) && "text-amber-100")}
                >
                  <td className="py-0.5 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      {s.store}
                      <TierBadge tier={s.tier} />
                      <span className="text-white/35">{s.dm}</span>
                    </span>
                  </td>
                  <td className="py-0.5 pr-3 tabular-nums">{formatPieceCount(s.onhand)}</td>
                  <td className="py-0.5 tabular-nums">{formatPieceCount(s.soldQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </td>
    </tr>
  );
}

export default function InventoryPage() {
  const [view, setView] = useState<View>("transfers");
  const [dateRange, setDateRange] = useState<SalesDateRangeValue>({
    from: "2025-01-01",
    to: "2026-09-13",
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
        ? "AJ / Shaun transfer needs — A stores first, same-district B/C donors, then the other DM."
        : "AJ / Shaun on-hand (MAIN, closed, Adeel, and Rozina stores excluded).",
    [view]
  );

  return (
    <PageShell accent="amber">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Inventory"
          title="Inventory"
          subtitle={header}
        />
      </PageShellHeader>
      <PageShellBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={view === "transfers" ? "primary" : "ghost"} onClick={() => { setView("transfers"); setOffset(0); setSort("fromSoldQty"); }}>
            Transfers
          </Button>
          <Button size="sm" variant={view === "stock" ? "primary" : "ghost"} onClick={() => { setView("stock"); setOffset(0); setSort("onhand"); }}>
            All on-hand
          </Button>
          <SalesDateRangePicker
            availableDates={datesBetween("2025-01-01", "2026-09-13")}
            reportRange={{ from: "2025-01-01", to: "2026-09-13" }}
            value={dateRange}
            onChange={(next) => {
              if (!next) return;
              setDateRange(next);
              setOffset(0);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            {dir === "asc" ? "Asc" : "Desc"}
          </Button>
        </div>

        <Card className="overflow-x-auto p-0">
          {loading && !data ? (
            <div className="p-8 text-center text-ink-muted">Loading inventory…</div>
          ) : error ? (
            <div className="p-8 text-center text-rose-300">{error}</div>
          ) : view === "transfers" ? (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-3 py-2">Vendor model</th>
                  <th className="px-3 py-2">Description / department</th>
                  <th className="whitespace-nowrap px-3 py-2">Onhand</th>
                  <th className="whitespace-nowrap px-3 py-2">Sold</th>
                  <th className="whitespace-nowrap px-3 py-2">To</th>
                  <th className="whitespace-nowrap px-3 py-2">Onhand</th>
                  <th className="whitespace-nowrap px-3 py-2">Sold</th>
                  <th className="whitespace-nowrap px-3 py-2">From</th>
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
                        className="cursor-pointer border-t border-white/[0.06] hover:bg-white/[0.04]"
                        onClick={() => toggleRow(rowKey, r.vendorModel)}
                      >
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
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <div className="flex items-center gap-1.5">
                        <span>{r.toStore}</span>
                        <TierBadge tier={r.toTier} />
                        <span className="text-white/40">{r.toDm}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <QtyBadge n={r.fromOnhand} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <QtyBadge n={r.fromSoldQty} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <div className="flex items-center gap-1.5">
                        <span>{r.fromStore}</span>
                        <TierBadge tier={r.fromTier} />
                        <span className="text-white/40">{r.fromDm}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">{money(r.tagPrice)}</td>
                    <td className="px-3 py-2 align-top">{money(r.costPrice)}</td>
                    <td className="px-3 py-2 align-top">{money(r.revenue)}</td>
                      </tr>
                      {open ? (
                        <StoreBreakdown
                          colSpan={11}
                          rows={breakdowns[r.vendorModel]}
                          highlight={[r.toStore, r.fromStore]}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
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
                        className="cursor-pointer border-t border-white/[0.06] hover:bg-white/[0.04]"
                        onClick={() => toggleRow(rowKey, r.vendorModel)}
                      >
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1.5">
                        <ChevronDown size={14} className={cn("shrink-0 text-white/40 transition-transform", open && "rotate-180")} />
                        <span>{r.store}</span>
                        <TierBadge tier={r.tier} />
                        <span className="text-white/40">{r.dm}</span>
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
                    <td className="px-3 py-2 align-top">{money(r.tagPrice)} · {money(r.costPrice)}</td>
                      </tr>
                      {open ? (
                        <StoreBreakdown
                          colSpan={5}
                          rows={breakdowns[r.vendorModel]}
                          highlight={[r.store]}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
          {data && data.rows.length === 0 && !loading ? (
            <div className="p-8 text-center text-ink-muted">No rows for this filter.</div>
          ) : null}
        </Card>

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
