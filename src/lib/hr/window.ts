/** Attendance date window shown in HR Management (July 2026). */
export const HR_ATTENDANCE_FROM = "2026-07-01";
export const HR_ATTENDANCE_TO = "2026-07-31";

/** Shown in Time In / Time Out cells when a punch is absent. */
export const MISSING_PUNCH_LABEL = "missing.";

export function datesInIsoRange(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${fromIso}T12:00:00.000Z`);
  const end = new Date(`${toIso}T12:00:00.000Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) {
    return out;
  }
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export const HR_ATTENDANCE_DATES = datesInIsoRange(HR_ATTENDANCE_FROM, HR_ATTENDANCE_TO);

export function lastHrAttendanceDateWithData(
  punchDates: Iterable<string>,
  scheduleDates: Iterable<string>
): string {
  const punch = new Set(punchDates);
  const sched = new Set(scheduleDates);
  for (let i = HR_ATTENDANCE_DATES.length - 1; i >= 0; i--) {
    const d = HR_ATTENDANCE_DATES[i]!;
    if (punch.has(d)) return d;
  }
  for (let i = HR_ATTENDANCE_DATES.length - 1; i >= 0; i--) {
    const d = HR_ATTENDANCE_DATES[i]!;
    if (sched.has(d)) return d;
  }
  return HR_ATTENDANCE_TO;
}

/** "July 1 – 31, 2026" */
export function formatHrAttendanceWindowCaption(): string {
  const from = new Date(`${HR_ATTENDANCE_FROM}T12:00:00.000Z`);
  const to = new Date(`${HR_ATTENDANCE_TO}T12:00:00.000Z`);
  const month = from.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return `${month} ${from.getUTCDate()} – ${to.getUTCDate()}, ${from.getUTCFullYear()}`;
}
