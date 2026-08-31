/** Parse "09:25 AM" / "1:49 PM" / 24-hour "9:28" / "14:24" to minutes from midnight. */
export function parseClockToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const min = Number(ampm[2]);
    const ap = ampm[3]!.toUpperCase();
    if (ap === "AM") {
      if (h === 12) h = 0;
    } else if (h !== 12) h += 12;
    if (!Number.isFinite(h) || !Number.isFinite(min) || min > 59) return null;
    return h * 60 + min;
  }
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = Number(h24[1]);
    const min = Number(h24[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
    return h * 60 + min;
  }
  return null;
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

/** "Mon · Jun 1" for HR date filters (ISO date). */
export function formatHrDateLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00.000Z`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${weekday} · ${month} ${day}`;
}
