"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { SalesSummary } from "@/types";
import type { ReportSummary } from "@/lib/reports/types";
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
import { displayHrPosDesign, HR_OTHERS_DESIGN } from "@/lib/hr/hr-sales-design";
import { ArrowDown, ArrowUp, ArrowUpDown, Gem, MapPin, UserRound } from "lucide-react";
import { HrCommissionPanel } from "@/components/hr/HrCommissionPanel";
import type { EmployeeCommission } from "@/lib/hr/commission";
import { HR_ATTENDANCE_FROM, HR_ATTENDANCE_TO } from "@/lib/hr/window";
import type { HrSalesScopePayload, HrSelfSalesperson } from "@/lib/hr/hr-self-sales-types";

type DesignSortKey = "name" | "revenue";
type SortDir = "asc" | "desc";

type DesignSalesRow = { name: string; revenue: number };

function sortDesignSales(
  rows: DesignSalesRow[],
  key: DesignSortKey,
  dir: SortDir
): DesignSalesRow[] {
  const nameCmp = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: "base" });
  return [...rows].sort((a, b) => {
    if (key === "name") {
      const c = nameCmp(a.name, b.name);
      if (c !== 0) return dir === "asc" ? c : -c;
      return b.revenue - a.revenue;
    }
    if (a.revenue !== b.revenue) {
      return dir === "asc" ? a.revenue - b.revenue : b.revenue - a.revenue;
    }
    return nameCmp(a.name, b.name);
  });
}

function DesignSortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button type="button" className="hr-sort-btn" onClick={onClick} title={`Sort by ${label}`}>
      {label}
      <Icon size={12} aria-hidden />
    </button>
  );
}

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

function formatUnitsSold(units: number): string {
  return Math.round(units).toLocaleString();
}

/**
 * HR Management → Sales: employee ranking and net/units KPIs.
 * Product / vendor-model tables stay on the Sales Dashboard only.
 */
export function HrSalesTab() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableDesigns, setAvailableDesigns] = useState<string[]>([]);
  const [availableSalespeople, setAvailableSalespeople] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<SalesDateRangeValue | null>(null);
  const [filterStores, setFilterStores] = useState<string[]>([]);
  const [filterDepartments, setFilterDepartments] = useState<string[]>([]);
  const [filterDesigns, setFilterDesigns] = useState<string[]>([]);
  const [filterSalespeople, setFilterSalespeople] = useState<string[]>([]);
  const [designSortKey, setDesignSortKey] = useState<DesignSortKey>("revenue");
  const [designSortDir, setDesignSortDir] = useState<SortDir>("desc");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [commission, setCommission] = useState<EmployeeCommission | null>(null);
  const [hrScope, setHrScope] = useState<HrSalesScopePayload | null>(null);
  const autoSelectLatestRef = useRef(false);
  const fetchGenRef = useRef(0);
  const commissionGenRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const people = parseMultiParam(sp, "salesperson", "salespeople");
    if (people.length) setFilterSalespeople(people);
    const range = rangeFromSearchParams(sp);
    if (range) {
      setDateRange(range);
      setBootstrapped(true);
      return;
    }
    setDateRange({ from: HR_ATTENDANCE_FROM, to: HR_ATTENDANCE_TO });
    setBootstrapped(true);
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    const params = new URLSearchParams();
    appendDateParams(params, dateRange);
    appendSalesFilterParams(params, {
      stores: filterStores,
      departments: filterDepartments,
      designs: filterDesigns,
      vendors: [],
      classes: [],
      subclasses: [],
      salespeople: filterSalespeople,
    });
    params.set("hrSales", "1");
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
          const salespeople: string[] = d.availableSalespeople ?? [];
          const scope = d.hrSalesScope as HrSalesScopePayload | undefined;
          if (scope) setHrScope(scope);
          setAvailableDates(dates);
          setAvailableStores(stores);
          setAvailableDepartments(departments);
          setAvailableDesigns(designs);
          setAvailableSalespeople(salespeople);
          if (scope?.mode === "self" && scope.self) {
            setFilterStores((prev) => (prev.length ? [] : prev));
            setFilterDepartments((prev) => (prev.length ? [] : prev));
            setFilterSalespeople((prev) =>
              prev.length === 1 && prev[0] === scope.self!.label ? prev : [scope.self!.label]
            );
          }
          if (dates.length && autoSelectLatestRef.current && !dateRange) {
            const latest = [...dates].sort().at(-1);
            if (latest) {
              autoSelectLatestRef.current = false;
              setDateRange({ from: latest, to: latest });
            }
          }
          if (scope?.mode !== "self") {
            setFilterStores((prev) => pruneUnavailable(prev, stores));
            setFilterDepartments((prev) => pruneUnavailable(prev, departments));
            setFilterSalespeople((prev) => pruneUnavailable(prev, salespeople));
          }
          setFilterDesigns((prev) => pruneUnavailable(prev, designs));
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
    filterSalespeople,
  ]);

  useEffect(() => {
    if (!bootstrapped) return;
    const selfLocked = hrScope?.mode === "self";
    const person = selfLocked
      ? hrScope.self?.label ?? null
      : filterSalespeople.length === 1
        ? filterSalespeople[0]
        : null;
    if (!person || !dateRange) {
      setCommission(null);
      return;
    }
    const params = new URLSearchParams();
    params.set("salesperson", person);
    params.set("from", dateRange.from);
    params.set("to", dateRange.to);
    const gen = ++commissionGenRef.current;
    const ac = new AbortController();
    fetch(`/api/hr/commission?${params}`, { signal: ac.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d: { commission?: EmployeeCommission }) => {
        if (gen !== commissionGenRef.current) return;
        setCommission(d.commission ?? null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCommission(null);
      });
    return () => ac.abort();
  }, [bootstrapped, dateRange, filterSalespeople, hrScope]);

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-pulse" style={{ color: "#8b95a5" }}>
          Loading employee sales…
        </div>
      </div>
    );
  }

  const salespeople = reportSummary?.topSalesPeople ?? [];
  const designTotals = new Map<string, number>();
  for (const d of reportSummary?.topDesigns ?? []) {
    let name = displayHrPosDesign((d.name || "").trim());
    if (!name || name.toLowerCase() === "unknown design") name = HR_OTHERS_DESIGN;
    designTotals.set(name, (designTotals.get(name) ?? 0) + (d.revenue ?? 0));
  }
  const namedSum = [...designTotals.values()].reduce((s, n) => s + n, 0);
  const gap = (summary.totalRevenue ?? 0) - namedSum;
  if (Math.abs(gap) >= 0.005) {
    designTotals.set(HR_OTHERS_DESIGN, (designTotals.get(HR_OTHERS_DESIGN) ?? 0) + gap);
  }
  const designRows = sortDesignSales(
    [...designTotals.entries()].map(([name, revenue]) => ({ name, revenue })),
    designSortKey,
    designSortDir
  );

  const selfLocked = hrScope?.mode === "self";
  const selfIdentity: HrSelfSalesperson | null = selfLocked ? hrScope.self : null;
  const unmatchedSelf = selfLocked && !selfIdentity;
  const showEmployeePicker = !selfLocked && availableSalespeople.length > 0;
  const showStoreFilter = !selfLocked && availableStores.length > 0;
  const showDepartmentFilter = !selfLocked && availableDepartments.length > 0;
  const lockedToSelf = Boolean(selfIdentity);
  const selectedEmployeeLabel = lockedToSelf
    ? selfIdentity!.label
    : filterSalespeople.length
      ? filterSalespeople.join(", ")
      : "All employees";
  const showDesignSales = lockedToSelf || filterSalespeople.length > 0;
  const showPeopleList = !selfLocked && filterSalespeople.length === 0 && salespeople.length > 0;

  function toggleDesignSort(key: DesignSortKey) {
    if (designSortKey === key) {
      setDesignSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setDesignSortKey(key);
    setDesignSortDir(key === "revenue" ? "desc" : "asc");
  }

  return (
    <div className="hr-sales-panel space-y-4">
      <div className="hr-filters" style={{ marginTop: 0 }}>
        <div className="hr-field" style={{ gridColumn: "1 / -1" }}>
          <span className="hr-field-label">Filters</span>
          <div className="flex flex-wrap items-center gap-2">
            {showEmployeePicker && (
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
            {showStoreFilter && (
              <SalesMultiSelectFilter
                label="Stores"
                allLabel="All stores"
                options={availableStores}
                value={filterStores}
                onChange={setFilterStores}
              />
            )}
            {showDepartmentFilter && (
              <SalesMultiSelectFilter
                label="Department"
                allLabel="All departments"
                options={availableDepartments}
                value={filterDepartments}
                onChange={setFilterDepartments}
              />
            )}
            {availableDesigns.length > 0 && (
              <SalesMultiSelectFilter
                label="Design"
                allLabel="All designs"
                options={availableDesigns}
                value={filterDesigns}
                onChange={setFilterDesigns}
              />
            )}
          </div>
        </div>
      </div>

      {selfIdentity && (
        <div className="hr-self-id">
          <div>
            <div className="hr-self-id-kicker">Employee</div>
            <div className="hr-self-id-name">{selfIdentity.label}</div>
          </div>
          <div className="hr-self-id-store">
            <MapPin size={14} aria-hidden />
            <span>{selfIdentity.storeName || selfIdentity.storeCode || "Store"}</span>
          </div>
        </div>
      )}

      {unmatchedSelf && (
        <p className="hr-empty-inline">
          Could not match your login to a salesperson. Sales stay hidden until HR links your name or
          employee code.
        </p>
      )}

      {!unmatchedSelf && (
        <div className={`hr-sales-kpis${selfLocked ? " hr-sales-kpis-self" : ""}`}>
          <div className="hr-kpi">
            <div className="hr-kpi-label">Net Sales</div>
            <div className="hr-kpi-value" style={{ color: "#0e9f90" }}>
              {formatCurrency(summary.totalRevenue)}
            </div>
          </div>
          <div className="hr-kpi">
            <div className="hr-kpi-label">Units sold</div>
            <div className="hr-kpi-value">{formatUnitsSold(summary.totalTransactions ?? 0)}</div>
          </div>
          {!selfLocked && (
            <div className="hr-kpi">
              <div className="hr-kpi-label">Employee</div>
              <div className="hr-kpi-value" style={{ fontSize: "1.05rem" }}>
                {selectedEmployeeLabel}
              </div>
            </div>
          )}
        </div>
      )}

      {showPeopleList && (
        <div className="hr-panel">
          <div className="hr-panel-head">
            <div>
              <h3 className="hr-panel-title">
                <UserRound size={17} />
                Employee sales
              </h3>
              <p className="hr-panel-sub">
                {salespeople.length} associates · tap to filter Name (CODE)
              </p>
            </div>
          </div>
          <ul className="hr-people-list">
            {salespeople.slice(0, 40).map((p) => (
              <li key={p.code ?? p.name}>
                <button
                  type="button"
                  onClick={() => {
                    const label =
                      availableSalespeople.find((s) => s === p.name) ??
                      availableSalespeople.find((s) => p.code && s.endsWith(`(${p.code})`)) ??
                      p.name;
                    setFilterSalespeople([label]);
                  }}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="hr-people-rev">{formatCurrency(p.revenue)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showDesignSales && !unmatchedSelf && (
        <div className="hr-panel">
          <div className="hr-panel-head">
            <div>
              <h3 className="hr-panel-title">
                <Gem size={17} />
                Design sales
              </h3>
              <p className="hr-panel-sub">
                {designRows.length} design line{designRows.length === 1 ? "" : "s"} · tap a column to
                sort
              </p>
            </div>
          </div>
          {designRows.length === 0 ? (
            <p className="hr-empty-inline">No design sales for this employee filter.</p>
          ) : (
            <div className="hr-design-table-wrap">
              <table className="hr-design-table">
                <thead>
                  <tr>
                    <th>
                      <DesignSortButton
                        label="Design name"
                        active={designSortKey === "name"}
                        dir={designSortDir}
                        onClick={() => toggleDesignSort("name")}
                      />
                    </th>
                    <th className="hr-design-table-num">
                      <DesignSortButton
                        label="Net sale"
                        active={designSortKey === "revenue"}
                        dir={designSortDir}
                        onClick={() => toggleDesignSort("revenue")}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {designRows.map((d) => (
                    <tr key={d.name}>
                      <td className="hr-design-name">{d.name}</td>
                      <td className="hr-design-rev">{formatCurrency(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {commission && dateRange && (lockedToSelf || filterSalespeople.length === 1) && (
        <HrCommissionPanel commission={commission} from={dateRange.from} to={dateRange.to} />
      )}
    </div>
  );
}
