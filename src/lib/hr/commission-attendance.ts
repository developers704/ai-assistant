import type { HrScheduleEntry, HrTimecardRow, HrWarningNotice } from "@/lib/hr/types";
import { employeeNameTokens, namesMatch } from "@/lib/hr/name-match";
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

const directoryNamesMemo = new Map<string, string[]>();

export function directoryNamesForCode(code: string): string[] {
  const key = code.trim().toUpperCase();
  const hit = directoryNamesMemo.get(key);
  if (hit) return hit;
  const dir = loadSalespersonDirectory().get(key);
  const out = dir
    ? [dir.displayName, `${dir.lastName}, ${dir.firstName}`, `${dir.firstName} ${dir.lastName}`].filter(
        (n) => n.replace(/[^a-z]/gi, "").length > 2
      )
    : [];
  directoryNamesMemo.set(key, out);
  return out;
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
  for (const n of directoryNamesForCode(key)) {
    if (namesMatch(employeeName, n)) return true;
    if (guardsName && namesMatch(guardsName, n)) return true;
  }
  return false;
}

export type AssociateRowIndex<T> = {
  byCode: Map<string, T[]>;
  byLast: Map<string, T[]>;
};

function pushIndex<T>(map: Map<string, T[]>, key: string, row: T) {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(row);
  else map.set(key, [row]);
}

export function indexTimecardRows(
  rows: HrTimecardRow[],
  dateSet: Set<string>
): AssociateRowIndex<HrTimecardRow> {
  const byCode = new Map<string, HrTimecardRow[]>();
  const byLast = new Map<string, HrTimecardRow[]>();
  for (const r of rows) {
    if (!dateSet.has(r.date)) continue;
    pushIndex(byCode, (r.employeeCode ?? "").trim().toUpperCase(), r);
    pushIndex(byLast, employeeNameTokens(r.employeeName)[0] ?? "", r);
    if (r.guardsName) pushIndex(byLast, employeeNameTokens(r.guardsName)[0] ?? "", r);
  }
  return { byCode, byLast };
}

export function indexScheduleRows(
  rows: HrScheduleEntry[],
  dateSet: Set<string>
): AssociateRowIndex<HrScheduleEntry> {
  const byCode = new Map<string, HrScheduleEntry[]>();
  const byLast = new Map<string, HrScheduleEntry[]>();
  for (const r of rows) {
    if (!dateSet.has(r.date)) continue;
    pushIndex(byLast, employeeNameTokens(r.employeeName)[0] ?? "", r);
  }
  return { byCode, byLast };
}

function collectIndexedRows<T>(
  index: AssociateRowIndex<T>,
  code: string,
  extraLastTokens: string[]
): T[] {
  const key = code.trim().toUpperCase();
  const seen = new Set<T>();
  const out: T[] = [];
  const consider = (rows?: T[]) => {
    if (!rows) return;
    for (const r of rows) {
      if (seen.has(r)) continue;
      seen.add(r);
      out.push(r);
    }
  };
  consider(index.byCode.get(key));
  for (const n of directoryNamesForCode(key)) {
    consider(index.byLast.get(employeeNameTokens(n)[0] ?? ""));
  }
  consider(index.byLast.get(employeeNameTokens(key)[0] ?? ""));
  for (const tok of extraLastTokens) consider(index.byLast.get(tok));
  return out;
}

export type HrAttendanceIndex = {
  dateSet: Set<string>;
  punches: AssociateRowIndex<HrTimecardRow>;
  schedule: AssociateRowIndex<HrScheduleEntry>;
};

export function buildHrAttendanceIndex(
  from: string,
  to: string,
  punches: HrTimecardRow[],
  schedule: HrScheduleEntry[]
): HrAttendanceIndex {
  const dateSet = new Set(datesInIsoRange(from, to));
  return {
    dateSet,
    punches: indexTimecardRows(punches, dateSet),
    schedule: indexScheduleRows(schedule, dateSet),
  };
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
  schedule: HrScheduleEntry[],
  index?: HrAttendanceIndex
): CommissionAttendance {
  const dateSet = index?.dateSet ?? new Set(datesInIsoRange(from, to));
  const punchCandidates = index
    ? collectIndexedRows(index.punches, code, [])
    : punches;
  const punchRows = punchCandidates.filter(
    (r) =>
      dateSet.has(r.date) &&
      hrRowsMatchAssociate(code, r.employeeName, r.employeeCode, r.guardsName)
  );
  const punchNames = [...new Set(punchRows.map((r) => r.employeeName))];
  const extraLast = punchNames.map((n) => employeeNameTokens(n)[0] ?? "").filter(Boolean);
  const scheduleCandidates = index
    ? collectIndexedRows(index.schedule, code, extraLast)
    : schedule;
  const schedRows = scheduleCandidates.filter((e) => {
    if (!dateSet.has(e.date)) return false;
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

/**
 * Commission header `present/scheduled` uses punches, then adds waived
 * scheduled no-punch days so a waived absence reads as 21/21 · 0 absent
 * instead of 20/21 · 0 absent.
 */
export function presentDaysWithWaivedAbsences(
  presentDays: number,
  rawAbsentDates: string[],
  unwaivedAbsent: string[]
): number {
  const waived = rawAbsentDates.filter((date) => !unwaivedAbsent.includes(date)).length;
  return presentDays + Math.max(0, waived);
}

export function scheduleWarningIssueKind(
  notice: Pick<HrWarningNotice, "caseId">
): "late" | "early" | "early_out" {
  const id = notice.caseId.toUpperCase();
  if (id.includes("-EARLY-")) return "early";
  if (id.includes("-LEAVE-")) return "early_out";
  return "late";
}

export function scheduleWarningIssueLabel(
  notice: Pick<HrWarningNotice, "caseId" | "description" | "lateMinutes">
): string {
  const desc = (notice.description ?? "").trim().replace(/\.$/, "");
  if (desc) return desc;
  const kind = scheduleWarningIssueKind(notice);
  const mins = notice.lateMinutes;
  if (kind === "early") return mins ? `Arrived early ${mins} min` : "Schedule warning";
  if (kind === "early_out") return mins ? `Left early ${mins} min` : "Schedule warning";
  return mins ? `Late arrival ${mins} min` : "Schedule warning";
}

/**
 * Commission Violations list = header counts only:
 * unwaived absences + unwaived sent schedule warnings.
 * Punch-level early/late days are not listed unless a warning was sent.
 */
export function countedCommissionViolations(opts: {
  unwaivedAbsentDates: string[];
  warnings: HrWarningNotice[];
}): CommissionAttendanceIssue[] {
  const absents: CommissionAttendanceIssue[] = opts.unwaivedAbsentDates.map((date) => ({
    date,
    kind: "absent",
    label: "Absent",
  }));
  const warns: CommissionAttendanceIssue[] = opts.warnings.map((n) => ({
    date: n.date,
    kind: scheduleWarningIssueKind(n),
    label: scheduleWarningIssueLabel(n),
  }));
  return [...absents, ...warns].sort(
    (a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind)
  );
}
