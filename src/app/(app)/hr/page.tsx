"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { HrWorkspace } from "@/components/hr/HrWorkspace";
import type { HrEmployeeDay, HrUploadMeta } from "@/lib/hr/types";
import { HrSalesTab } from "@/components/hr/HrSalesTab";
import { HrAttendanceEmployeeRow } from "@/components/hr/HrAttendanceEmployeeRow";
import { HrMailRoutingSettings } from "@/components/hr/HrMailRoutingSettings";
import {
  formatHrAttendanceWindowCaption,
  HR_ATTENDANCE_FROM,
  HR_ATTENDANCE_TO,
} from "@/lib/hr/window";
import { formatHrDateLabel } from "@/lib/hr/time-utils";
import {
  matchesAttendanceCard,
  type HrAttendanceCardFilter,
} from "@/lib/hr/warning-notice";
import {
  SalesDateRangePicker,
  type SalesDateRangeValue,
} from "@/components/sales/SalesDateRangePicker";
import {
  AlertTriangle,
  CalendarOff,
  ChevronDown,
  Clock,
  Loader2,
  Lock,
  Search,
  Timer,
  Upload,
  UserX,
  Users,
} from "lucide-react";

type HrApiResponse = {
  uploads: { timecards: HrUploadMeta[]; schedules: HrUploadMeta[] };
  dates: string[];
  activeDate: string | null;
  employees: HrEmployeeDay[];
  hasTimecard: boolean;
  hasSchedule: boolean;
  scheduleDateFrom: string | null;
  scheduleDateTo: string | null;
  error?: string;
};

function matchesEmployeeSearch(emp: HrEmployeeDay, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [emp.displayName, emp.employeeName, emp.employeeCode, emp.guardsName]
    .filter((s): s is string => Boolean(s?.trim()))
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export default function HrPage() {
  const { state } = useApp();
  const canManageHr =
    state?.user?.authRole === "admin" ||
    state?.user?.authRole === "hr" ||
    Boolean(state?.user?.permissions?.hr_management);
  const salesOnly = !canManageHr;
  const [tab, setTab] = useState<"attendance" | "sales">(salesOnly ? "sales" : "attendance");
  const [data, setData] = useState<HrApiResponse | null>(null);
  const [dateRange, setDateRange] = useState<SalesDateRangeValue>({
    from: HR_ATTENDANCE_TO,
    to: HR_ATTENDANCE_TO,
  });
  const [loading, setLoading] = useState(!salesOnly);
  const [uploading, setUploading] = useState<"timecard" | "schedule" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [cardFilter, setCardFilter] = useState<HrAttendanceCardFilter>("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const uploadMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const timecardInputRef = useRef<HTMLInputElement>(null);
  const scheduleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (salesOnly) setTab("sales");
  }, [salesOnly]);

  const load = useCallback(async (opts?: { from?: string; to?: string; quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("from", opts?.from ?? HR_ATTENDANCE_TO);
      params.set("to", opts?.to ?? HR_ATTENDANCE_TO);
      const res = await fetch(`/api/hr?${params}`, { cache: "no-store" });
      const json = (await res.json()) as HrApiResponse;
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (salesOnly) return;
    void load({ from: dateRange.from, to: dateRange.to });
  }, [load, dateRange.from, dateRange.to, salesOnly]);

  useEffect(() => {
    if (!uploadOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!uploadMenuRef.current?.contains(e.target as Node)) setUploadOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [uploadOpen]);

  const upload = async (kind: "timecard" | "schedule", file: File) => {
    setUploading(kind);
    setStatus(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await fetch("/api/hr", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setStatus(
        kind === "timecard"
          ? `Timecard uploaded (${json.rowCount} rows)`
          : `Schedule uploaded (${json.entryCount} entries)`
      );
      await load({ from: dateRange.from, to: dateRange.to });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const storeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of data?.employees ?? []) {
      if (e.store?.trim()) set.add(e.store.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data?.employees]);

  const designationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of data?.employees ?? []) {
      if (e.jobTitle?.trim()) set.add(e.jobTitle.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data?.employees]);

  useEffect(() => {
    if (storeFilter && !storeOptions.includes(storeFilter)) setStoreFilter("");
  }, [storeFilter, storeOptions]);

  useEffect(() => {
    if (designationFilter && !designationOptions.includes(designationFilter)) {
      setDesignationFilter("");
    }
  }, [designationFilter, designationOptions]);

  const scopedEmployees = useMemo(() => {
    return (data?.employees ?? []).filter((e) => {
      if (storeFilter && (e.store ?? "").trim() !== storeFilter) return false;
      if (designationFilter && (e.jobTitle ?? "").trim() !== designationFilter) return false;
      return true;
    });
  }, [data?.employees, storeFilter, designationFilter]);

  const filteredEmployees = useMemo(() => {
    return scopedEmployees
      .filter((e) => matchesAttendanceCard(e, cardFilter))
      .filter((e) => matchesEmployeeSearch(e, employeeSearch));
  }, [scopedEmployees, cardFilter, employeeSearch]);

  const groupedEmployees = useMemo(() => {
    const map = new Map<string, HrEmployeeDay[]>();
    for (const emp of filteredEmployees) {
      const list = map.get(emp.date) ?? [];
      list.push(emp);
      map.set(emp.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEmployees]);

  const multiDay = dateRange.from !== dateRange.to;

  const kpis = useMemo(() => {
    const list = scopedEmployees;
    return {
      employees: list.length,
      flagged: list.filter((e) => e.violations.length > 0).length,
      late: list.filter((e) => e.lateMinutes != null && e.lateMinutes >= 12).length,
      early: list.filter((e) => e.earlyInMinutes != null && e.earlyInMinutes >= 10).length,
      noSchedule: list.filter((e) => e.violations.some((v) => v.type === "no_schedule")).length,
      absent: list.filter((e) => e.violations.some((v) => v.type === "absent")).length,
    };
  }, [scopedEmployees]);

  function selectCard(kind: HrAttendanceCardFilter) {
    if (kind === "all") {
      setCardFilter("all");
      setEmployeeSearch("");
      requestAnimationFrame(() => searchInputRef.current?.focus());
      return;
    }
    setCardFilter((prev) => (prev === kind ? "all" : kind));
  }

  return (
    <HrWorkspace>
      <header className="hr-header">
        <div>
          <p className="hr-kicker">{salesOnly ? "Sales" : "People ops"}</p>
          <h1 className="hr-title">{salesOnly ? "Sales dashboard" : "HR Management"}</h1>
          <p className="hr-subtitle">
            {salesOnly || tab === "sales"
              ? "Employee sales · Name (CODE) · design totals"
              : `${formatHrAttendanceWindowCaption()} · ADP timecards · schedules · attendance rules`}
          </p>
        </div>
        {canManageHr && (
        <div className="hr-header-actions">
          {tab === "attendance" && (
            <div className="relative" ref={uploadMenuRef}>
              <button
                type="button"
                className="hr-btn hr-btn-outline"
                onClick={() => setUploadOpen((o) => !o)}
                disabled={uploading !== null}
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload
                <ChevronDown size={14} style={{ opacity: 0.7 }} />
              </button>
              {uploadOpen && (
                <div className="hr-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadOpen(false);
                      timecardInputRef.current?.click();
                    }}
                  >
                    Daily Timecard (.xlsx or .csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadOpen(false);
                      scheduleInputRef.current?.click();
                    }}
                  >
                    Schedule (.csv or .xlsx)
                  </button>
                </div>
              )}
              <input
                ref={timecardInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload("timecard", f);
                  e.target.value = "";
                }}
              />
              <input
                ref={scheduleInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload("schedule", f);
                  e.target.value = "";
                }}
              />
            </div>
          )}
          <div className="hr-lock-chip">
            <Lock size={12} />
            Admin / HR
            <HrMailRoutingSettings />
          </div>
        </div>
        )}
      </header>

      {!salesOnly && (
      <div className="hr-tabs" role="tablist" aria-label="HR sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "attendance"}
          className="hr-tab"
          onClick={() => setTab("attendance")}
        >
          Attendance
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sales"}
          className="hr-tab"
          onClick={() => {
            setTab("sales");
            setUploadOpen(false);
          }}
        >
          Sales
        </button>
      </div>
      )}

      {!salesOnly && tab === "attendance" && (data?.dates.length ?? 0) > 0 && (
        <>
          <div className="hr-kpi-grid hr-kpi-grid-6">
            <button
              type="button"
              className={`hr-kpi hr-kpi-btn${cardFilter === "all" ? " hr-kpi-active" : ""}`}
              aria-pressed={cardFilter === "all"}
              onClick={() => selectCard("all")}
            >
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Employees</span>
                <span className="hr-kpi-icon hr-kpi-icon-violet">
                  <Users size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.employees}</div>
            </button>
            <button
              type="button"
              className={`hr-kpi hr-kpi-btn${cardFilter === "flagged" ? " hr-kpi-active" : ""}`}
              aria-pressed={cardFilter === "flagged"}
              onClick={() => selectCard("flagged")}
            >
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Flagged</span>
                <span className="hr-kpi-icon hr-kpi-icon-amber">
                  <AlertTriangle size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.flagged}</div>
            </button>
            <button
              type="button"
              className={`hr-kpi hr-kpi-btn${cardFilter === "late" ? " hr-kpi-active" : ""}`}
              aria-pressed={cardFilter === "late"}
              onClick={() => selectCard("late")}
            >
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Late</span>
                <span className="hr-kpi-icon hr-kpi-icon-rose">
                  <Clock size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.late}</div>
            </button>
            <button
              type="button"
              className={`hr-kpi hr-kpi-btn${cardFilter === "early" ? " hr-kpi-active" : ""}`}
              aria-pressed={cardFilter === "early"}
              onClick={() => selectCard("early")}
            >
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Early</span>
                <span className="hr-kpi-icon hr-kpi-icon-sky">
                  <Timer size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.early}</div>
            </button>
            <button
              type="button"
              className={`hr-kpi hr-kpi-btn${cardFilter === "no_schedule" ? " hr-kpi-active" : ""}`}
              aria-pressed={cardFilter === "no_schedule"}
              onClick={() => selectCard("no_schedule")}
            >
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">No schedule</span>
                <span className="hr-kpi-icon hr-kpi-icon-amber">
                  <CalendarOff size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.noSchedule}</div>
            </button>
            <button
              type="button"
              className={`hr-kpi hr-kpi-btn${cardFilter === "absent" ? " hr-kpi-active" : ""}`}
              aria-pressed={cardFilter === "absent"}
              onClick={() => selectCard("absent")}
            >
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Absent</span>
                <span className="hr-kpi-icon hr-kpi-icon-rose">
                  <UserX size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.absent}</div>
            </button>
          </div>

          <div className="hr-filters">
            <div className="hr-field" style={{ gridColumn: "1 / -1" }}>
              <span className="hr-field-label">Filters</span>
              <div className="flex flex-wrap items-center gap-2">
                <SalesDateRangePicker
                  availableDates={data!.dates}
                  reportRange={{ from: HR_ATTENDANCE_FROM, to: HR_ATTENDANCE_TO }}
                  value={dateRange}
                  onChange={(next) =>
                    setDateRange(next ?? { from: HR_ATTENDANCE_FROM, to: HR_ATTENDANCE_TO })
                  }
                />
                <label className="hr-field" style={{ minWidth: "10rem" }}>
                  <span className="sr-only">Store</span>
                  <select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    className="hr-select"
                    aria-label="Filter by store"
                  >
                    <option value="">All stores</option>
                    {storeOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="hr-field" style={{ minWidth: "10rem" }}>
                  <span className="sr-only">Designation</span>
                  <select
                    value={designationFilter}
                    onChange={(e) => setDesignationFilter(e.target.value)}
                    className="hr-select"
                    aria-label="Filter by designation"
                  >
                    <option value="">All designations</option>
                    {designationOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <label className="hr-field" style={{ gridColumn: "1 / -1" }}>
              <span className="hr-field-label">Search employees</span>
              <span className="hr-search">
                <Search size={14} />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="hr-input"
                  placeholder="Code or name"
                  aria-label="Search employees by code or name"
                />
              </span>
            </label>
            <div className="hr-filter-meta">
              <span>{formatHrAttendanceWindowCaption()}</span>
              {kpis.flagged > 0 && (
                <span className="hr-flag-count">
                  <AlertTriangle size={13} />
                  {kpis.flagged} employee(s) with flags
                </span>
              )}
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: "1.1rem" }}>
        {salesOnly || tab === "sales" ? (
          <HrSalesTab />
        ) : (
          <>
            {uploading && (
              <div className="hr-upload-row">
                <Loader2 size={16} className="animate-spin" /> Uploading {uploading}…
              </div>
            )}
            {status && <div className="hr-alert hr-alert-ok">{status}</div>}
            {error && <div className="hr-alert hr-alert-err">{error}</div>}

            {loading && data && (
              <div className="hr-upload-row">
                <Loader2 size={16} className="animate-spin" /> Loading attendance…
              </div>
            )}
            {loading && !data ? (
              <div className="flex justify-center py-16" style={{ color: "#8b95a5" }}>
                <Loader2 className="animate-spin" />
              </div>
            ) : !data?.hasTimecard ? (
              <div className="hr-empty">Upload a Daily Timecard xlsx and ADP schedule csv to begin.</div>
            ) : (
              <div className="hr-list">
                {!data.hasSchedule && (
                  <div className="hr-alert hr-alert-warn">
                    No schedule loaded — upload the schedule csv (Date / Employee Name / Time In /
                    Time Out, or weekly ADP grid). Re-upload if you saw &quot;0 entries&quot;.
                  </div>
                )}
                {data.hasSchedule &&
                  data.scheduleDateFrom &&
                  data.scheduleDateTo &&
                  (dateRange.to < data.scheduleDateFrom || dateRange.from > data.scheduleDateTo) && (
                    <div className="hr-alert hr-alert-warn">
                      Selected dates are outside the uploaded schedule (
                      {data.scheduleDateFrom} → {data.scheduleDateTo}). Pick a matching range or
                      upload a schedule that covers these days.
                    </div>
                  )}
                {data.hasSchedule && !data.scheduleDateFrom && (
                  <div className="hr-alert hr-alert-warn">
                    Schedule file uploaded — late/early checks need a schedule row for the selected day.
                  </div>
                )}
                {filteredEmployees.length === 0 ? (
                  <div className="hr-empty">No employees match these filters.</div>
                ) : (
                  groupedEmployees.map(([day, rows]) => (
                    <div key={day} className="hr-day-group">
                      {multiDay && <div className="hr-day-label">{formatHrDateLabel(day)}</div>}
                      {rows.map((emp) => (
                        <HrAttendanceEmployeeRow
                          key={`${emp.date}:${emp.employeeName}`}
                          emp={emp}
                          onChanged={() =>
                            void load({ from: dateRange.from, to: dateRange.to, quiet: true })
                          }
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </HrWorkspace>
  );
}
