"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HrWorkspace } from "@/components/hr/HrWorkspace";
import type { HrEmployeeDay, HrUploadMeta } from "@/lib/hr/types";
import { HrSalesTab } from "@/components/hr/HrSalesTab";
import { HrAttendanceEmployeeRow } from "@/components/hr/HrAttendanceEmployeeRow";
import { HrMailRoutingSettings } from "@/components/hr/HrMailRoutingSettings";
import { formatHrAttendanceWindowCaption } from "@/lib/hr/window";
import { formatHrDateLabel } from "@/lib/hr/time-utils";
import {
  HR_VIOLATION_FILTER_LABELS,
  HR_VIOLATION_FILTER_OPTIONS,
  matchesViolationFilter,
  type HrViolationFilter,
} from "@/lib/hr/warning-notice";
import { SalesMultiSelectFilter } from "@/components/sales/SalesMultiSelectFilter";
import {
  AlertTriangle,
  CalendarOff,
  ChevronDown,
  Clock,
  Loader2,
  Lock,
  Timer,
  Upload,
  Users,
  Utensils,
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

function isMealViolation(emp: HrEmployeeDay): boolean {
  return emp.violations.some(
    (v) =>
      v.type === "long_meal" ||
      v.type === "excessive_meal_total" ||
      v.type === "short_meal_total" ||
      v.type === "meal_count"
  );
}

export default function HrPage() {
  const [tab, setTab] = useState<"attendance" | "sales">("attendance");
  const [data, setData] = useState<HrApiResponse | null>(null);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"timecard" | "schedule" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [violationFilter, setViolationFilter] = useState<HrViolationFilter[]>(["all"]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const uploadMenuRef = useRef<HTMLDivElement>(null);
  const timecardInputRef = useRef<HTMLInputElement>(null);
  const scheduleInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (opts?: { date?: string; quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (opts?.date) params.set("date", opts.date);
      const res = await fetch(`/api/hr?${params}`, { cache: "no-store" });
      const json = (await res.json()) as HrApiResponse;
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
      if (json.activeDate) setDate(json.activeDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date ? { date } : undefined);
  }, [load, date]);

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
      await load({ date });
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

  const filteredEmployees = useMemo(() => {
    return (data?.employees ?? []).filter((e) => {
      if (storeFilter && (e.store ?? "").trim() !== storeFilter) return false;
      if (designationFilter && (e.jobTitle ?? "").trim() !== designationFilter) return false;
      if (!matchesViolationFilter(e, violationFilter)) return false;
      return true;
    });
  }, [data?.employees, storeFilter, designationFilter, violationFilter]);

  const kpis = useMemo(() => {
    const list = filteredEmployees;
    return {
      employees: list.length,
      flagged: list.filter((e) => e.violations.length > 0).length,
      late: list.filter((e) => e.lateMinutes != null && e.lateMinutes >= 12).length,
      early: list.filter((e) => e.earlyInMinutes != null && e.earlyInMinutes >= 10).length,
      meal: list.filter(isMealViolation).length,
      noSchedule: list.filter((e) => e.violations.some((v) => v.type === "no_schedule")).length,
    };
  }, [filteredEmployees]);

  return (
    <HrWorkspace>
      <header className="hr-header">
        <div>
          <p className="hr-kicker">People ops</p>
          <h1 className="hr-title">HR Management</h1>
          <p className="hr-subtitle">
            {tab === "sales"
              ? "Employee sales · Name (CODE) · design totals"
              : `${formatHrAttendanceWindowCaption()} · ADP timecards · schedules · meal break & attendance rules`}
          </p>
        </div>
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
            Admin only
            <HrMailRoutingSettings />
          </div>
        </div>
      </header>

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

      {tab === "attendance" && (data?.dates.length ?? 0) > 0 && (
        <>
          <div className="hr-kpi-grid">
            <div className="hr-kpi">
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Employees</span>
                <span className="hr-kpi-icon hr-kpi-icon-violet">
                  <Users size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.employees}</div>
            </div>
            <div className="hr-kpi">
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Flagged</span>
                <span className="hr-kpi-icon hr-kpi-icon-amber">
                  <AlertTriangle size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.flagged}</div>
            </div>
            <div className="hr-kpi">
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Late</span>
                <span className="hr-kpi-icon hr-kpi-icon-rose">
                  <Clock size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.late}</div>
            </div>
            <div className="hr-kpi">
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Early</span>
                <span className="hr-kpi-icon hr-kpi-icon-sky">
                  <Timer size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.early}</div>
            </div>
            <div className="hr-kpi">
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">Meal</span>
                <span className="hr-kpi-icon hr-kpi-icon-teal">
                  <Utensils size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.meal}</div>
            </div>
            <div className="hr-kpi">
              <div className="hr-kpi-top">
                <span className="hr-kpi-label">No schedule</span>
                <span className="hr-kpi-icon hr-kpi-icon-amber">
                  <CalendarOff size={14} />
                </span>
              </div>
              <div className="hr-kpi-value">{kpis.noSchedule}</div>
            </div>
          </div>

          <div className="hr-filters">
            <label className="hr-field">
              <span className="hr-field-label">Date</span>
              <select
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="hr-select"
                aria-label={`Attendance date, ${formatHrAttendanceWindowCaption()}`}
              >
                {data!.dates.map((d) => (
                  <option key={d} value={d}>
                    {formatHrDateLabel(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="hr-field">
              <span className="hr-field-label">Store</span>
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
            <label className="hr-field">
              <span className="hr-field-label">Designation</span>
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
            <div className="hr-field">
              <span className="hr-field-label">Violations</span>
              <SalesMultiSelectFilter
                label="Violation"
                allLabel="All violation"
                options={[...HR_VIOLATION_FILTER_OPTIONS]}
                value={violationFilter.includes("all") ? [] : violationFilter.filter((v) => v !== "all")}
                treatEmptyAsAllValue="all"
                fullWidth
                formatOption={(v) => HR_VIOLATION_FILTER_LABELS[v as HrViolationFilter] ?? v}
                onChange={(next) =>
                  setViolationFilter(
                    next.length === 0 || next.includes("all")
                      ? ["all"]
                      : next.filter((v): v is Exclude<HrViolationFilter, "all"> => v !== "all")
                  )
                }
              />
            </div>
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
        {tab === "sales" ? (
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
                  data.activeDate &&
                  (data.activeDate < data.scheduleDateFrom || data.activeDate > data.scheduleDateTo) && (
                    <div className="hr-alert hr-alert-warn">
                      Timecard day <strong>{data.activeDate}</strong> is outside the uploaded schedule (
                      {data.scheduleDateFrom} → {data.scheduleDateTo}). Pick a matching date or upload a
                      schedule that covers this day.
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
                  filteredEmployees.map((emp) => (
                    <HrAttendanceEmployeeRow
                      key={emp.employeeName}
                      emp={emp}
                      onChanged={() => void load({ date, quiet: true })}
                    />
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
