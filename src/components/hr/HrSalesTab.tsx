"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCurrency, sortTopProductsByUnits, filterTopProductSkus } from "@/lib/utils";
import type { SalesSummary } from "@/types";
import type { ReportSummary } from "@/lib/reports/types";
import { TopProductsTable } from "@/components/reports/TopProductsTable";
import {
  VendorModelDetailDrawer,
  type VendorModelDetailSelection,
} from "@/components/reports/VendorModelDetailDrawer";
import { isValidIsoDate } from "@/lib/reports/date-utils";
import {
  SalesDateRangePicker,
  type SalesDateRangeValue,
} from "@/components/sales/SalesDateRangePicker";
import { SalesMultiSelectFilter } from "@/components/sales/SalesMultiSelectFilter";
import {
  appendSalesFilterParams,
  parseMultiParam,
  pruneUnavailable,
} from "@/lib/sales/filter-params";
import { useApp } from "@/lib/store/app-context";
import {
  showsAllSoldInTopVendorModels,
  userHidesVendorInfo,
} from "@/lib/auth/user-permissions";
import { Package, UserRound } from "lucide-react";

function rangeFromSearchParams(sp: URLSearchParams): SalesDateRangeValue | null {
  const from = sp.get("from")?.trim() ?? "";
  const to = sp.get("to")?.trim() ?? "";
  const date = sp.get("date")?.trim() ?? "";
  if (from && to && isValidIsoDate(from) && isValidIsoDate(to)) {
    return from <= to ? { from, to } : { from: to, to: from };
  }
  if (date && isValidIsoDate(date)) return { from: date, to: date };
  if (from && isValidIsoDate(from)) return { from, to: from };
  return null;
}

function appendDateParams(params: URLSearchParams, range: SalesDateRangeValue | null) {
  if (!range) return;
  if (range.from === range.to) {
    params.set("date", range.from);
  } else {
    params.set("from", range.from);
    params.set("to", range.to);
  }
}

/**
 * HR Management → Sales: employee sales with the same product detail surface
 * as the Sales Dashboard (picture, vendor model, SKU, description, sort, columns).
 */
export function HrSalesTab() {
  const { state } = useApp();
  const hideVendors = userHidesVendorInfo(state?.user);
  const includeHiddenTopModels = showsAllSoldInTopVendorModels(state?.user?.username);

  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableDesigns, setAvailableDesigns] = useState<string[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableVendors, setAvailableVendors] = useState<string[]>([]);
  const [availableSubClasses, setAvailableSubClasses] = useState<string[]>([]);
  const [availableSalespeople, setAvailableSalespeople] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<SalesDateRangeValue | null>(null);
  const [filterStores, setFilterStores] = useState<string[]>([]);
  const [filterDepartments, setFilterDepartments] = useState<string[]>([]);
  const [filterDesigns, setFilterDesigns] = useState<string[]>([]);
  const [filterVendors, setFilterVendors] = useState<string[]>([]);
  const [filterClasses, setFilterClasses] = useState<string[]>([]);
  const [filterSubclasses, setFilterSubclasses] = useState<string[]>([]);
  const [filterSalespeople, setFilterSalespeople] = useState<string[]>([]);
  const [reportId, setReportId] = useState<string | undefined>();
  const [vendorModelDetail, setVendorModelDetail] =
    useState<VendorModelDetailSelection | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const autoSelectLatestRef = useRef(true);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const people = parseMultiParam(sp, "salesperson", "salespeople");
    if (people.length) setFilterSalespeople(people);
    const range = rangeFromSearchParams(sp);
    if (range) {
      autoSelectLatestRef.current = false;
      setDateRange(range);
      setBootstrapped(true);
      return;
    }
    fetch("/api/sales/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { metadata?: { dataThrough?: string | null } | null }) => {
        const through = d.metadata?.dataThrough?.trim() ?? "";
        if (through && isValidIsoDate(through)) {
          autoSelectLatestRef.current = false;
          setDateRange({ from: through, to: through });
        }
        setBootstrapped(true);
      })
      .catch(() => setBootstrapped(true));
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    const params = new URLSearchParams();
    appendDateParams(params, dateRange);
    appendSalesFilterParams(params, {
      stores: filterStores,
      departments: filterDepartments,
      designs: filterDesigns,
      vendors: filterVendors,
      classes: filterClasses,
      subclasses: filterSubclasses,
      salespeople: filterSalespeople,
    });
    const qs = params.toString() ? `?${params}` : "";
    const gen = ++fetchGenRef.current;
    const ac = new AbortController();
    fetch(`/api/sales${qs}`, { signal: ac.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (gen !== fetchGenRef.current) return;
        setSummary(d.summary);
        if (d.source === "report") {
          setReportSummary(d.summary as ReportSummary);
          const dates: string[] = d.availableDates ?? [];
          const stores: string[] = d.availableStores ?? [];
          const departments: string[] = d.availableDepartments ?? [];
          const designs: string[] = d.availableDesigns ?? [];
          const classes: string[] = d.availableClasses ?? [];
          const vendors: string[] = d.availableVendors ?? [];
          const subclasses: string[] = d.availableSubClasses ?? [];
          const salespeople: string[] = d.availableSalespeople ?? [];
          setAvailableDates(dates);
          setAvailableStores(stores);
          setAvailableDepartments(departments);
          setAvailableDesigns(designs);
          setAvailableClasses(classes);
          setAvailableVendors(vendors);
          setAvailableSubClasses(subclasses);
          setAvailableSalespeople(salespeople);
          setReportId((d.report?.id as string | undefined) ?? undefined);
          if (dates.length && autoSelectLatestRef.current && !dateRange) {
            const latest = [...dates].sort().at(-1);
            if (latest) {
              autoSelectLatestRef.current = false;
              setDateRange({ from: latest, to: latest });
            }
          }
          setFilterStores((prev) => pruneUnavailable(prev, stores));
          setFilterDepartments((prev) => pruneUnavailable(prev, departments));
          setFilterDesigns((prev) => pruneUnavailable(prev, designs));
          setFilterVendors((prev) => pruneUnavailable(prev, vendors));
          setFilterClasses((prev) => pruneUnavailable(prev, classes));
          setFilterSubclasses((prev) => pruneUnavailable(prev, subclasses));
          setFilterSalespeople((prev) => pruneUnavailable(prev, salespeople));
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => ac.abort();
  }, [
    bootstrapped,
    dateRange,
    filterStores,
    filterDepartments,
    filterDesigns,
    filterVendors,
    filterClasses,
    filterSubclasses,
    filterSalespeople,
  ]);

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-pulse text-ink-muted">Loading employee sales…</div>
      </div>
    );
  }

  const topProducts = sortTopProductsByUnits(
    filterTopProductSkus(summary.topProducts, { includeHiddenTopModels })
  );
  const multiDayRange = Boolean(
    dateRange && dateRange.from && dateRange.to && dateRange.from !== dateRange.to
  );
  const salespeople = reportSummary?.topSalesPeople ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {availableSalespeople.length > 0 && (
          <SalesMultiSelectFilter
            label="Employee"
            allLabel="All employees"
            options={availableSalespeople}
            value={filterSalespeople}
            onChange={setFilterSalespeople}
          />
        )}
        <SalesDateRangePicker
          availableDates={availableDates}
          reportRange={
            reportSummary?.dateRange ??
            (availableDates.length
              ? { from: availableDates[0]!, to: availableDates[availableDates.length - 1]! }
              : null)
          }
          value={dateRange}
          onChange={setDateRange}
        />
        {availableStores.length > 0 && (
          <SalesMultiSelectFilter
            label="Stores"
            allLabel="All stores"
            options={availableStores}
            value={filterStores}
            onChange={setFilterStores}
          />
        )}
        {availableDepartments.length > 0 && (
          <SalesMultiSelectFilter
            label="Departments"
            allLabel="All departments"
            options={availableDepartments}
            value={filterDepartments}
            onChange={setFilterDepartments}
          />
        )}
        {availableDesigns.length > 0 && (
          <SalesMultiSelectFilter
            label="Designs"
            allLabel="All designs"
            options={availableDesigns}
            value={filterDesigns}
            onChange={setFilterDesigns}
          />
        )}
        {!hideVendors && availableVendors.length > 0 && (
          <SalesMultiSelectFilter
            label="Vendors"
            allLabel="All vendors"
            options={availableVendors}
            value={filterVendors}
            onChange={setFilterVendors}
          />
        )}
        {availableClasses.length > 0 && (
          <SalesMultiSelectFilter
            label="Classes"
            allLabel="All classes"
            options={availableClasses}
            value={filterClasses}
            onChange={setFilterClasses}
          />
        )}
        {availableSubClasses.length > 0 && (
          <SalesMultiSelectFilter
            label="Subclasses"
            allLabel="All subclasses"
            options={availableSubClasses}
            value={filterSubclasses}
            onChange={setFilterSubclasses}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Net Sales</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-300">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </div>
        <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Units</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-white">
            {(summary.totalTransactions ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Employee</p>
          <p className="mt-1 text-sm font-medium text-white truncate">
            {filterSalespeople.length ? filterSalespeople.join(", ") : "All employees"}
          </p>
        </div>
      </div>

      {filterSalespeople.length === 0 && salespeople.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <CardHeader className="px-4 pt-4 pb-3 border-b border-white/10">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound size={17} className="text-sky-300" />
              Employee sales
            </CardTitle>
            <span className="text-xs text-ink-muted">
              {salespeople.length} associates · tap to filter Name (CODE)
            </span>
          </CardHeader>
          <ul className="max-h-64 overflow-y-auto divide-y divide-white/5">
            {salespeople.slice(0, 40).map((p) => (
              <li key={p.code ?? p.name}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04]"
                  onClick={() => {
                    const label =
                      availableSalespeople.find((s) => s === p.name) ??
                      availableSalespeople.find((s) => p.code && s.endsWith(`(${p.code})`)) ??
                      p.name;
                    setFilterSalespeople([label]);
                  }}
                >
                  <span className="text-sm text-white/90 truncate">{p.name}</span>
                  <span className="text-sm tabular-nums text-emerald-300 shrink-0">
                    {formatCurrency(p.revenue)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-3 border-b border-white/10">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package size={17} className="text-sky-300" />
            Employee products
          </CardTitle>
          <span className="text-xs text-ink-muted">
            Picture · vendor model · SKU · description · sort Qty / Revenue / Margin · show/hide
            columns
          </span>
        </CardHeader>
        <div className="p-3 sm:p-4">
          <TopProductsTable
            products={topProducts}
            showDateFilter={multiDayRange}
            includeHiddenTopModels={includeHiddenTopModels}
            emptyLabel="No sold products for this employee filter."
            onVendorModelDetail={(p) =>
              setVendorModelDetail({
                vendorModel:
                  p.vendorModel === "ITEM" && p.name
                    ? `ITEM · ${p.name}`
                    : p.vendorModel || p.itemNumber || p.name,
                description: p.name,
                imageUrl: p.imageUrl,
                imageDir: p.imageDir,
              })
            }
          />
        </div>
      </Card>

      <VendorModelDetailDrawer
        selection={vendorModelDetail}
        filterStore={filterStores.length ? filterStores.join(",") : undefined}
        dateFrom={dateRange?.from}
        dateTo={dateRange?.to}
        reportId={
          reportId && reportId !== "latest" && !/^\d{4}-\d{2}-\d{2}$/.test(reportId)
            ? reportId
            : undefined
        }
        onClose={() => setVendorModelDetail(null)}
      />
    </div>
  );
}
