import { securityGuardIdFromPayrollName } from "./security-guard-names";
import type { HrTimecardRow } from "./types";

/** Attendance roster is Sales Associate + Manager only (Designation column). */
export function isHrSalesOrManagerTitle(jobTitle?: string | null): boolean {
  const t = String(jobTitle ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (!t) return false;
  if (t === "SALES ASSOCIATE" || t.endsWith(" SALES ASSOCIATE")) return true;
  if (t === "MANAGER" || t.endsWith(" MANAGER")) return true;
  return false;
}

export function isExcludedHrAttendancePerson(
  payrollName: string,
  guardsName?: string | null
): boolean {
  const parts = [payrollName, guardsName ?? ""];
  if (parts.some((n) => securityGuardIdFromPayrollName(n) === 1)) return true;
  if (parts.some((n) => /syed\s+muqeet\s+asim/i.test(n))) return true;
  return false;
}

export function keepHrAttendanceTimecardRow(row: HrTimecardRow): boolean {
  if (isExcludedHrAttendancePerson(row.employeeName, row.guardsName)) return false;
  return isHrSalesOrManagerTitle(row.jobTitle);
}

export function keepHrAttendanceEmployee(
  payrollName: string,
  profileRows: HrTimecardRow[]
): boolean {
  const guardsName =
    profileRows.find((r) => r.guardsName?.trim())?.guardsName ?? null;
  if (isExcludedHrAttendancePerson(payrollName, guardsName)) return false;
  const title = profileRows.find((r) => r.jobTitle?.trim())?.jobTitle ?? null;
  return isHrSalesOrManagerTitle(title);
}
