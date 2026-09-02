"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { PageShell, PageShellHeader, PageShellBody } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { HrEmployeeDay, HrUploadMeta } from "@/lib/hr/types";
import { HrSalesTab } from "@/components/hr/HrSalesTab";
import { HrAttendanceEmployeeRow } from "@/components/hr/HrAttendanceEmployeeRow";
import { formatHrAttendanceWindowCaption } from "@/lib/hr/window";
import { formatHrDateLabel } from "@/lib/hr/time-utils";
import { Briefcase, Clock, Loader2, Upload } from "lucide-react";

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

export default function HrPage() {
  const [tab, setTab] = useState<"attendance" | "sales">("attendance");
  const [data, setData] = useState<HrApiResponse | null>(null);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"timecard" | "schedule" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
              <HrAttendanceEmployeeRow
                key={emp.employeeName}
                emp={emp}
                onChanged={() => void load({ date, quiet: true })}
              />
            ))}
          </div>
        )}
          </>
        )}
      </PageShellBody>
    </PageShell>
  );
}
