import { NextResponse } from "next/server";
import {
  buildCalendarVoiceScript,
  getVoiceCalendarEvents,
} from "@/lib/voice/calendar-data";

export const runtime = "nodejs";

export async function GET() {
  const { events, tz, googleConnected, source } = await getVoiceCalendarEvents();
  const script = buildCalendarVoiceScript(events, tz);

  return NextResponse.json({
    script,
    eventCount: events.length,
    events: events.map((e) => ({
      title: e.title,
      start: e.start,
      startLocal: new Date(e.start).toLocaleString("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    })),
    googleConnected,
    source,
    uiAction: { type: "navigate", path: "/calendar" },
  });
}
