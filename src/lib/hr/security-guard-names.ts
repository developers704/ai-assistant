/**
 * Payroll / schedule names like "1, Security Guard" map to the person
 * who actually works that post. Prefer the timecard Guards Name column
 * when it is filled; otherwise use this table (case-insensitive id match).
 * Guards 5 and 7 are not on the sheet — leave those payroll labels as-is.
 */
export const SECURITY_GUARD_PROPER_NAME_BY_ID: Record<number, string> = {
  1: "Syed Muqeet Asim",
  2: "Muhammad Aleem",
  3: "Akber Shaik",
  4: "Mohammad Azeem",
  6: "Mohammad Akram",
  8: "Sultan Ansari",
  9: "Tayab Abdul",
};

const GUARD_ID_RE = /^(\d+)\s*,?\s*security\s+guards?$/i;

export function securityGuardIdFromPayrollName(name: string): number | null {
  const m = String(name ?? "").trim().match(GUARD_ID_RE);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) ? id : null;
}

export function isNumberedSecurityGuardName(name: string): boolean {
  return securityGuardIdFromPayrollName(name) != null;
}

export function resolveHrEmployeeDisplayName(
  payrollName: string,
  guardsName?: string | null
): string {
  const fromSheet = String(guardsName ?? "").trim();
  if (fromSheet) return fromSheet;
  const id = securityGuardIdFromPayrollName(payrollName);
  if (id != null) {
    const mapped = SECURITY_GUARD_PROPER_NAME_BY_ID[id];
    if (mapped) return mapped;
  }
  return String(payrollName ?? "").trim();
}
