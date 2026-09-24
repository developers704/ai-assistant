import { employeeNameTokens, namesMatch } from "./name-match";
import { resolveHrEmployeeDisplayName } from "./security-guard-names";
import { formatMinutes, minutesBetweenClocks, parseClockToMinutes } from "./time-utils";
import type { HrScheduleEntry, HrTimecardRow } from "./types";

export type MyScheduleUser = {
  name: string;
  employeeCode?: string | null;
};

export type MyScheduleShift = {
  date: string;
  start: string;
  end: string;
  scheduledMinutes: number;
  scheduledLabel: string;
};

/** "Jesus Acosta" → "Acosta Jesus" so a first-last login still finds last-first schedule rows. */
function reversedName(name: string): string | null {
  if (name.includes(",")) return null;
  const tokens = employeeNameTokens(name);
  if (tokens.length < 2) return null;
  return [tokens[tokens.length - 1], ...tokens.slice(0, -1)].join(" ");
}

/**
 * Every payroll/schedule name that belongs to the login: the login name itself,
 * timecard rows sharing the login's employee code, and security-guard posts
 * ("1, Security Guard") whose Guards Name / mapped name is the login.
 */
export function scheduleNamesForUser(
  user: MyScheduleUser,
  punches: Pick<HrTimecardRow, "employeeName" | "employeeCode" | "guardsName">[]
): string[] {
  const userName = user.name.trim();
  const code = (user.employeeCode ?? "").trim().toUpperCase();
  const names = new Set<string>();
  if (userName) names.add(userName);
  const reversed = reversedName(userName);
  if (reversed) names.add(reversed);
  for (const p of punches) {
    const sameCode = code && (p.employeeCode ?? "").trim().toUpperCase() === code;
    const display = resolveHrEmployeeDisplayName(p.employeeName, p.guardsName);
    if (sameCode || (userName && namesMatch(display, userName))) {
      names.add(p.employeeName);
    }
  }
  return [...names];
}

export function buildMySchedule(
  user: MyScheduleUser,
  entries: HrScheduleEntry[],
  punches: Pick<HrTimecardRow, "employeeName" | "employeeCode" | "guardsName">[]
): { matchedNames: string[]; shifts: MyScheduleShift[] } {
  const candidates = scheduleNamesForUser(user, punches);
  const userName = user.name.trim();
  const matchedNames = new Set<string>();
  const seen = new Set<string>();
  const shifts: MyScheduleShift[] = [];
  for (const e of entries) {
    const hit =
      candidates.some((n) => namesMatch(e.employeeName, n)) ||
      (userName && namesMatch(resolveHrEmployeeDisplayName(e.employeeName), userName));
    if (!hit) continue;
    matchedNames.add(e.employeeName);
    const key = `${e.date}\0${e.start}\0${e.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const scheduledMinutes = Math.max(0, minutesBetweenClocks(e.start, e.end));
    shifts.push({
      date: e.date,
      start: e.start,
      end: e.end,
      scheduledMinutes,
      scheduledLabel: formatMinutes(scheduledMinutes),
    });
  }
  shifts.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (parseClockToMinutes(a.start) ?? 0) - (parseClockToMinutes(b.start) ?? 0)
  );
  return { matchedNames: [...matchedNames], shifts };
}
