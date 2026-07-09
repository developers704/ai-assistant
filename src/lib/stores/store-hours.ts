import type { StoreDirectoryEntry } from "@/lib/stores/types";

/** Default US timezones by state — stores open/close on local US time, not Pakistan. */
const STATE_TIMEZONES: Record<string, string> = {
  CA: "America/Los_Angeles",
  NV: "America/Los_Angeles",
  AZ: "America/Phoenix",
  TX: "America/Chicago",
};

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number];

export function resolveStoreTimezone(
  store: Pick<StoreDirectoryEntry, "timezone" | "stateCode">
): string {
  if (store.timezone?.trim()) return store.timezone.trim();
  return STATE_TIMEZONES[store.stateCode?.toUpperCase() ?? ""] ?? "America/Los_Angeles";
}

/** Short label for UI, e.g. "PT", "CT", "MST". */
export function timezoneShortLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

export function getStoreLocalParts(
  store: Pick<StoreDirectoryEntry, "timezone" | "stateCode">,
  at: Date = new Date()
): { weekday: WeekdayKey; hour: number; minute: number; dateLabel: string } {
  const tz = resolveStoreTimezone(store);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    month: "short",
    day: "numeric",
  }).formatToParts(at);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekdayName = get("weekday").toLowerCase() as WeekdayKey;
  let hour = parseInt(get("hour"), 10);
  // Some engines use 24:00 for midnight — normalize
  if (hour === 24) hour = 0;
  const minute = parseInt(get("minute"), 10) || 0;

  return {
    weekday: WEEKDAYS.includes(weekdayName) ? weekdayName : "monday",
    hour,
    minute,
    dateLabel: `${get("month")} ${get("day")}`,
  };
}

/** Parse "10:00 AM - 9:00 PM" or "11am-7pm" into minutes-from-midnight. */
export function parseHourRange(
  raw: string
): { openMin: number; closeMin: number } | null {
  const cleaned = raw
    .replace(/\u202f/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  );
  if (!match) return null;

  const toMin = (hStr: string, mStr: string | undefined, mer: string | undefined, inherit?: string) => {
    let h = parseInt(hStr, 10);
    const m = mStr ? parseInt(mStr, 10) : 0;
    const meridian = (mer || inherit || "").toLowerCase();
    if (meridian === "pm" && h < 12) h += 12;
    if (meridian === "am" && h === 12) h = 0;
    // 12:00 AM = midnight end-of-day for close times is handled by caller if needed
    return h * 60 + m;
  };

  const closeMer = match[6];
  const openMer = match[3] || closeMer;
  const openMin = toMin(match[1], match[2], openMer, closeMer);
  let closeMin = toMin(match[4], match[5], closeMer, openMer);

  // "12:00 AM" as close usually means midnight (end of day) → 24:00
  if (/12(?::00)?\s*am/i.test(cleaned.split(/[-–—to]+/i)[1] ?? "") && closeMin === 0) {
    closeMin = 24 * 60;
  }

  return { openMin, closeMin };
}

export function getTodayHoursString(
  store: Pick<StoreDirectoryEntry, "openingHours" | "timezone" | "stateCode">,
  at: Date = new Date()
): string | null {
  const hours = store.openingHours;
  if (!hours) return null;
  if (typeof hours === "string") return hours;

  const { weekday } = getStoreLocalParts(store, at);
  const today = hours[weekday];
  if (today) return today;

  const first = Object.entries(hours).find(([, v]) => v);
  return first ? String(first[1]) : null;
}

export type StoreOpenStatus = {
  /** Permanently listed as Opening Soon / Closed in directory */
  listingStatus: "open" | "opening_soon" | "closed" | "unknown";
  /** Based on today's hours in the store's US timezone */
  isOpenNow: boolean | null;
  label: string;
  todayHours: string | null;
  timezone: string;
  tzLabel: string;
  localWeekday: string;
};

export function getStoreOpenStatus(
  store: StoreDirectoryEntry,
  at: Date = new Date()
): StoreOpenStatus {
  const tz = resolveStoreTimezone(store);
  const tzLabel = timezoneShortLabel(tz);
  const { weekday } = getStoreLocalParts(store, at);
  const todayHours = getTodayHoursString(store, at);

  const statusRaw = String(store.status ?? "").toLowerCase();
  let listingStatus: StoreOpenStatus["listingStatus"] = "unknown";
  if (/opening\s*soon/.test(statusRaw)) listingStatus = "opening_soon";
  else if (/closed/.test(statusRaw)) listingStatus = "closed";
  else if (/open/.test(statusRaw)) listingStatus = "open";

  if (listingStatus === "opening_soon") {
    return {
      listingStatus,
      isOpenNow: false,
      label: "Opening soon",
      todayHours,
      timezone: tz,
      tzLabel,
      localWeekday: weekday,
    };
  }

  if (listingStatus === "closed") {
    return {
      listingStatus,
      isOpenNow: false,
      label: "Closed",
      todayHours,
      timezone: tz,
      tzLabel,
      localWeekday: weekday,
    };
  }

  if (!todayHours) {
    return {
      listingStatus,
      isOpenNow: null,
      label: listingStatus === "open" ? "Open" : "Hours unknown",
      todayHours: null,
      timezone: tz,
      tzLabel,
      localWeekday: weekday,
    };
  }

  const range = parseHourRange(todayHours);
  if (!range) {
    return {
      listingStatus,
      isOpenNow: null,
      label: "See hours",
      todayHours,
      timezone: tz,
      tzLabel,
      localWeekday: weekday,
    };
  }

  const { hour, minute } = getStoreLocalParts(store, at);
  const nowMin = hour * 60 + minute;
  const { openMin, closeMin } = range;

  // Overnight ranges (e.g. 11am–12am)
  let isOpenNow: boolean;
  if (closeMin <= openMin) {
    isOpenNow = nowMin >= openMin || nowMin < closeMin;
  } else {
    isOpenNow = nowMin >= openMin && nowMin < closeMin;
  }

  return {
    listingStatus,
    isOpenNow,
    label: isOpenNow ? "Open now" : "Closed now",
    todayHours,
    timezone: tz,
    tzLabel,
    localWeekday: weekday,
  };
}

/** UI line: "Today (Thu, PT): 10:00 AM - 9:00 PM" */
export function formatTodayHoursLabel(store: StoreDirectoryEntry, at: Date = new Date()): string | null {
  const status = getStoreOpenStatus(store, at);
  if (!status.todayHours) {
    return typeof store.hoursRaw === "string" ? store.hoursRaw : null;
  }
  const dayShort =
    status.localWeekday.charAt(0).toUpperCase() + status.localWeekday.slice(1, 3);
  return `Today (${dayShort}, ${status.tzLabel}): ${status.todayHours}`;
}

const WEEKDAY_DISPLAY: { key: WeekdayKey; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

/** Ordered Mon–Sun rows for the selected-store hours panel. */
export function getWeeklyHoursRows(
  store: Pick<StoreDirectoryEntry, "openingHours" | "timezone" | "stateCode">,
  at: Date = new Date()
): Array<{ key: WeekdayKey; label: string; hours: string | null; isToday: boolean }> {
  const { weekday } = getStoreLocalParts(store, at);
  const hours = store.openingHours;

  if (!hours || typeof hours === "string") {
    return WEEKDAY_DISPLAY.map((d) => ({
      ...d,
      hours: typeof hours === "string" ? hours : null,
      isToday: d.key === weekday,
    }));
  }

  return WEEKDAY_DISPLAY.map((d) => ({
    ...d,
    hours: hours[d.key] ? String(hours[d.key]) : null,
    isToday: d.key === weekday,
  }));
}
