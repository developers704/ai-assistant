import { applyHrSalesDesigns, hrSalesDesignName } from "@/lib/hr/hr-sales-design";
import { assembleEmployeeCommission, type EmployeeCommission } from "@/lib/hr/commission";
import {
  commissionAttendanceForAssociate,
  countedCommissionViolations,
  hrRowsMatchAssociate,
  presentDaysWithWaivedAbsences,
} from "@/lib/hr/commission-attendance";
import {
  AUGUST_PERSONAL_GOALS,
  AUGUST_STORE_GOALS,
  dummyGoalAboveActual,
} from "@/lib/hr/august-2026-commission-data";
import { loadActiveScheduleEntries, loadActiveTimecardRows } from "@/lib/hr/store";
import { analyzeDays } from "@/lib/hr/analyze";
import {
  countedScheduleWarnings,
  listAbsenceWaivers,
  unwaivedAbsentDates,
} from "@/lib/hr/warning-store";
import type { HrAbsenceWaiver, HrScheduleEntry, HrTimecardRow, HrWarningNotice } from "@/lib/hr/types";
import { namesMatch } from "@/lib/hr/name-match";
import { datesInIsoRange } from "@/lib/hr/window";
import { loadRankRows } from "@/lib/reports/load-rank-rows";
import type { VendorPosRow } from "@/lib/reports/types";
import { applySalespersonFilter } from "@/lib/sales/paycode-overlay";
import {
  creditSalespersonRows,
  resolveSalespersonFilterCode,
} from "@/lib/sales/salesperson-credit";
import { filterRows } from "@/lib/sales/sales-aggregate";
import { resolveSalespersonLabelWithCode } from "@/lib/sales/salesperson-directory";

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

export type EmployeeCommissionBuildCache = {
  punches: HrTimecardRow[];
  schedule: HrScheduleEntry[];
  waivers: HrAbsenceWaiver[];
  windowWarnings: HrWarningNotice[];
};

export function loadEmployeeCommissionBuildCache(from: string, to: string): EmployeeCommissionBuildCache {
  return {
    punches: loadActiveTimecardRows(),
    schedule: loadActiveScheduleEntries(),
    waivers: listAbsenceWaivers(),
    windowWarnings: countedScheduleWarnings({ from, to }),
  };
}

export function buildEmployeeCommissionFromSales(opts: {
  salesperson: string;
  from: string;
  to: string;
  rows?: VendorPosRow[];
  personRows?: VendorPosRow[];
  storeTotalRows?: VendorPosRow[];
  cache?: EmployeeCommissionBuildCache;
}): EmployeeCommission | null {
  const code = resolveSalespersonFilterCode(opts.salesperson);
  if (!code) return null;
  const all = opts.rows ?? loadRankRows() ?? [];
  const windowRows = all.filter((r) => r.date >= opts.from && r.date <= opts.to);
  const personRows = opts.personRows ?? applySalespersonFilter(windowRows, [code]);
  const storeTotalRows = opts.storeTotalRows ?? windowRows;
  const liveNet = personRows.reduce((s, r) => s + (r.netRevenue ?? 0), 0);
  const designs = designTotalsFromRows(personRows);
  const netSales = liveNet;

  const cache = opts.cache ?? loadEmployeeCommissionBuildCache(opts.from, opts.to);
  const punches = cache.punches;
  const schedule = cache.schedule;
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
  const payrollName = attendance.payrollName ?? associateDays[0]?.employeeName ?? code;
  const displayName = associateDays[0]?.displayName ?? payrollName;
  const person = {
    employeeName: payrollName,
    employeeCode: attendance.employeeCode ?? code,
    displayName,
  };
  const unwaivedAbsent = unwaivedAbsentDates(attendance.absentDates, cache.waivers, person);
  const warningNotices = cache.windowWarnings.filter((n) => {
    if ((n.employeeCode ?? "").trim().toUpperCase() === code) return true;
    return associateDays.some(
      (day) =>
        namesMatch(n.employeeName, day.employeeName) ||
        namesMatch(n.employeeName, day.displayName)
    );
  });
  const scheduleViolations = warningNotices.length;
  const attendanceIssues = countedCommissionViolations({
    unwaivedAbsentDates: unwaivedAbsent,
    warnings: warningNotices,
  });

  const storeTotals = storeTotalsFromRows(storeTotalRows);
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
    presentDays: presentDaysWithWaivedAbsences(
      attendance.presentDays,
      attendance.absentDates,
      unwaivedAbsent
    ),
    absences: unwaivedAbsent.length,
    scheduleViolations,
    attendanceIssues,
  });
}

export type EmployeeSalesRosterRow = {
  code: string;
  label: string;
  units: number;
  commission: EmployeeCommission;
};

export function buildEmployeeSalesRoster(opts: {
  from: string;
  to: string;
  stores?: string[];
  departments?: string[];
  designs?: string[];
  salespeople?: string[];
  rows?: VendorPosRow[];
}): EmployeeSalesRosterRow[] {
  const all = opts.rows ?? loadRankRows() ?? [];
  const windowRows = all.filter((r) => r.date >= opts.from && r.date <= opts.to);
  const remapped = applyHrSalesDesigns(windowRows);
  const scoped = filterRows(remapped, {
    dateFrom: opts.from,
    dateTo: opts.to,
    stores: opts.stores,
    departments: opts.departments,
    designs: opts.designs,
  });
  const wanted = [
    ...new Set((opts.salespeople ?? []).map((s) => resolveSalespersonFilterCode(s)).filter(Boolean)),
  ];
  const credits = creditSalespersonRows(scoped).filter((c) =>
    wanted.length ? wanted.includes(c.code) : true
  );
  const cache = loadEmployeeCommissionBuildCache(opts.from, opts.to);
  const out: EmployeeSalesRosterRow[] = [];
  for (const credit of credits) {
    const personRows = applySalespersonFilter(scoped, [credit.code]);
    const commission = buildEmployeeCommissionFromSales({
      salesperson: credit.code,
      from: opts.from,
      to: opts.to,
      rows: windowRows,
      personRows,
      storeTotalRows: windowRows,
      cache,
    });
    if (!commission) continue;
    out.push({
      code: credit.code,
      label: credit.name || resolveSalespersonLabelWithCode(credit.code),
      units: credit.units,
      commission,
    });
  }
  return out.sort(
    (a, b) =>
      b.commission.summary.netSales - a.commission.summary.netSales || a.label.localeCompare(b.label)
  );
}
