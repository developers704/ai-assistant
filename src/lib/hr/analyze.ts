import type {
  HrEmployeeDay,
  HrPunchSegment,
  HrScheduleEntry,
  HrTimecardRow,
  HrViolation,
} from "./types";
import { namesMatch } from "./name-match";
import {
  checkLateEarly,
  checkEarlyOut,
  checkLateOut,
  classifyGapMinutes,
  lateEarlyDeltaMinutes,
  earlyOutDeltaMinutes,
  lateOutDeltaMinutes,
  shiftTierFromScheduledMinutes,
  expectedMealPolicy,
} from "./meal-break-rules";
import { resolveHrEmployeeDisplayName } from "./security-guard-names";
import {
  formatMinutes,
  minutesBetweenClocks,
  parseClockToMinutes,
  parseDurationLabel,
  parseScheduleRange,
} from "./time-utils";
import { workMinutesFromRow } from "./parse-timecard";

function firstFilled(
  punches: HrTimecardRow[],
  key:
    | "employeeCode"
    | "jobTitle"
    | "store"
    | "manager"
    | "guardsName"
    | "userEmail"
    | "mail"
): string | null {
  for (const row of punches) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function gapMinutesFromRow(row: HrTimecardRow, prev: HrTimecardRow | null): number | null {
  if (row.gapFromPrevious) {
    const m = parseDurationLabel(row.gapFromPrevious);
    if (m > 0) return m;
  }
  if (prev?.timeOut && row.timeIn) {
    return minutesBetweenClocks(prev.timeOut, row.timeIn);
  }
  return null;
}

export function analyzeEmployeeDay(
  employeeName: string,
  date: string,
  punches: HrTimecardRow[],
  scheduleEntries: HrScheduleEntry[],
  /** Any-day rows for this employee — used for contact / profile fields when today's punches are empty. */
  profileRows: HrTimecardRow[] = punches
): HrEmployeeDay {
  const sorted = [...punches].sort((a, b) => {
    const ta = parseClockToMinutes(a.timeIn) ?? 0;
    const tb = parseClockToMinutes(b.timeIn) ?? 0;
    return ta - tb;
  });

  const scheduleRaw = scheduleEntries.find(
    (e) => e.date === date && namesMatch(e.employeeName, employeeName)
  );
  const scheduleRange = scheduleRaw
    ? parseScheduleRange(`${scheduleRaw.start} - ${scheduleRaw.end}`)
    : null;

  const violations: HrViolation[] = [];
  if (!scheduleRange) {
    violations.push({
      type: "no_schedule",
      message: "Schedule missing",
      severity: "warning",
    });
  }

  const segments: HrPunchSegment[] = [];
  const mealBreaks: { gapMinutes: number; gapLabel: string }[] = [];
  const shortBreaks: { gapMinutes: number; gapLabel: string }[] = [];
  let totalWorkMinutes = 0;

  if (sorted.length === 0) {
    if (scheduleRange) {
      // Absent is the single day-level issue — do not also stack Missing In/Out.
      violations.push({
        type: "absent",
        message: "Absent — scheduled, no punch",
        severity: "error",
      });
    }
    segments.push({
      timeIn: null,
      timeOut: null,
      gapFromPrevious: null,
      gapMinutes: null,
      gapKind: "none",
      workMinutes: 0,
      workLabel: "0:00",
      violations: [],
    });
  }

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const prev = i > 0 ? sorted[i - 1]! : null;
    const segViolations: HrViolation[] = [];

    if (!row.timeIn) {
      segViolations.push({
        type: "missing_punch",
        message: "Missing Time In",
        severity: "error",
      });
    }
    if (!row.timeOut) {
      segViolations.push({
        type: "missing_punch",
        message: "Missing Time Out",
        severity: "error",
      });
    }

    const gapMin = gapMinutesFromRow(row, prev);
    const gapKind = classifyGapMinutes(gapMin);
    if (gapKind === "meal_break" && gapMin != null) {
      mealBreaks.push({ gapMinutes: gapMin, gapLabel: formatMinutes(gapMin) });
    } else if (gapKind === "short_break" && gapMin != null) {
      shortBreaks.push({ gapMinutes: gapMin, gapLabel: formatMinutes(gapMin) });
    }

    const workMinutes = workMinutesFromRow(row);
    totalWorkMinutes += workMinutes;

    segments.push({
      timeIn: row.timeIn,
      timeOut: row.timeOut,
      gapFromPrevious: row.gapFromPrevious,
      gapMinutes: gapMin,
      gapKind,
      workMinutes,
      workLabel: row.hoursLabel ?? formatMinutes(workMinutes),
      violations: segViolations,
    });
  }

  const firstIn = sorted.find((r) => r.timeIn)?.timeIn ?? null;
  const lastOut = [...sorted].reverse().find((r) => r.timeOut)?.timeOut ?? null;
  let lateMinutes: number | null = null;
  let earlyInMinutes: number | null = null;
  let earlyOutMinutes: number | null = null;
  let lateOutMinutes: number | null = null;
  if (scheduleRaw && firstIn) {
    const delta = lateEarlyDeltaMinutes(scheduleRaw.start, firstIn);
    if (delta.lateMinutes > 0) lateMinutes = delta.lateMinutes;
    if (delta.earlyMinutes > 0) earlyInMinutes = delta.earlyMinutes;
    violations.push(...checkLateEarly(scheduleRaw.start, firstIn));
  }
  if (scheduleRaw && lastOut) {
    const leftEarly = earlyOutDeltaMinutes(scheduleRaw.end, lastOut);
    if (leftEarly > 0) earlyOutMinutes = leftEarly;
    violations.push(...checkEarlyOut(scheduleRaw.end, lastOut));
    const stayedLate = lateOutDeltaMinutes(scheduleRaw.end, lastOut);
    if (stayedLate > 0) lateOutMinutes = stayedLate;
    violations.push(...checkLateOut(scheduleRaw.end, lastOut));
  }

  const shiftTier = scheduleRange
    ? shiftTierFromScheduledMinutes(scheduleRange.minutes)
    : null;

  const mealMinutes = mealBreaks.map((m) => m.gapMinutes);
  const totalMealMinutes = mealMinutes.reduce((s, n) => s + n, 0);
  // Meal breaks are informational only — never a flag / warning / write-up case.

  const policy = shiftTier ? expectedMealPolicy(shiftTier) : { count: 0, totalMinutes: 0 };
  // Prefer today's punches; fall back to any-day profile rows (emails often only on first row / absent days have no punches).
  const metaSource = sorted.length ? sorted : profileRows.length ? profileRows : punches;
  const guardsName =
    firstFilled(metaSource, "guardsName") ?? firstFilled(profileRows, "guardsName");

  return {
    employeeName,
    displayName: resolveHrEmployeeDisplayName(employeeName, guardsName),
    date,
    employeeCode:
      firstFilled(metaSource, "employeeCode") ?? firstFilled(profileRows, "employeeCode"),
    jobTitle: firstFilled(metaSource, "jobTitle") ?? firstFilled(profileRows, "jobTitle"),
    store: firstFilled(metaSource, "store") ?? firstFilled(profileRows, "store"),
    manager: firstFilled(metaSource, "manager") ?? firstFilled(profileRows, "manager"),
    guardsName,
    schedule: scheduleRange
      ? {
          start: scheduleRaw!.start,
          end: scheduleRaw!.end,
          scheduledMinutes: scheduleRange.minutes,
          scheduledLabel: formatMinutes(scheduleRange.minutes),
        }
      : null,
    shiftTier,
    segments,
    mealBreaks,
    shortBreaks,
    totalWorkMinutes,
    totalWorkLabel: formatMinutes(totalWorkMinutes),
    totalMealMinutes,
    totalMealLabel: formatMinutes(totalMealMinutes),
    expectedMealMinutes: policy.totalMinutes,
    expectedMealCount: policy.count,
    lateMinutes,
    earlyInMinutes,
    earlyOutMinutes,
    lateOutMinutes,
    userEmail:
      firstFilled(metaSource, "userEmail") ?? firstFilled(profileRows, "userEmail"),
    mail: firstFilled(metaSource, "mail") ?? firstFilled(profileRows, "mail"),
    violations: [...violations, ...segments.flatMap((s) => s.violations)],
  };
}

function groupByDate<T extends { date: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.date);
    if (list) list.push(row);
    else map.set(row.date, [row]);
  }
  return map;
}

function uniqueEmployeeNames(
  dayRows: Array<{ employeeName: string }>,
  daySchedule: Array<{ employeeName: string }>
): string[] {
  const names: string[] = [];
  const addName = (name: string) => {
    if (names.some((existing) => namesMatch(existing, name))) return;
    names.push(name);
  };
  for (const r of dayRows) addName(r.employeeName);
  for (const e of daySchedule) addName(e.employeeName);
  return names.sort((a, b) => a.localeCompare(b));
}

export function analyzeDay(
  date: string,
  timecardRows: HrTimecardRow[],
  scheduleEntries: HrScheduleEntry[]
): HrEmployeeDay[] {
  return analyzeDays([date], timecardRows, scheduleEntries);
}

export function distinctTimecardDates(rows: HrTimecardRow[]): string[] {
  return [...new Set(rows.map((r) => r.date))].sort();
}

export function analyzeDays(
  dates: string[],
  timecardRows: HrTimecardRow[],
  scheduleEntries: HrScheduleEntry[]
): HrEmployeeDay[] {
  const punchesByDate = groupByDate(timecardRows);
  const scheduleByDate = groupByDate(scheduleEntries);
  const profileCache = new Map<string, HrTimecardRow[]>();
  const profileFor = (name: string) => {
    const hit = profileCache.get(name);
    if (hit) return hit;
    const rows = timecardRows.filter((r) => namesMatch(r.employeeName, name));
    profileCache.set(name, rows);
    return rows;
  };

  const out: HrEmployeeDay[] = [];
  for (const date of dates) {
    const dayRows = punchesByDate.get(date) ?? [];
    const daySchedule = scheduleByDate.get(date) ?? [];
    for (const name of uniqueEmployeeNames(dayRows, daySchedule)) {
      const punches = dayRows.filter((r) => namesMatch(r.employeeName, name));
      out.push(analyzeEmployeeDay(name, date, punches, daySchedule, profileFor(name)));
    }
  }
  return out;
}
