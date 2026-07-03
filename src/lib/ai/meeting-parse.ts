import type { AppState } from "@/types";
import { resolveCalendarDay, userTimezone } from "@/lib/calendar-dates";

export interface ParsedMeetingRequest {
  person: string;
  displayName: string;
  title: string;
  start: string;
  timeLabel: string;
  dateLabel: string;
  attendees: string[];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build an ISO start time for calendar APIs from date + local wall clock in user TZ. */
function buildStartIso(dateKey: string, hour24: number, minute: number, timeZone: string): string {
  const utc = new Date(`${dateKey}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(utc);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+5";
  const offsetMatch = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
  let offset = "+05:00";
  if (offsetMatch) {
    const sign = offsetMatch[1];
    const oh = pad2(Number(offsetMatch[2]));
    const om = pad2(Number(offsetMatch[3] ?? "0"));
    offset = `${sign}${oh}:${om}`;
  }
  return `${dateKey}T${pad2(hour24)}:${pad2(minute)}:00${offset}`;
}

/** Parse natural-language meeting requests like "set meeting with Ross tomorrow". */
export function parseMeetingFromMessage(message: string, state: AppState): ParsedMeetingRequest {
  const tz = userTimezone(state);
  const day = resolveCalendarDay(message, tz);

  const withMatch = message.match(/\b(?:with|to)\s+([A-Za-z][A-Za-z'-]*)/i);
  const meetingMatch = message.match(/\bmeeting\s+with\s+([A-Za-z][A-Za-z'-]*)/i);
  const rawPerson = (withMatch?.[1] ?? meetingMatch?.[1] ?? "Team Member").trim();

  const contact = state.contacts.find(
    (c) =>
      c.name.toLowerCase() === rawPerson.toLowerCase() ||
      c.name.toLowerCase().startsWith(rawPerson.toLowerCase())
  );
  const displayName = contact?.name ?? rawPerson;

  const timeMatch = message.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)/i);
  let hour24 = 10;
  let minute = 0;
  let timeLabel = "10:00 AM";

  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2] ?? "0", 10);
    const period = timeMatch[3].toUpperCase();
    if (period === "PM" && hour < 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    hour24 = hour;
    timeLabel = `${timeMatch[1]}:${pad2(minute)} ${period}`;
  }

  const start = buildStartIso(day.dateKey, hour24, minute, tz);

  return {
    person: rawPerson,
    displayName,
    title: `Meeting with ${displayName}`,
    start,
    timeLabel,
    dateLabel: day.formattedDate,
    attendees: [displayName],
  };
}
