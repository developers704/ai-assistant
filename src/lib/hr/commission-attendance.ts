import type { HrEmployeeDay, HrScheduleEntry, HrTimecardRow } from "@/lib/hr/types";
import { namesMatch } from "@/lib/hr/name-match";
import { datesInIsoRange } from "@/lib/hr/window";
import { loadSalespersonDirectory } from "@/lib/sales/salesperson-directory";
import { posStoreCodeFromHrStore } from "@/lib/hr/hr-store-pos";
import type { CommissionAttendanceIssue } from "@/lib/hr/commission";

export type CommissionAttendance = {
  payrollName: string | null;
  employeeCode: string | null;
  hrStore: string | null;
  posStore: string | null;
  scheduledDays: number;
  presentDays: number;
  absences: number;
  scheduledDates: string[];
  presentDates: string[];
  absentDates: string[];
};

function directoryNames(code: string): string[] {
  const dir = loadSalespersonDirectory().get(code.trim().toUpperCase());
  if (!dir) return [];
  const out = [dir.displayName, `${dir.lastName}, ${dir.firstName}`, `${dir.firstName} ${dir.lastName}`];
  return out.filter((n) => n.replace(/[^a-z]/gi, "").length > 2);
}

export function hrRowsMatchAssociate(
  code: string,
  employeeName: string,
  employeeCode?: string | null,
  guardsName?: string | null
): boolean {
  const key = code.trim().toUpperCase();
  if ((employeeCode ?? "").trim().toUpperCase() === key) return true;
  if (namesMatch(employeeName, key)) return true;
  for (const n of directoryNames(key)) {
    if (namesMatch(employeeName, n)) return true;
    if (guardsName && namesMatch(guardsName, n)) return true;
  }
  return false;
}

/**
 * Absence = scheduled day in the window with no timecard punch.
 * Unscheduled days never count as absences.
 */
export function commissionAttendanceForAssociate(
  code: string,
  from: string,
  to: string,
  punches: HrTimecardRow[],
  schedule: HrScheduleEntry[]
): CommissionAttendance {
  const dates = new Set(datesInIsoRange(from, to));
  const punchRows = punches.filter(
    (r) =>
      dates.has(r.date) &&
      hrRowsMatchAssociate(code, r.employeeName, r.employeeCode, r.guardsName)
  );
  const punchNames = [...new Set(punchRows.map((r) => r.employeeName))];
  const schedRows = schedule.filter((e) => {
    if (!dates.has(e.date)) return false;
    if (hrRowsMatchAssociate(code, e.employeeName)) return true;
    return punchNames.some((n) => namesMatch(n, e.employeeName));
  });

  const scheduledDates = [...new Set(schedRows.map((e) => e.date))].sort();
  const presentSet = new Set(punchRows.filter((r) => scheduledDates.includes(r.date)).map((r) => r.date));
  const presentDates = scheduledDates.filter((d) => presentSet.has(d));
  const absentDates = scheduledDates.filter((d) => !presentSet.has(d));

  const storeFromPunch = punchRows.find((r) => (r.store ?? "").trim())?.store ?? null;

  return {
    payrollName: punchRows[0]?.employeeName ?? schedRows[0]?.employeeName ?? null,
    employeeCode: punchRows.find((r) => r.employeeCode)?.employeeCode ?? code,
    hrStore: storeFromPunch,
    posStore: posStoreCodeFromHrStore(storeFromPunch),
    scheduledDays: scheduledDates.length,
    presentDays: presentDates.length,
    absences: absentDates.length,
    scheduledDates,
    presentDates,
    absentDates,
  };
}

export function commissionIssuesFromDays(days: HrEmployeeDay[]): CommissionAttendanceIssue[] {
  const issues: CommissionAttendanceIssue[] = [];
  for (const day of days) {
    if (day.violations.some((v) => v.type === "absent")) {
      issues.push({ date: day.date, kind: "absent", label: "Absent" });
    }
    if (day.lateMinutes != null && day.lateMinutes >= 12) {
      issues.push({
        date: day.date,
        kind: "late",
        label: `Late arrival ${day.lateMinutes} min`,
      });
    }
    if (day.earlyInMinutes != null && day.earlyInMinutes >= 10) {
      issues.push({
        date: day.date,
        kind: "early",
        label: `Arrived early ${day.earlyInMinutes} min`,
      });
    }
    if (day.earlyOutMinutes != null && day.earlyOutMinutes >= 10) {
      issues.push({
        date: day.date,
        kind: "early_out",
        label: `Left early ${day.earlyOutMinutes} min`,
      });
    }
  }
  return issues.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}
