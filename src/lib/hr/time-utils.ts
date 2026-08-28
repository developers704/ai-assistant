/** Parse "09:25 AM" / "1:49 PM" to minutes from midnight. */
export function parseClockToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]!.toUpperCase();
  if (ap === "AM") {
    if (h === 12) h = 0;
  } else if (h !== 12) h += 12;
  return h * 60 + min;
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** "4:24" or "01:03" duration → minutes */
export function parseDurationLabel(raw: string | null | undefined): number {
  if (!raw) return 0;
  const s = String(raw).trim();
  const parts = s.split(":").map((p) => Number(p));
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    return parts[0]! * 60 + parts[1]!;
  }
  return 0;
}

export function minutesBetweenClocks(outTime: string, inTime: string): number {
  const outM = parseClockToMinutes(outTime);
  const inM = parseClockToMinutes(inTime);
  if (outM == null || inM == null) return 0;
  let diff = inM - outM;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function isoDateFromCell(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return `${us[3]}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}`;
  }
  return null;
}

/** Parse schedule column "Sun 08/16" with year hint. */
export function parseScheduleColumnDate(header: string, year: number): string | null {
  const m = header.trim().match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return `${year}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
}

/** Parse "09:15 AM - 08:30 PM" schedule cell. */
export function parseScheduleRange(
  raw: string | null | undefined
): { start: string; end: string; minutes: number } | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(.+?)\s*-\s*(.+)$/);
  if (!m) return null;
  const start = m[1]!.trim();
  const end = m[2]!.trim();
  const startM = parseClockToMinutes(start);
  const endM = parseClockToMinutes(end);
  if (startM == null || endM == null) return null;
  let minutes = endM - startM;
  if (minutes <= 0) minutes += 24 * 60;
  return { start, end, minutes };
}
