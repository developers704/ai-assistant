import type { CalendarEvent } from "@/types";
import { getState } from "@/lib/store/server-store";
import { isGoogleConnected, getGoogleTokens } from "@/lib/google/token-store";
import { getAuthenticatedClient } from "@/lib/google/client";
import { fetchGoogleCalendarEvents } from "@/lib/google/calendar";
import { getGoogleCache, setGoogleCache } from "@/lib/google/cache";
import { filterCalendarEvents } from "@/lib/calendar-utils";
import { withTimeout } from "@/lib/async-utils";
import {
  dateKeyInTimezone,
  isEventOnDate,
  userTimezone,
} from "@/lib/calendar-dates";

const CALENDAR_FETCH_TIMEOUT_MS = 10000;

function formatEventTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Real Google calendar when connected — never demo mockEvents. */
export async function getVoiceCalendarEvents(): Promise<{
  events: CalendarEvent[];
  tz: string;
  todayKey: string;
  googleConnected: boolean;
  source: "google" | "google-cache" | "demo" | "empty";
}> {
  const state = getState();
  const tz = userTimezone(state);
  const todayKey = dateKeyInTimezone(new Date(), tz);
  const googleConnected = isGoogleConnected();

  if (!googleConnected) {
    const demo = filterCalendarEvents(state.events).filter(
      (e) => e.status !== "cancelled" && isEventOnDate(e.start, todayKey, tz)
    );
    return { events: demo, tz, todayKey, googleConnected: false, source: "demo" };
  }

  const cached = getGoogleCache();
  if (cached?.events?.length) {
    const events = filterCalendarEvents(cached.events).filter(
      (e) => e.status !== "cancelled" && isEventOnDate(e.start, todayKey, tz)
    );
    return { events, tz, todayKey, googleConnected: true, source: "google-cache" };
  }

  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      return { events: [], tz, todayKey, googleConnected: true, source: "empty" };
    }

    const fetched = await withTimeout(
      fetchGoogleCalendarEvents(client, tz),
      CALENDAR_FETCH_TIMEOUT_MS,
      "Google calendar fetch"
    );
    const filtered = filterCalendarEvents(fetched);
    const integration = {
      connected: true as const,
      email: getGoogleTokens()?.email,
    };
    setGoogleCache({
      emails: cached?.emails ?? [],
      events: filtered,
      integration,
    });

    const todayEvents = filtered.filter(
      (e) => e.status !== "cancelled" && isEventOnDate(e.start, todayKey, tz)
    );
    return {
      events: todayEvents,
      tz,
      todayKey,
      googleConnected: true,
      source: "google",
    };
  } catch (err) {
    console.warn("Voice calendar fetch failed:", err);
    return { events: [], tz, todayKey, googleConnected: true, source: "empty" };
  }
}

export function buildCalendarVoiceScript(
  events: CalendarEvent[],
  tz: string
): string {
  if (events.length === 0) {
    return "Your calendar is clear today — you have no events scheduled.";
  }

  if (events.length === 1) {
    const e = events[0];
    const time = formatEventTime(e.start, tz);
    return `You have one event today: ${e.title}, at ${time}.`;
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  const parts = sorted.slice(0, 4).map((e) => {
    return `${e.title} at ${formatEventTime(e.start, tz)}`;
  });
  const rest = sorted.length > 4 ? ` and ${sorted.length - 4} more` : "";
  return `You have ${sorted.length} events today: ${parts.join("; ")}${rest}.`;
}
