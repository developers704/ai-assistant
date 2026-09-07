import type { EmployeeSalesRosterRow } from "@/lib/hr/build-employee-commission";

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function ratePct(rate: number): string {
  const pct = rate * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

export const EMPLOYEE_SALES_CSV_HEADERS = [
  "Employee",
  "Code",
  "Net sales",
  "Units",
  "Worked days",
  "Scheduled days",
  "Absences",
  "Base",
  "Attendance bonus",
  "Personal sales",
  "Personal bonus",
  "Store bonus",
  "Commission",
] as const;

export const EMPLOYEE_SALES_DESIGN_CSV_HEADERS = [
  "Employee",
  "Code",
  "Design",
  "Net sales",
  "Rate",
  "Commission",
] as const;

export function employeeSalesSummaryRows(rows: EmployeeSalesRosterRow[]): string[][] {
  return rows.map((row) => {
    const s = row.commission.summary;
    return [
      row.label,
      row.code,
      money(s.netSales),
      String(Math.round(row.units)),
      String(s.presentDays),
      String(s.scheduledDays),
      String(s.absences),
      money(s.baseCommission),
      money(s.attendanceBonus),
      money(s.netSales),
      money(s.personalGoalBonus),
      money(s.storeGoalBonus),
      money(s.totalCommission),
    ];
  });
}

export function employeeSalesDesignRows(rows: EmployeeSalesRosterRow[]): string[][] {
  const out: string[][] = [];
  for (const row of rows) {
    for (const line of row.commission.lines) {
      out.push([
        row.label,
        row.code,
        line.design,
        money(line.netSales),
        ratePct(line.employeeRate),
        money(line.baseCommission),
      ]);
    }
  }
  return out;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: readonly string[], rows: string[][]): string {
  return [headers, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
}

export function employeeSalesRosterCsv(
  rows: EmployeeSalesRosterRow[],
  opts?: { designWise?: boolean }
): string {
  const summary = toCsv(EMPLOYEE_SALES_CSV_HEADERS, employeeSalesSummaryRows(rows));
  if (!opts?.designWise) return summary;
  const designs = toCsv(EMPLOYEE_SALES_DESIGN_CSV_HEADERS, employeeSalesDesignRows(rows));
  return `${summary}\n\n${designs}`;
}
