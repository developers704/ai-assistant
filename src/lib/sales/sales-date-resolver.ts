import { extractSalesDateFromMessage, isValidIsoDate } from "@/lib/reports/date-utils";
import type { SalesDateRangeInput, SalesDateRangeType, SalesResolvedDateRange } from "./sales-types";

const BUSINESS_TZ = process.env.BUSINESS_TIMEZONE || "America/Los_Angeles";

function zonedParts(date = new Date()): { y: number; m: number; d: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  ) as Record<string, string>;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    y: parseInt(parts.year, 10),
    m: parseInt(parts.month, 10),
    d: parseInt(parts.day, 10),
    weekday: weekdayMap[parts.weekday] ?? date.getDay(),
  };
}

function isoFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function todayIso(): string {
  const p = zonedParts();
  return isoFromParts(p.y, p.m, p.d);
}

function startOfWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(iso, mondayOffset);
}

function datesBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function labelRange(start: string | null, end: string | null, type: string): string {
  if (!start && !end) return "all report dates";
  if (start && end && start === end) return start;
  if (start && end) return `${start} to ${end}`;
  return type;
}

export function resolveDateRange(
  input: SalesDateRangeInput | undefined,
  availableDates: string[],
  userMessage?: string
): SalesResolvedDateRange & { unavailableReason?: string } {
  const sorted = [...availableDates].filter(isValidIsoDate).sort();
  const reportStart = sorted[0] ?? null;
  const reportEnd = sorted[sorted.length - 1] ?? null;
  const today = todayIso();

  let type: SalesDateRangeType | "report_all" = input?.type ?? "all_dates";
  let start = input?.startDate ?? null;
  let end = input?.endDate ?? null;

  // NL extraction when type not explicit
  if ((!input?.type || input.type === "all_dates") && !start && userMessage) {
    const fromMsg = extractSalesDateFromMessage(userMessage, availableDates);
    if (fromMsg) {
      type = "custom";
      start = fromMsg;
      end = fromMsg;
    } else {
      const nl = detectRelativeDate(userMessage);
      if (nl) {
        type = nl.type;
        start = nl.start;
        end = nl.end;
      }
    }
  }

  switch (type) {
    case "today":
      start = today;
      end = today;
      break;
    case "yesterday":
    case "previous_business_day": {
      let y = addDays(today, -1);
      if (type === "previous_business_day") {
        const p = zonedParts(new Date(`${y}T12:00:00`));
        if (p.weekday === 0) y = addDays(y, -2);
        if (p.weekday === 6) y = addDays(y, -1);
      }
      start = y;
      end = y;
      break;
    }
    case "this_week": {
      const sow = startOfWeek(today);
      start = sow;
      end = today;
      break;
    }
    case "last_week": {
      const sow = startOfWeek(today);
      end = addDays(sow, -1);
      start = addDays(end, -6);
      break;
    }
    case "this_month": {
      const p = zonedParts();
      start = isoFromParts(p.y, p.m, 1);
      end = today;
      break;
    }
    case "last_month": {
      const p = zonedParts();
      const lm = p.m === 1 ? 12 : p.m - 1;
      const ly = p.m === 1 ? p.y - 1 : p.y;
      start = isoFromParts(ly, lm, 1);
      const lastDay = new Date(Date.UTC(ly, lm, 0)).getUTCDate();
      end = isoFromParts(ly, lm, lastDay);
      break;
    }
    case "last_7_days":
    case "past_7_days":
      end = today;
      start = addDays(today, -6);
      break;
    case "past_30_days":
      end = today;
      start = addDays(today, -29);
      break;
    case "day_before_yesterday": {
      const d = addDays(today, -2);
      start = d;
      end = d;
      break;
    }
    case "year_to_date": {
      const p = zonedParts();
      start = isoFromParts(p.y, 1, 1);
      end = today;
      break;
    }
    case "last_year": {
      const p = zonedParts();
      start = isoFromParts(p.y - 1, 1, 1);
      end = isoFromParts(p.y - 1, 12, 31);
      break;
    }
    case "this_quarter": {
      const p = zonedParts();
      const qStartMonth = Math.floor((p.m - 1) / 3) * 3 + 1;
      start = isoFromParts(p.y, qStartMonth, 1);
      end = today;
      break;
    }
    case "last_quarter": {
      const p = zonedParts();
      const qStartMonth = Math.floor((p.m - 1) / 3) * 3 + 1;
      let ly = p.y;
      let lm = qStartMonth - 3;
      if (lm < 1) {
        lm += 12;
        ly -= 1;
      }
      start = isoFromParts(ly, lm, 1);
      const endMonth = lm + 2;
      const lastDay = new Date(Date.UTC(ly, endMonth, 0)).getUTCDate();
      end = isoFromParts(ly, endMonth, lastDay);
      break;
    }
    case "all_dates":
      start = null;
      end = null;
      type = "report_all";
      break;
    case "custom":
    default:
      break;
  }

  if (type === "report_all" || (!start && !end)) {
    return {
      type: "report_all",
      startDate: reportStart,
      endDate: reportEnd,
      label: reportStart && reportEnd ? labelRange(reportStart, reportEnd, "report") : "all report dates",
      dates: sorted,
    };
  }

  if (start && !end) end = start;
  if (end && !start) start = end;

  const requested = datesBetween(start!, end!);
  const availableSet = new Set(sorted);
  const intersecting = requested.filter((d) => availableSet.has(d));

  if (intersecting.length === 0) {
    return {
      type: type as SalesResolvedDateRange["type"],
      startDate: start,
      endDate: end,
      label: labelRange(start, end, String(type)),
      dates: [],
      unavailableReason:
        reportStart && reportEnd
          ? `The loaded report covers ${reportStart} through ${reportEnd}, so ${labelRange(start, end, String(type))} is not available.`
          : `Requested dates ${labelRange(start, end, String(type))} are not in the loaded report.`,
    };
  }

  return {
    type: type as SalesResolvedDateRange["type"],
    startDate: intersecting[0],
    endDate: intersecting[intersecting.length - 1],
    label: labelRange(intersecting[0], intersecting[intersecting.length - 1], String(type)),
    dates: intersecting,
  };
}

/** English + Roman Urdu relative dates. "kal" → yesterday for sales. */
export function detectRelativeDate(
  message: string
): { type: SalesDateRangeType; start: string; end: string } | null {
  const lower = message.toLowerCase();
  const today = todayIso();

  if (/\b(today|aaj)\b/i.test(lower)) {
    return { type: "today", start: today, end: today };
  }
  if (/\b(day before yesterday|parson|parso[nm]?)\b/i.test(lower)) {
    const d = addDays(today, -2);
    return { type: "day_before_yesterday", start: d, end: d };
  }
  // kal = yesterday for sales (unless clearly future)
  if (/\b(yesterday|kal)\b/i.test(lower) && !/\b(tomorrow|future)\b/i.test(lower)) {
    const y = addDays(today, -1);
    return { type: "yesterday", start: y, end: y };
  }
  if (/\b(this week|is haft[ae]y|is week)\b/i.test(lower)) {
    const sow = startOfWeek(today);
    return { type: "this_week", start: sow, end: today };
  }
  if (/\b(last week|pichl[ae]y haft[ae]y|previous week)\b/i.test(lower)) {
    const sow = startOfWeek(today);
    const end = addDays(sow, -1);
    return { type: "last_week", start: addDays(end, -6), end };
  }
  if (/\b(this month|is month|is mahina)\b/i.test(lower)) {
    const p = zonedParts();
    return { type: "this_month", start: isoFromParts(p.y, p.m, 1), end: today };
  }
  if (/\b(last month|pichl[ae]y month|pichla mahina)\b/i.test(lower)) {
    const p = zonedParts();
    const lm = p.m === 1 ? 12 : p.m - 1;
    const ly = p.m === 1 ? p.y - 1 : p.y;
    const lastDay = new Date(Date.UTC(ly, lm, 0)).getUTCDate();
    return {
      type: "last_month",
      start: isoFromParts(ly, lm, 1),
      end: isoFromParts(ly, lm, lastDay),
    };
  }
  if (/\b(year to date|ytd|is saal)\b/i.test(lower)) {
    const p = zonedParts();
    return { type: "year_to_date", start: isoFromParts(p.y, 1, 1), end: today };
  }
  if (/\b(last 7 days|past 7 days|past week|pichlay 7)\b/i.test(lower)) {
    return { type: "last_7_days", start: addDays(today, -6), end: today };
  }
  if (/\b(last 30 days|past 30 days)\b/i.test(lower)) {
    return { type: "past_30_days", start: addDays(today, -29), end: today };
  }
  // Bare year e.g. "sales for 2035"
  const yearOnly = lower.match(/\b(?:for|in)\s+(\d{4})\b/);
  if (yearOnly) {
    const y = Number(yearOnly[1]);
    if (y >= 1990 && y <= 2100) {
      return {
        type: "custom",
        start: `${y}-01-01`,
        end: `${y}-12-31`,
      };
    }
  }
  if (/\b(all dates|sab dates|poori report|full report period|show all dates)\b/i.test(lower)) {
    return null; // caller treats as all
  }

  // July 1 to July 8
  const range = lower.match(
    /\b(?:from\s+)?([a-z]+|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:to|through|-|se)\s+([a-z]+|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{1,2}(?:st|nd|rd|th)?)\b/i
  );
  if (range) {
    const a = extractSalesDateFromMessage(range[1]);
    const b = extractSalesDateFromMessage(range[2]);
    // try with month context from full message
    const fullA = extractSalesDateFromMessage(message);
    if (fullA) {
      // Prefer explicit ISO range if both ends parse from message pieces
    }
    void a;
    void b;
  }

  return null;
}

export { todayIso, addDays, BUSINESS_TZ };
