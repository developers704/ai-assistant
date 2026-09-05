/** Associate payroll commission — not calculator customer-offer rates. */

export type DesignCommissionRate = {
  key: string;
  label: string;
  /** Full company rate (unused for payroll; documented for the sheet). */
  fullRate: number;
  /** Employee base commission rate (half of full). */
  employeeRate: number;
};

export const DESIGN_COMMISSION_RATES: DesignCommissionRate[] = [
  { key: "linknlock", label: "Link N Lock", fullRate: 0.04, employeeRate: 0.02 },
  { key: "lovespell", label: "Love Spell", fullRate: 0.03, employeeRate: 0.015 },
  { key: "oroventi", label: "Oroventi", fullRate: 0.03, employeeRate: 0.015 },
  { key: "uv", label: "Ultimate Value (UV)", fullRate: 0.01, employeeRate: 0.005 },
];

export const OTHER_DESIGN_EMPLOYEE_RATE = 0.01;
export const OTHER_DESIGN_FULL_RATE = 0.02;

/** Max unwaived absences that still pass extras: 0. One or more unwaived absences → base only. */
export const ATTENDANCE_PASS_MAX_ABSENCES = 0;
/**
 * Max unwaived schedule warnings that still pass extras.
 * ≤ 3 is the same as < 4 for whole counts. Four or more → base only.
 */
export const ATTENDANCE_PASS_MAX_SCHEDULE_VIOLATIONS = 3;

function compactDesignKey(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Map a POS / HR design label to the employee base-commission rate.
 * Verified against Commission Structure - AI sheet:
 * Link N Lock 2%, Love Spell 1.5%, Oroventi 1.5%, UV 0.5%, all others 1%.
 */
export function employeeCommissionRateForDesign(design: string): number {
  const key = compactDesignKey(design);
  if (!key) return OTHER_DESIGN_EMPLOYEE_RATE;
  if (key === "linknlock" || key === "linkandlock") return 0.02;
  if (key === "love" || key === "lovespell" || key === "lovespells") return 0.015;
  if (key === "oroventi") return 0.015;
  if (key === "uv" || key === "ultimatevalue" || key.includes("ultimatevalue")) return 0.005;
  return OTHER_DESIGN_EMPLOYEE_RATE;
}

export function fullCommissionRateForDesign(design: string): number {
  return employeeCommissionRateForDesign(design) * 2;
}

export function roundCommissionDollars(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount);
}

export function designCommissionDollars(netSales: number, design: string): number {
  return netSales * employeeCommissionRateForDesign(design);
}
