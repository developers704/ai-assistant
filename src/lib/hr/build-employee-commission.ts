import { applyHrSalesDesigns } from "@/lib/hr/hr-sales-design";
import { assembleEmployeeCommission, type EmployeeCommission } from "@/lib/hr/commission";
import {
  buildHrAttendanceIndex,
  commissionAttendanceForAssociate,
  countedCommissionViolations,
  directoryNamesForCode,
  presentDaysWithWaivedAbsences,
  type HrAttendanceIndex,
} from "@/lib/hr/commission-attendance";
import {
  AUGUST_PERSONAL_GOALS,
  AUGUST_STORE_GOALS,
  dummyGoalAboveActual,
} from "@/lib/hr/august-2026-commission-data";
import { loadActiveScheduleEntries, loadActiveTimecardRows } from "@/lib/hr/store";
import {
  countedScheduleWarnings,
  listAbsenceWaivers,
  unwaivedAbsentDates,
} from "@/lib/hr/warning-store";
import type { HrAbsenceWaiver, HrScheduleEntry, HrTimecardRow, HrWarningNotice } from "@/lib/hr/types";
import { namesMatch } from "@/lib/hr/name-match";
import { loadRankRows } from "@/lib/reports/load-rank-rows";
import type { VendorPosRow } from "@/lib/reports/types";
import { applySalespersonFilter } from "@/lib/sales/paycode-overlay";
import {
  creditSalespersonRows,
  parseSalespersonSplits,
  resolveSalespersonFilterCode,
  salespersonFilterSlice,
} from "@/lib/sales/salesperson-credit";
import { filterRows } from "@/lib/sales/sales-aggregate";
import { resolveSalespersonLabelWithCode } from "@/lib/sales/salesperson-directory";
import { registerHrRuntimeCacheClear } from "@/lib/hr/hr-runtime-cache";

function designTotalsFromMappedRows(rows: VendorPosRow[]): { design: string; netSales: number }[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const name = (r.design || "").trim() || "Others";
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

function groupPersonRows(rows: VendorPosRow[]): Map<string, VendorPosRow[]> {
  const grouped = new Map<string, VendorPosRow[]>();
  for (const r of rows) {
    const splits = parseSalespersonSplits(r.salespersons);
    if (!splits.length) continue;
    for (const s of splits) {
      const slice = salespersonFilterSlice(r, [s.code]);
      if (!slice) continue;
      const next =
        slice.share === 1
          ? { ...r, salespersons: slice.salespersons }
          : { ...r, netRevenue: r.netRevenue * slice.share, salespersons: slice.salespersons };
      const list = grouped.get(s.code);
      if (list) list.push(next);
      else grouped.set(s.code, [next]);
    }
  }
  return grouped;
}

export type EmployeeCommissionBuildCache = {
  punches: HrTimecardRow[];
  schedule: HrScheduleEntry[];
  waivers: HrAbsenceWaiver[];
  windowWarnings: HrWarningNotice[];
  hrIndex?: HrAttendanceIndex;
};

export function loadEmployeeCommissionBuildCache(from: string, to: string): EmployeeCommissionBuildCache {
  const punches = loadActiveTimecardRows();
  const schedule = loadActiveScheduleEntries();
  return {
    punches,
    schedule,
    waivers: listAbsenceWaivers(),
    windowWarnings: countedScheduleWarnings({ from, to }),
    hrIndex: buildHrAttendanceIndex(from, to, punches, schedule),
  };
}

type AttendanceParts = {
  attendance: ReturnType<typeof commissionAttendanceForAssociate>;
  unwaivedAbsent: string[];
  attendanceIssues: ReturnType<typeof countedCommissionViolations>;
  presentDays: number;
};

function attendancePartsFor(
  cache: EmployeeCommissionBuildCache,
  code: string,
  from: string,
  to: string,
  memo?: Map<string, AttendanceParts>
): AttendanceParts {
  const hit = memo?.get(code);
  if (hit) return hit;
  const attendance = commissionAttendanceForAssociate(
    code,
    from,
    to,
    cache.punches,
    cache.schedule,
    cache.hrIndex
  );
  const person = {
    employeeName: attendance.payrollName ?? code,
    employeeCode: attendance.employeeCode ?? code,
    displayName: attendance.payrollName ?? code,
  };
  const unwaivedAbsent = unwaivedAbsentDates(attendance.absentDates, cache.waivers, person);
  const nameHints = [attendance.payrollName, ...directoryNamesForCode(code)].filter(
    (n): n is string => Boolean(n)
  );
  const warningNotices = cache.windowWarnings.filter((n) => {
    if ((n.employeeCode ?? "").trim().toUpperCase() === code) return true;
    return nameHints.some((nm) => namesMatch(n.employeeName, nm));
  });
  const parts: AttendanceParts = {
    attendance,
    unwaivedAbsent,
    attendanceIssues: countedCommissionViolations({
      unwaivedAbsentDates: unwaivedAbsent,
      warnings: warningNotices,
    }),
    presentDays: presentDaysWithWaivedAbsences(
      attendance.presentDays,
      attendance.absentDates,
      unwaivedAbsent
    ),
  };
  memo?.set(code, parts);
  return parts;
}

type WindowPrep = {
  remapped: VendorPosRow[];
  storeTotals: Map<string, number>;
  cache: EmployeeCommissionBuildCache;
  attendanceMemo: Map<string, AttendanceParts>;
};

const WINDOW_PREP_TTL_MS = 120_000;
const windowPrepByKey = new Map<string, { at: number; prep: WindowPrep }>();
registerHrRuntimeCacheClear(() => windowPrepByKey.clear());

function getWindowPrep(from: string, to: string, rows?: VendorPosRow[]): WindowPrep {
  const key = rows ? "" : `${from}|${to}`;
  if (key) {
    const cached = windowPrepByKey.get(key);
    if (cached && Date.now() - cached.at < WINDOW_PREP_TTL_MS) return cached.prep;
  }
  const all = rows ?? loadRankRows() ?? [];
  const windowRows = all.filter((r) => r.date >= from && r.date <= to);
  const prep: WindowPrep = {
    remapped: applyHrSalesDesigns(windowRows),
    storeTotals: storeTotalsFromRows(windowRows),
    cache: loadEmployeeCommissionBuildCache(from, to),
    attendanceMemo: new Map(),
  };
  if (key) {
    windowPrepByKey.set(key, { at: Date.now(), prep });
    if (windowPrepByKey.size > 6) {
      const oldest = [...windowPrepByKey.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) windowPrepByKey.delete(oldest[0]);
    }
  }
  return prep;
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
  const prep = opts.rows || opts.cache ? null : getWindowPrep(opts.from, opts.to);
  const cache = opts.cache ?? prep?.cache ?? loadEmployeeCommissionBuildCache(opts.from, opts.to);
  if (!cache.hrIndex) {
    cache.hrIndex = buildHrAttendanceIndex(opts.from, opts.to, cache.punches, cache.schedule);
  }
  const all = opts.rows ?? prep?.remapped ?? loadRankRows() ?? [];
  const windowRows = opts.rows
    ? all.filter((r) => r.date >= opts.from && r.date <= opts.to)
    : prep?.remapped ?? all.filter((r) => r.date >= opts.from && r.date <= opts.to);
  const rawPerson = opts.personRows ?? applySalespersonFilter(windowRows, [code]);
  const personRows = opts.personRows ? rawPerson : applyHrSalesDesigns(rawPerson);
  const storeTotals =
    opts.storeTotalRows
      ? storeTotalsFromRows(opts.storeTotalRows)
      : prep?.storeTotals ?? storeTotalsFromRows(windowRows);
  const liveNet = personRows.reduce((s, r) => s + (r.netRevenue ?? 0), 0);
  const designs = designTotalsFromMappedRows(personRows);
  const parts = attendancePartsFor(cache, code, opts.from, opts.to, prep?.attendanceMemo);
  const storeCode = parts.attendance.posStore ?? majorityStore(personRows);
  const storeTotalSales = storeCode ? (storeTotals.get(storeCode) ?? 0) : 0;
  const personalGoal = AUGUST_PERSONAL_GOALS[code] ?? dummyGoalAboveActual(liveNet);
  const storeGoal = storeCode
    ? (AUGUST_STORE_GOALS[storeCode] ?? dummyGoalAboveActual(storeTotalSales))
    : dummyGoalAboveActual(storeTotalSales);

  return assembleEmployeeCommission({
    code,
    designs,
    netSales: liveNet,
    personalGoal,
    storeCode,
    storeGoal,
    storeTotalSales,
    scheduledDays: parts.attendance.scheduledDays,
    presentDays: parts.presentDays,
    absences: parts.unwaivedAbsent.length,
    scheduleViolations: parts.attendanceIssues.filter((i) => i.kind !== "absent").length,
    attendanceIssues: parts.attendanceIssues,
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
  const prep = getWindowPrep(opts.from, opts.to, opts.rows);
  const scoped = filterRows(prep.remapped, {
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
  const personByCode = groupPersonRows(scoped);
  const out: EmployeeSalesRosterRow[] = [];
  for (const credit of credits) {
    const personRows = personByCode.get(credit.code) ?? [];
    const parts = attendancePartsFor(
      prep.cache,
      credit.code,
      opts.from,
      opts.to,
      prep.attendanceMemo
    );
    const netSales = personRows.reduce((s, r) => s + (r.netRevenue ?? 0), 0);
    const storeCode = parts.attendance.posStore ?? majorityStore(personRows);
    const storeTotalSales = storeCode ? (prep.storeTotals.get(storeCode) ?? 0) : 0;
    const personalGoal = AUGUST_PERSONAL_GOALS[credit.code] ?? dummyGoalAboveActual(netSales);
    const storeGoal = storeCode
      ? (AUGUST_STORE_GOALS[storeCode] ?? dummyGoalAboveActual(storeTotalSales))
      : dummyGoalAboveActual(storeTotalSales);
    const commission = assembleEmployeeCommission({
      code: credit.code,
      designs: designTotalsFromMappedRows(personRows),
      netSales,
      personalGoal,
      storeCode,
      storeGoal,
      storeTotalSales,
      scheduledDays: parts.attendance.scheduledDays,
      presentDays: parts.presentDays,
      absences: parts.unwaivedAbsent.length,
      scheduleViolations: parts.attendanceIssues.filter((i) => i.kind !== "absent").length,
      attendanceIssues: parts.attendanceIssues,
    });
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
