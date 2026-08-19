/** ISO date YYYY-MM-DD → display e.g. "Fri · 07/10/26" */
export function formatReportDateDisplay(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) {
    const [y, m, d] = isoDate.split("-");
    if (!y || !m || !d) return isoDate;
    return `${m}/${d}/${y.slice(-2)}`;
  }
  const date = new Date(`${isoDate}T12:00:00`);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const [y, m, d] = isoDate.split("-");
  return `${weekday} · ${m}/${d}/${y.slice(-2)}`;
}

/** Friendly spoken/chat label, e.g. "Wednesday, July 8, 2026" */
export function formatReportDateLong(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatReportDateRange(from: string, to: string): string {
  if (from === to) return formatReportDateDisplay(from);
  return `${formatReportDateDisplay(from)} – ${formatReportDateDisplay(to)}`;
}

/** Parse MM/DD/YY, MM/DD/YYYY, or YYYY-MM-DD to ISO date. */
export function parseReportFilterDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${y}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

function inferYears(availableDates: string[] | undefined, day: number, month: number): number[] {
  const years: number[] = [];
  if (availableDates?.length) {
    for (const d of availableDates) {
      const y = parseInt(d.slice(0, 4), 10);
      if (!years.includes(y)) years.push(y);
    }
    const md = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const matching = years.filter((y) => availableDates.includes(`${y}-${md}`));
    if (matching.length) return matching;
  }
  const nowY = new Date().getFullYear();
  return years.length ? years : [nowY, nowY - 1];
}

/**
 * Extract a sales report day from natural language, e.g.
 * "show sales of 8 july", "July 8 sales", "sales on 7/8/26", "2026-07-08".
 * Prefers dates that exist in `availableDates` when provided.
 */
function businessTodayIso(): string {
  const tz = process.env.BUSINESS_TIMEZONE || "America/Los_Angeles";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA → YYYY-MM-DD
  return fmt.format(new Date());
}

function shiftIsoDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function extractSalesDateFromMessage(
  message: string,
  availableDates?: string[]
): string | null {
  const text = message.trim();
  if (!text) return null;

  const candidates: string[] = [];
  const lower = text.toLowerCase();
  const today = businessTodayIso();

  // Relative days (chat: "today's sales", "yesterday sales", "aaj")
  if (/\b(today|aaj)\b/i.test(lower)) {
    candidates.push(today);
  } else if (
    /\b(yesterday|kal)\b/i.test(lower) &&
    !/\b(tomorrow|future)\b/i.test(lower)
  ) {
    candidates.push(shiftIsoDays(today, -1));
  } else if (/\b(day before yesterday|parson|parso[nm]?)\b/i.test(lower)) {
    candidates.push(shiftIsoDays(today, -2));
  }

  for (const token of text.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) ?? []) {
    const iso = parseReportFilterDate(token);
    if (iso) candidates.push(iso);
  }

  const monthNames = Object.keys(MONTHS).join("|");
  const dayMonth = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`,
    "i"
  );
  const monthDay = new RegExp(
    `\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`,
    "i"
  );

  const dm = text.match(dayMonth);
  if (dm) {
    const day = parseInt(dm[1], 10);
    const month = MONTHS[dm[2].toLowerCase()];
    const year = dm[3] ? parseInt(dm[3], 10) : null;
    if (year) {
      const iso = toIso(year, month, day);
      if (iso) candidates.push(iso);
    } else {
      for (const y of inferYears(availableDates, day, month)) {
        const iso = toIso(y, month, day);
        if (iso) candidates.push(iso);
      }
    }
  }

  const md = text.match(monthDay);
  if (md) {
    const month = MONTHS[md[1].toLowerCase()];
    const day = parseInt(md[2], 10);
    const year = md[3] ? parseInt(md[3], 10) : null;
    if (year) {
      const iso = toIso(year, month, day);
      if (iso) candidates.push(iso);
    } else {
      for (const y of inferYears(availableDates, day, month)) {
        const iso = toIso(y, month, day);
        if (iso) candidates.push(iso);
      }
    }
  }

  const unique = [...new Set(candidates)];
  if (unique.length === 0) return null;

  if (availableDates?.length) {
    const available = new Set(availableDates);
    const hit = unique.find((d) => available.has(d));
    if (hit) return hit;
    for (const d of unique) {
      const mdKey = d.slice(5);
      const alt = availableDates.find((a) => a.endsWith(`-${mdKey}`));
      if (alt) return alt;
    }
  }

  return unique[0];
}

export function isValidIsoDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(new Date(`${iso}T12:00:00`).getTime());
}

/**
 * Shift an ISO date by whole years (same month/day).
 * Feb 29 → Feb 28 in non-leap target years.
 */
export function shiftIsoYears(iso: string, years: number): string {
  if (!isValidIsoDate(iso)) return iso;
  const [ys, ms, ds] = iso.split("-");
  const y = Number(ys) + years;
  const m = Number(ms);
  const d = Number(ds);
  // Clamp day into the target month (handles Feb 29 → Feb 28).
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Map a date to the prior year with the same weekday pattern.
 * Example: 2026-08-03 (Mon) → 2025-08-04 (Mon), not 2025-08-03.
 */
export function shiftIsoToSameWeekdayLastYear(iso: string): string {
  if (!isValidIsoDate(iso)) return iso;
  const current = new Date(`${iso}T12:00:00`);
  const priorSameDate = shiftIsoYears(iso, -1);
  const prior = new Date(`${priorSameDate}T12:00:00`);
  const weekdayDelta = (current.getDay() - prior.getDay() + 7) % 7;
  const aligned = new Date(prior);
  aligned.setDate(aligned.getDate() + weekdayDelta);
  const y = aligned.getFullYear();
  const m = String(aligned.getMonth() + 1).padStart(2, "0");
  const d = String(aligned.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO YYYY-MM-DD → M/D/YYYY for CSV Transaction Date cells */
export function isoToUsDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${Number(m)}/${Number(d)}/${y}`;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Sales dashboard YoY caption — single day names the weekday; ranges use period wording. */
export function yoyCompareLabelForRange(
  range: { from: string; to: string } | null | undefined
): string {
  if (!range || range.from !== range.to) {
    return "vs same time period last year";
  }
  const day = WEEKDAY_NAMES[new Date(`${range.from}T12:00:00`).getDay()]!;
  return `vs same last year ${day}`;
}

/**
 * YoY compare window for sales dashboards.
 * Returns null when the loaded report has no prior-year baseline (compare would
 * overlap the dataset start or fall entirely on/after reportStart).
 */
export function priorYearCompareWindow(
  from: string,
  to: string,
  reportStart: string | null | undefined
): { from: string; to: string } | null {
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return null;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const lyFrom = shiftIsoToSameWeekdayLastYear(start);
  const lyTo = shiftIsoToSameWeekdayLastYear(end);
  if (!reportStart || !isValidIsoDate(reportStart)) {
    return { from: lyFrom, to: lyTo };
  }
  if (lyFrom >= reportStart) return null;
  const cappedTo = lyTo >= reportStart ? shiftIsoDays(reportStart, -1) : lyTo;
  if (cappedTo < lyFrom) return null;
  return { from: lyFrom, to: cappedTo };
}

/** Every calendar day from `from` to `to` inclusive (ISO dates). */
export function datesInIsoRange(from: string, to: string): string[] {
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return [];
  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
