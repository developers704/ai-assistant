"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { PageShell, PageShellHeader, PageShellBody } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { HrEmployeeDay, HrUploadMeta, HrViolation } from "@/lib/hr/types";
import { HrSalesTab } from "@/components/hr/HrSalesTab";
import {
  formatHrAttendanceWindowCaption,
  MISSING_PUNCH_LABEL,
} from "@/lib/hr/window";
import { formatHrDateLabel } from "@/lib/hr/time-utils";
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Upload,
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

function violationBadge(v: HrViolation) {
  const colors: Record<string, string> = {
    missing_punch: "bg-rose-500/20 text-rose-200 ring-rose-400/30",
    late: "bg-orange-500/20 text-orange-100 ring-orange-400/30",
    early_in: "bg-sky-500/20 text-sky-100 ring-sky-400/30",
    no_schedule: "bg-amber-500/20 text-amber-100 ring-amber-400/30",
    long_meal: "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/30",
    short_meal_total: "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/30",
    excessive_meal_total: "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/30",
    meal_count: "bg-violet-500/20 text-violet-100 ring-violet-400/30",
  };
  return (
    <span
      key={`${v.type}-${v.message}`}
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-xs ring-1",
        colors[v.type] ?? "bg-white/10 text-white/70 ring-white/20"
      )}
    >
      {v.message}
    </span>
  );
}

function EmployeeRow({ emp }: { emp: HrEmployeeDay }) {
  const [open, setOpen] = useState(false);
  const hasError = emp.violations.some((v) => v.severity === "error");

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden",
        hasError && "ring-1 ring-rose-400/40"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04]"
      >
        {open ? (
          <ChevronDown size={16} className="text-white/40 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-white/40 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white truncate">{emp.employeeName}</div>
          <div className="text-xs text-white/45 mt-0.5">
            {emp.schedule
              ? `Scheduled ${emp.schedule.start} – ${emp.schedule.end} (${emp.schedule.scheduledLabel})`
              : "No schedule on file"}
          </div>
          <div className="flex flex-wrap gap-2 mt-1.5">
            <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-100 ring-1 ring-emerald-400/25">
              Worked Hrs {emp.totalWorkLabel}
            </span>
            <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-100 ring-1 ring-amber-400/25">
              Meal {emp.totalMealMinutes} min
              {emp.expectedMealMinutes > 0 && (
                <span className="text-amber-200/60 font-normal"> / {emp.expectedMealMinutes}</span>
              )}
            </span>
            {emp.schedule && (
              <span className="inline-flex items-center rounded-md bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-100 ring-1 ring-sky-400/25">
                Schedule hrs {emp.schedule.scheduledLabel}
              </span>
            )}
            {emp.lateMinutes != null && emp.lateMinutes >= 12 && (
              <span className="inline-flex items-center rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-100 ring-1 ring-orange-400/25">
                Late {emp.lateMinutes} min
              </span>
            )}
            {emp.earlyInMinutes != null && emp.earlyInMinutes >= 10 && (
              <span className="inline-flex items-center rounded-md bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-100 ring-1 ring-violet-400/30">
                Early {emp.earlyInMinutes} min
              </span>
            )}
          </div>
        </div>
        {emp.violations.length > 0 && (
          <AlertTriangle size={16} className={hasError ? "text-rose-400" : "text-amber-400"} />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {emp.violations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {emp.violations.map((v) => violationBadge(v))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs">
                  <th className="pb-2 pr-3">Time In</th>
                  <th className="pb-2 pr-3">Time Out</th>
                  <th className="pb-2 pr-3">Gap</th>
                  <th className="pb-2 pr-3">Work</th>
                  <th className="pb-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {emp.segments.map((seg, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "border-t border-white/5",
                      seg.violations.length > 0 && "bg-rose-500/5"
                    )}
                  >
                    <td className={cn("py-2 pr-3 tabular-nums", !seg.timeIn?.trim() && "text-rose-300")}>
                      {seg.timeIn?.trim() ? seg.timeIn : MISSING_PUNCH_LABEL}
                    </td>
                    <td className={cn("py-2 pr-3 tabular-nums", !seg.timeOut?.trim() && "text-rose-300")}>
                      {seg.timeOut?.trim() ? seg.timeOut : MISSING_PUNCH_LABEL}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-white/60">
                      {seg.gapMinutes != null ? (
                        <span
                          className={cn(
                            seg.gapKind === "meal_break" && "text-amber-200",
                            seg.gapKind === "short_break" && "text-white/40"
                          )}
                        >
                          {seg.gapFromPrevious ?? `${Math.floor(seg.gapMinutes / 60)}:${String(seg.gapMinutes % 60).padStart(2, "0")}`}
                          {seg.gapKind === "meal_break" && " · meal"}
                          {seg.gapKind === "short_break" && " · rest"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{seg.workLabel}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {seg.violations.map((v) => violationBadge(v))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {emp.shiftTier && (
            <p className="text-xs text-white/40">
              Shift tier: {emp.shiftTier === "ten" ? "≤10h" : emp.shiftTier === "eleven" ? "11h" : "≥12h"}
              {" · "}Expected {emp.expectedMealCount} meal(s), {emp.expectedMealMinutes} min total
              {" · "}Short/rest breaks: {emp.shortBreaks.length}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 ring-1 ring-emerald-400/20">
              <div className="text-[10px] uppercase tracking-wide text-emerald-200/60">Worked Hrs</div>
              <div className="text-lg font-semibold text-emerald-50 tabular-nums">{emp.totalWorkLabel}</div>
            </div>
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 ring-1 ring-amber-400/20">
              <div className="text-[10px] uppercase tracking-wide text-amber-200/60">Total meal break</div>
              <div className="text-lg font-semibold text-amber-50 tabular-nums">
                {emp.totalMealMinutes} min
              </div>
            </div>
            {emp.schedule && (
              <div className="rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/10 col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase tracking-wide text-white/40">Scheduled</div>
                <div className="text-sm font-medium text-white/90">
                  {emp.schedule.start} – {emp.schedule.end}{" "}
                  <span className="text-white/50">({emp.schedule.scheduledLabel})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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

  const load = useCallback(async (opts?: { date?: string }) => {
    setLoading(true);
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

  const violationCount = useMemo(
    () => data?.employees.filter((e) => e.violations.length > 0).length ?? 0,
    [data?.employees]
  );

  return (
    <PageShell accent="indigo">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Admin"
          title="HR Management"
          subtitle={
            tab === "sales"
              ? "Employee sales · Name (CODE) · products like Sales Dashboard"
              : `${formatHrAttendanceWindowCaption()} · ADP timecards · schedules · meal break & attendance rules`
          }
          action={
            <Badge variant="info" className="gap-1.5">
              <Briefcase size={14} />
              Admin only
            </Badge>
          }
        />

        <div className="mt-4 flex gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10 w-fit">
          <button
            type="button"
            onClick={() => setTab("attendance")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "attendance"
                ? "bg-indigo-500/30 text-white ring-1 ring-indigo-400/40"
                : "text-white/55 hover:text-white"
            )}
          >
            Attendance
          </button>
          <button
            type="button"
            onClick={() => setTab("sales")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "sales"
                ? "bg-indigo-500/30 text-white ring-1 ring-indigo-400/40"
                : "text-white/55 hover:text-white"
            )}
          >
            Sales
          </button>
        </div>

        {tab === "attendance" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 cursor-pointer hover:bg-white/[0.05]">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <Upload size={16} /> Daily Timecard (.xlsx or .csv)
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="text-xs text-white/50"
              disabled={uploading !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload("timecard", f);
                e.target.value = "";
              }}
            />
            {data?.uploads.timecards[0] && (
              <span className="text-xs text-white/35 truncate">
                Latest: {data.uploads.timecards[0].fileName}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 cursor-pointer hover:bg-white/[0.05]">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <Upload size={16} /> Schedule (.csv or .xlsx)
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="text-xs text-white/50"
              disabled={uploading !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload("schedule", f);
                e.target.value = "";
              }}
            />
            {data?.uploads.schedules[0] && (
              <span className="text-xs text-white/35 truncate">
                Latest: {data.uploads.schedules[0].fileName}
                {data.uploads.schedules[0].dateFrom && data.uploads.schedules[0].dateTo
                  ? ` (${data.uploads.schedules[0].dateFrom} → ${data.uploads.schedules[0].dateTo})`
                  : ""}
              </span>
            )}
          </label>
        </div>
        )}

        {tab === "attendance" && (data?.dates.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Clock size={16} className="text-white/40" />
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="select-dark rounded-xl px-3 py-2 text-sm"
              aria-label={`Attendance date, ${formatHrAttendanceWindowCaption()}`}
            >
              {data!.dates.map((d) => (
                <option key={d} value={d}>
                  {formatHrDateLabel(d)}
                </option>
              ))}
            </select>
            <span className="text-xs text-white/45">{formatHrAttendanceWindowCaption()}</span>
            {violationCount > 0 && (
              <span className="text-sm text-amber-200/90">
                {violationCount} employee(s) with flags
              </span>
            )}
          </div>
        )}
      </PageShellHeader>

      <PageShellBody>
        {tab === "sales" ? (
          <HrSalesTab />
        ) : (
          <>
        {uploading && (
          <div className="mb-3 flex items-center gap-2 text-sm text-white/60">
            <Loader2 size={16} className="animate-spin" /> Uploading {uploading}…
          </div>
        )}
        {status && (
          <div className="mb-3 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/25 px-3 py-2 text-sm text-emerald-100">
            {status}
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-xl bg-rose-500/10 ring-1 ring-rose-400/25 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-16 text-white/40">
            <Loader2 className="animate-spin" />
          </div>
        ) : !data?.hasTimecard ? (
          <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/45">
            Upload a Daily Timecard xlsx and ADP schedule csv to begin.
          </div>
        ) : (
          <div className="space-y-2">
            {!data.hasSchedule && (
              <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-400/25 px-3 py-2 text-sm text-amber-100 mb-3">
                No schedule loaded — upload the weekly ADP schedule csv (re-upload if you saw
                &quot;0 entries&quot;).
              </div>
            )}
            {data.hasSchedule &&
              data.scheduleDateFrom &&
              data.scheduleDateTo &&
              data.activeDate &&
              (data.activeDate < data.scheduleDateFrom ||
                data.activeDate > data.scheduleDateTo) && (
                <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-400/25 px-3 py-2 text-sm text-amber-100 mb-3">
                  Timecard day <strong>{data.activeDate}</strong> is outside the uploaded
                  schedule ({data.scheduleDateFrom} → {data.scheduleDateTo}). Pick a matching
                  date or upload a schedule that covers this day.
                </div>
              )}
            {data.hasSchedule && !data.scheduleDateFrom && (
              <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-400/25 px-3 py-2 text-sm text-amber-100 mb-3">
                Schedule file uploaded — late/early checks need a schedule row for the selected
                day.
              </div>
            )}
            {data.employees.map((emp) => (
              <EmployeeRow key={emp.employeeName} emp={emp} />
            ))}
          </div>
        )}
          </>
        )}
      </PageShellBody>
    </PageShell>
  );
}
