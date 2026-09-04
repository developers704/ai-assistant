import { applyHrSalesDesigns, hrSalesDesignName } from "@/lib/hr/hr-sales-design";
import { assembleEmployeeCommission, type EmployeeCommission } from "@/lib/hr/commission";
import {
  commissionAttendanceForAssociate,
  commissionIssuesFromDays,
  hrRowsMatchAssociate,
} from "@/lib/hr/commission-attendance";
import {
  AUGUST_PERSONAL_GOALS,
  AUGUST_STORE_GOALS,
  dummyGoalAboveActual,
} from "@/lib/hr/august-2026-commission-data";
import { loadActiveScheduleEntries, loadActiveTimecardRows } from "@/lib/hr/store";
import { analyzeDays } from "@/lib/hr/analyze";
import { countedScheduleWarnings } from "@/lib/hr/warning-store";
import { namesMatch } from "@/lib/hr/name-match";
import { datesInIsoRange } from "@/lib/hr/window";
import { loadRankRows } from "@/lib/reports/load-rank-rows";
import type { VendorPosRow } from "@/lib/reports/types";
import { applySalespersonFilter } from "@/lib/sales/paycode-overlay";
import { resolveSalespersonFilterCode } from "@/lib/sales/salesperson-credit";

function designTotalsFromRows(rows: VendorPosRow[]): { design: string; netSales: number }[] {
  const mapped = applyHrSalesDesigns(rows);
  const totals = new Map<string, number>();
  for (const r of mapped) {
    const name = hrSalesDesignName(r);
    totals.set(name, (totals.get(name) ?? 0) + (r.netRevenue ?? 0));
  }
  return [...totals.entries()]
    .map(([design, netSales]) => ({ design, netSales }))
    .sort((a, b) => b.netSales - a.netSales || a.design.localeCompare(b.design));
}

function storeTotalsFromRows(rows: VendorPosRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const st = (r.storeName || "").trim();
    if (!st) continue;
    totals.set(st, (totals.get(st) ?? 0) + (r.netRevenue ?? 0));
  }
  return totals;
}

function majorityStore(rows: VendorPosRow[]): string | null {
  const totals = storeTotalsFromRows(rows);
  let best: string | null = null;
  let bestNet = -Infinity;
  for (const [st, n] of totals) {
    if (n > bestNet) {
      best = st;
      bestNet = n;
    }
  }
  return best;
}

export function buildEmployeeCommissionFromSales(opts: {
  salesperson: string;
  from: string;
  to: string;
  rows?: VendorPosRow[];
}): EmployeeCommission | null {
  const code = resolveSalespersonFilterCode(opts.salesperson);
  if (!code) return null;
  const all = opts.rows ?? loadRankRows() ?? [];
  const windowRows = all.filter((r) => r.date >= opts.from && r.date <= opts.to);
  const personRows = applySalespersonFilter(windowRows, [code]);
  const liveNet = personRows.reduce((s, r) => s + (r.netRevenue ?? 0), 0);
  const designs = designTotalsFromRows(personRows);
  const netSales = liveNet;

  const punches = loadActiveTimecardRows();
  const schedule = loadActiveScheduleEntries();
  const attendance = commissionAttendanceForAssociate(code, opts.from, opts.to, punches, schedule);
  const windowDates = datesInIsoRange(opts.from, opts.to);
  const dateSet = new Set(windowDates);
  const associatePunches = punches.filter(
    (r) => dateSet.has(r.date) && hrRowsMatchAssociate(code, r.employeeName, r.employeeCode, r.guardsName)
  );
  const punchNames = [...new Set(associatePunches.map((r) => r.employeeName))];
  const associateSchedule = schedule.filter((e) => {
    if (!dateSet.has(e.date)) return false;
    if (hrRowsMatchAssociate(code, e.employeeName)) return true;
    return punchNames.some((n) => namesMatch(n, e.employeeName));
  });
  const associateDays = analyzeDays(windowDates, associatePunches, associateSchedule);
  const attendanceIssues = commissionIssuesFromDays(associateDays);
  const scheduleViolations = countedScheduleWarnings({
    from: opts.from,
    to: opts.to,
  }).filter((n) => {
    if ((n.employeeCode ?? "").trim().toUpperCase() === code) return true;
    return associateDays.some(
      (day) =>
        namesMatch(n.employeeName, day.employeeName) ||
        namesMatch(n.employeeName, day.displayName)
    );
  }).length;

  const storeTotals = storeTotalsFromRows(windowRows);
  const storeCode = attendance.posStore ?? majorityStore(personRows);
  const storeTotalSales = storeCode ? (storeTotals.get(storeCode) ?? 0) : 0;

  const personalGoal = AUGUST_PERSONAL_GOALS[code] ?? dummyGoalAboveActual(netSales);
  const storeGoal = storeCode
    ? (AUGUST_STORE_GOALS[storeCode] ?? dummyGoalAboveActual(storeTotalSales))
    : dummyGoalAboveActual(storeTotalSales);

  return assembleEmployeeCommission({
    code,
    designs,
    netSales,
    personalGoal,
    storeCode,
    storeGoal,
    storeTotalSales,
    scheduledDays: attendance.scheduledDays,
    presentDays: attendance.presentDays,
    absences: attendance.absences,
    scheduleViolations,
    attendanceIssues,
  });
}
