import type { AppState } from "@/types";

export function userTimezone(state: AppState): string {
  return state.user?.timezone || "Asia/Karachi";
}

export function dateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function eventDateKey(isoStr: string, timezone: string): string {
  return dateKeyInTimezone(new Date(isoStr), timezone);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export function resolveCalendarDay(
  message: string,
  timezone: string
): { label: string; dateKey: string; formattedDate: string } {
  const lower = message.toLowerCase();
  const todayKey = dateKeyInTimezone(new Date(), timezone);
  let dateKey = todayKey;
  let label = "Today's Schedule";

  if (/tomorrow/.test(lower)) {
    dateKey = addDaysToDateKey(todayKey, 1);
    label = "Tomorrow's Schedule";
  } else if (/yesterday/.test(lower)) {
    dateKey = addDaysToDateKey(todayKey, -1);
    label = "Yesterday's Schedule";
  }

  const [y, m, d] = dateKey.split("-").map(Number);
  const formattedDate = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return { label, dateKey, formattedDate };
}

export function isEventOnDate(isoStr: string, dateKey: string, timezone: string): boolean {
  return eventDateKey(isoStr, timezone) === dateKey;
}

export function isTodayInTimezone(isoStr: string, timezone: string): boolean {
  const todayKey = dateKeyInTimezone(new Date(), timezone);
  return eventDateKey(isoStr, timezone) === todayKey;
}
