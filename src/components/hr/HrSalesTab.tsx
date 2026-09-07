"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { pruneSalespersonSelection } from "@/lib/sales/salesperson-filter";
import {
  ChevronDown,
  Download,
  Search,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { HrCommissionPanel } from "@/components/hr/HrCommissionPanel";
import type { EmployeeCommission } from "@/lib/hr/commission";
import type { EmployeeSalesRosterRow } from "@/lib/hr/build-employee-commission";
import { formatHrDesignFilterLabel } from "@/lib/hr/hr-sales-design";
import {
  employeeSalesDesignRows,
  employeeSalesRosterCsv,
  employeeSalesSummaryRows,
  EMPLOYEE_SALES_CSV_HEADERS,
  EMPLOYEE_SALES_DESIGN_CSV_HEADERS,
} from "@/lib/hr/employee-sales-export";
import { HR_ATTENDANCE_FROM, HR_ATTENDANCE_TO } from "@/lib/hr/window";
import type { HrSalesScopePayload } from "@/lib/hr/hr-self-sales-types";

const PAGE_SIZE = 20;

const SALES_RANGE_OPTIONS = [
  { id: "all", label: "All sales" },
  { id: "lt50", label: "Under $50k" },
  { id: "50to100", label: "$50k – $100k" },
  { id: "100to200", label: "$100k – $200k" },
  { id: "gte200", label: "$200k+" },
] as const;

type SalesRangeId = (typeof SALES_RANGE_OPTIONS)[number]["id"];
type SortKey = "netSales" | "units" | "presentDays" | "base" | "attendanceBonus" | "personalBonus" | "commission";

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

function inSalesRange(net: number, range: SalesRangeId): boolean {
  if (range === "all") return true;
  if (range === "lt50") return net < 50_000;
  if (range === "50to100") return net >= 50_000 && net < 100_000;
  if (range === "100to200") return net >= 100_000 && net < 200_000;
  return net >= 200_000;
}

function employeeInitials(label: string): string {
  const name = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

function sortValue(row: EmployeeSalesRosterRow, key: SortKey): number {
  const s = row.commission.summary;
  if (key === "netSales") return s.netSales;
  if (key === "units") return row.units;
  if (key === "presentDays") return s.presentDays;
  if (key === "base") return s.baseCommission;
  if (key === "attendanceBonus") return s.attendanceBonus;
  if (key === "personalBonus") return s.personalGoalBonus;
  return s.totalCommission;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * HR Management → Sales: employee ranking, commission table, click-for-detail.
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
  const [salesRange, setSalesRange] = useState<SalesRangeId>("all");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [roster, setRoster] = useState<EmployeeSalesRosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [hrScope, setHrScope] = useState<HrSalesScopePayload | null>(null);
  const [query, setQuery] = useState("");
  const [designWise, setDesignWise] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("netSales");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showAll, setShowAll] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const autoSelectLatestRef = useRef(false);
  const fetchGenRef = useRef(0);
  const rosterGenRef = useRef(0);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const people = parseMultiParam(sp, "salesperson", "salespeople");
    if (people.length) setFilterSalespeople(people);
    const stores = parseMultiParam(sp, "store", "stores");
    if (stores.length) setFilterStores(stores);
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
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [exportOpen]);

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
          if (scope) {
            setHrScope((prev) =>
              prev && JSON.stringify(prev) === JSON.stringify(scope) ? prev : scope
            );
          }
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
            setFilterSalespeople((prev) => pruneSalespersonSelection(prev, salespeople));
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
    if (!bootstrapped || !dateRange) return;
    const params = new URLSearchParams();
    params.set("from", dateRange.from);
    params.set("to", dateRange.to);
    appendSalesFilterParams(params, {
      stores: filterStores,
      departments: filterDepartments,
      designs: filterDesigns,
      vendors: [],
      classes: [],
      subclasses: [],
      salespeople: filterSalespeople,
    });
    const gen = ++rosterGenRef.current;
    const ac = new AbortController();
    setRosterLoading(true);
    fetch(`/api/hr/employee-sales?${params}`, { signal: ac.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d: { employees?: EmployeeSalesRosterRow[] }) => {
        if (gen !== rosterGenRef.current) return;
        setRoster(Array.isArray(d.employees) ? d.employees : []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (gen !== rosterGenRef.current) return;
        setRoster([]);
      })
      .finally(() => {
        if (gen === rosterGenRef.current) setRosterLoading(false);
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

  const selfLocked = hrScope?.mode === "self";
  const unmatchedSelf = hrScope?.mode === "self" && !hrScope.self;

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = roster.filter((row) => inSalesRange(row.commission.summary.netSales, salesRange));
    if (q) {
      rows = rows.filter(
        (row) =>
          row.label.toLowerCase().includes(q) ||
          row.code.toLowerCase().includes(q)
      );
    }
    const dir = sortDir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const d = sortValue(a, sortKey) - sortValue(b, sortKey);
      if (d) return d * dir;
      return a.label.localeCompare(b.label);
    });
  }, [roster, query, salesRange, sortKey, sortDir]);

  const visibleRows = showAll ? filteredRows : filteredRows.slice(0, PAGE_SIZE);
  const selected = filteredRows.find((r) => r.code === selectedCode) ?? null;

  useEffect(() => {
    if (selectedCode && !filteredRows.some((r) => r.code === selectedCode)) {
      setSelectedCode(null);
    }
  }, [filteredRows, selectedCode]);

  const kpiNet = filteredRows.reduce((s, r) => s + r.commission.summary.netSales, 0);
  const kpiUnits = filteredRows.reduce((s, r) => s + r.units, 0);
  const kpiCommission = filteredRows.reduce((s, r) => s + r.commission.summary.totalCommission, 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportName = dateRange
    ? `employee-sales-${dateRange.from}-to-${dateRange.to}`
    : "employee-sales";

  const exportCsv = () => {
    const csv = employeeSalesRosterCsv(filteredRows, { designWise });
    downloadBlob(
      `${exportName}.csv`,
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    setExportOpen(false);
  };

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet([
      [...EMPLOYEE_SALES_CSV_HEADERS],
      ...employeeSalesSummaryRows(filteredRows),
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Employees");
    if (designWise) {
      const designSheet = XLSX.utils.aoa_to_sheet([
        [...EMPLOYEE_SALES_DESIGN_CSV_HEADERS],
        ...employeeSalesDesignRows(filteredRows),
      ]);
      XLSX.utils.book_append_sheet(wb, designSheet, "Designs");
    }
    XLSX.writeFile(wb, `${exportName}.xlsx`);
    setExportOpen(false);
  };

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-pulse" style={{ color: "#8b95a5" }}>
          Loading employee sales…
        </div>
      </div>
    );
  }

  const showEmployeePicker = !selfLocked && availableSalespeople.length > 0;
  const showStoreFilter = !selfLocked && availableStores.length > 0;
  const showDepartmentFilter = !selfLocked && availableDepartments.length > 0;

  return (
    <div className="hr-esr">
      <div className="hr-sales-kpis hr-esr-kpis">
        <div className="hr-kpi">
          <div className="hr-kpi-label">Net sales</div>
          <div className="hr-kpi-value" style={{ color: "#0e9f90" }}>
            {formatCurrency(kpiNet || summary.totalRevenue)}
          </div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-label">Units sold</div>
          <div className="hr-kpi-value">{formatUnitsSold(kpiUnits || summary.totalTransactions || 0)}</div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-label">Employees</div>
          <div className="hr-kpi-value">{filteredRows.length.toLocaleString()}</div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-label">Total commission</div>
          <div className="hr-kpi-value">{formatCurrency(kpiCommission)}</div>
          <div className="hr-kpi-sub">from {filteredRows.length} employee summaries</div>
        </div>
      </div>

      {unmatchedSelf && (
        <p className="hr-empty-inline">
          Could not match your login to a salesperson. Sales stay hidden until HR links your name or
          employee code.
        </p>
      )}

      {!unmatchedSelf && (
        <div className="hr-esr-body">
          <aside className="hr-esr-filters">
            <p className="hr-field-label">Filters</p>
            {availableDesigns.length > 0 && (
              <SalesMultiSelectFilter
                label="Design"
                allLabel="All designs"
                options={availableDesigns}
                value={filterDesigns}
                onChange={setFilterDesigns}
                formatOption={formatHrDesignFilterLabel}
                fullWidth
              />
            )}
            {showStoreFilter && (
              <SalesMultiSelectFilter
                label="Store"
                allLabel="All stores"
                options={availableStores}
                value={filterStores}
                onChange={setFilterStores}
                fullWidth
              />
            )}
            {showEmployeePicker && (
              <SalesMultiSelectFilter
                label="Employee"
                allLabel="All employees"
                options={availableSalespeople}
                value={filterSalespeople}
                onChange={setFilterSalespeople}
                fullWidth
              />
            )}
            {showDepartmentFilter && (
              <SalesMultiSelectFilter
                label="Department"
                allLabel="All departments"
                options={availableDepartments}
                value={filterDepartments}
                onChange={setFilterDepartments}
                fullWidth
              />
            )}
            <label className="hr-field" style={{ minWidth: 0 }}>
              <span className="hr-field-label">Sales range</span>
              <select
                className="hr-select"
                aria-label="Sales range"
                value={salesRange}
                onChange={(e) => setSalesRange(e.target.value as SalesRangeId)}
              >
                {SALES_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="hr-esr-count">{filteredRows.length} employees shown</p>
          </aside>

          <div className="hr-esr-main">
            <div className="hr-esr-toolbar">
              <label className="hr-search hr-esr-search">
                <Search size={14} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowAll(false);
                  }}
                  className="hr-input"
                  placeholder="Search employees..."
                  aria-label="Search employees"
                />
              </label>
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
              <label className="hr-esr-switch">
                <span>Design Wise</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={designWise}
                  className={`hr-esr-toggle${designWise ? " is-on" : ""}`}
                  onClick={() => setDesignWise((v) => !v)}
                >
                  <span />
                </button>
              </label>
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  className="hr-btn hr-btn-outline"
                  onClick={() => setExportOpen((o) => !o)}
                  disabled={!filteredRows.length}
                >
                  <Download size={14} />
                  Export
                  <ChevronDown size={14} style={{ opacity: 0.7 }} />
                </button>
                {exportOpen && (
                  <div className="hr-menu">
                    <button type="button" onClick={exportCsv}>
                      Download CSV
                    </button>
                    <button type="button" onClick={() => void exportXlsx()}>
                      Download Excel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {rosterLoading ? (
              <p className="hr-empty-inline">Loading employee sales…</p>
            ) : visibleRows.length === 0 ? (
              <p className="hr-empty-inline">No employees match these filters.</p>
            ) : (
              <div className="hr-esr-table-wrap">
                <table className="hr-esr-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <SortTh
                        label="Net sales"
                        active={sortKey === "netSales"}
                        dir={sortDir}
                        onClick={() => toggleSort("netSales")}
                      />
                      <SortTh
                        label="Units"
                        active={sortKey === "units"}
                        dir={sortDir}
                        onClick={() => toggleSort("units")}
                      />
                      <SortTh
                        label="Worked days"
                        active={sortKey === "presentDays"}
                        dir={sortDir}
                        onClick={() => toggleSort("presentDays")}
                      />
                      <SortTh
                        label="Base"
                        active={sortKey === "base"}
                        dir={sortDir}
                        onClick={() => toggleSort("base")}
                      />
                      <SortTh
                        label="Attendance bonus"
                        active={sortKey === "attendanceBonus"}
                        dir={sortDir}
                        onClick={() => toggleSort("attendanceBonus")}
                      />
                      <SortTh
                        label="Personal sale/bonus"
                        active={sortKey === "personalBonus"}
                        dir={sortDir}
                        onClick={() => toggleSort("personalBonus")}
                      />
                      <SortTh
                        label="Commission"
                        active={sortKey === "commission"}
                        dir={sortDir}
                        onClick={() => toggleSort("commission")}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const s = row.commission.summary;
                      const open = selectedCode === row.code;
                      return (
                        <EmployeeTableBlock
                          key={row.code}
                          row={row}
                          summary={s}
                          open={open}
                          designWise={designWise}
                          onSelect={() => setSelectedCode(open ? null : row.code)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filteredRows.length > 0 && (
              <div className="hr-esr-foot">
                {filteredRows.length > PAGE_SIZE && !showAll ? (
                  <button type="button" className="hr-link" onClick={() => setShowAll(true)}>
                    ↓ More rows available.
                  </button>
                ) : (
                  <span />
                )}
                <div className="hr-esr-pager">
                  <span>
                    {visibleRows.length} / {filteredRows.length}
                  </span>
                  {filteredRows.length > PAGE_SIZE && (
                    <button
                      type="button"
                      className="hr-btn hr-btn-outline hr-btn-sm"
                      onClick={() => setShowAll((v) => !v)}
                    >
                      {showAll ? "Show less" : "Show All"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {selected && dateRange && (
              <HrCommissionPanel
                commission={selected.commission}
                from={dateRange.from}
                to={dateRange.to}
                hideDesignTable={designWise}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="hr-esr-num">
      <button type="button" className="hr-esr-sort" onClick={onClick}>
        {label}
        {active ? dir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} /> : null}
      </button>
    </th>
  );
}

function EmployeeTableBlock({
  row,
  summary: s,
  open,
  designWise,
  onSelect,
}: {
  row: EmployeeSalesRosterRow;
  summary: EmployeeCommission["summary"];
  open: boolean;
  designWise: boolean;
  onSelect: () => void;
}) {
  return (
    <>
      <tr
        className={open ? "is-open" : undefined}
        onClick={onSelect}
        style={{ cursor: "pointer" }}
      >
        <td>
          <span className="hr-esr-emp">
            <span className="hr-esr-avatar" aria-hidden>
              {employeeInitials(row.label)}
            </span>
            <span className="hr-esr-emp-name">{row.label}</span>
          </span>
        </td>
        <td className="hr-esr-num">{formatCurrency(s.netSales)}</td>
        <td className="hr-esr-num">{formatUnitsSold(row.units)}</td>
        <td className="hr-esr-num">{s.presentDays}</td>
        <td className="hr-esr-num">{formatCurrency(s.baseCommission)}</td>
        <td className="hr-esr-num">
          {s.attendanceBonus ? formatCurrency(s.attendanceBonus) : "—"}
        </td>
        <td className="hr-esr-num">
          {formatCurrency(s.netSales)} / {formatCurrency(s.personalGoalBonus)}
        </td>
        <td className="hr-esr-num hr-esr-num-em">{formatCurrency(s.totalCommission)}</td>
      </tr>
      {open && designWise && (
        <tr className="hr-esr-design-row">
          <td colSpan={8}>
            {row.commission.lines.length === 0 ? (
              <p className="hr-empty-inline" style={{ padding: "0.5rem 0" }}>
                No design sales in this window.
              </p>
            ) : (
              <table className="hr-design-table hr-comm-table">
                <thead>
                  <tr>
                    <th>Design</th>
                    <th className="hr-design-table-num">Net sales</th>
                    <th className="hr-design-table-num">Rate</th>
                    <th className="hr-design-table-num">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {row.commission.lines.map((line) => (
                    <tr key={line.design}>
                      <td className="hr-design-name">{formatHrDesignFilterLabel(line.design)}</td>
                      <td className="hr-comm-num">{formatCurrency(line.netSales)}</td>
                      <td className="hr-comm-rate">
                        {Number.isInteger(line.employeeRate * 100)
                          ? `${line.employeeRate * 100}%`
                          : `${(line.employeeRate * 100).toFixed(1)}%`}
                      </td>
                      <td className="hr-comm-num hr-comm-num-em">
                        {formatCurrency(line.baseCommission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
