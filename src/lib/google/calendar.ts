import { google } from "googleapis";
import type { GoogleOAuth2Client } from "./client";
import type { CalendarEvent } from "@/types";

function mapEventStatus(status?: string | null): CalendarEvent["status"] {
  if (status === "cancelled") return "cancelled";
  if (status === "tentative") return "tentative";
  return "confirmed";
}

function toIso(value?: string | null, dateOnly?: string | null): string {
  if (value) return new Date(value).toISOString();
  if (dateOnly) return new Date(`${dateOnly}T00:00:00`).toISOString();
  return new Date().toISOString();
}

export async function fetchGoogleCalendarEvents(
  client: GoogleOAuth2Client,
  timezone = "Asia/Karachi"
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: "v3", auth: client });

  const now = new Date();
  const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
    timeZone: timezone,
  });

  return (data.items ?? [])
    .filter((event) => event.id && event.summary)
    .map((event) => ({
      id: event.id!,
      title: event.summary!,
      description: event.description ?? undefined,
      start: toIso(event.start?.dateTime, event.start?.date),
      end: toIso(event.end?.dateTime, event.end?.date),
      location: event.location ?? undefined,
      attendees: (event.attendees ?? [])
        .map((a) => a.email || a.displayName || "")
        .filter(Boolean),
      status: mapEventStatus(event.status),
    }));
}

export async function createGoogleCalendarEvent(
  client: GoogleOAuth2Client,
  event: Omit<CalendarEvent, "id">
): Promise<CalendarEvent> {
  const calendar = google.calendar({ version: "v3", auth: client });

  const { data } = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: { dateTime: event.start },
      end: { dateTime: event.end },
      attendees: event.attendees.map((email) => ({ email })),
    },
  });

  return {
    id: data.id!,
    title: data.summary || event.title,
    description: data.description ?? event.description,
    start: toIso(data.start?.dateTime, data.start?.date),
    end: toIso(data.end?.dateTime, data.end?.date),
    location: data.location ?? event.location,
    attendees: (data.attendees ?? []).map((a) => a.email || "").filter(Boolean),
    status: mapEventStatus(data.status),
  };
}

export async function deleteGoogleCalendarEvent(
  client: GoogleOAuth2Client,
  eventId: string
): Promise<void> {
  const calendar = google.calendar({ version: "v3", auth: client });
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
}
