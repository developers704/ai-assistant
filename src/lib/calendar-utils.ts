import type { CalendarEvent, Contact } from "@/types";

/** Hide test/junk entries synced from Google Calendar. */
export function isJunkCalendarEvent(event: CalendarEvent): boolean {
  const title = event.title.trim().toLowerCase();
  return title === "test task" || title === "test" || title === "untitled";
}

export function filterCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => e.status !== "cancelled" && !isJunkCalendarEvent(e));
}

const EMAIL_NAME_HINTS: Record<string, string> = {
  "ross@vallianijewelers.com": "Ross",
  "umair@arrakconsulting.com": "Umair",
  "marketing@vallianijewelers.com": "Marketing",
  "developer@arrakconsulting.com": "Developer",
  "irtaza@valliani.app": "Irtiza - IT Head",
  "irtaza@arrakconsulting.com": "Irtiza - IT Head",
  "irtiza@valliani.app": "Irtiza - IT Head",
  "irtiza@arrakconsulting.com": "Irtiza - IT Head",
  "courtney.mcmullin@progleasing.com": "Courtney McMullin",
  "max.sutton@yondatax.com": "Max Sutton",
};

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function displayAttendee(attendee: string, contacts: Contact[] = []): string {
  const key = attendee.toLowerCase().trim();
  if (EMAIL_NAME_HINTS[key]) return EMAIL_NAME_HINTS[key];
  const local = key.split("@")[0]?.replace(/[._]/g, "") ?? "";
  if (local === "irtiza" || local === "irtaza") return "Irtiza - IT Head";

  const contact = contacts.find(
    (c) =>
      c.email?.toLowerCase() === key ||
      c.name.toLowerCase() === key.split("@")[0]?.replace(/[._]/g, " ")
  );
  if (contact) return contact.role ? `${contact.name} · ${contact.role}` : contact.name;

  const mailbox = key.split("@")[0];
  if (!mailbox) return attendee;
  if (mailbox.includes(".")) return titleCase(mailbox.replace(/\./g, " "));
  return titleCase(mailbox);
}

export function formatEventLocation(location: string): { label: string; href?: string } {
  const trimmed = location.trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
  const href = urlMatch?.[0];

  if (/teams\.microsoft|microsoft teams/i.test(trimmed)) {
    return { label: "Microsoft Teams Meeting", href: href ?? trimmed };
  }
  if (/zoom\.us|zoom meeting/i.test(trimmed)) {
    return { label: "Zoom Meeting", href: href ?? trimmed };
  }
  if (href && trimmed.length > 60) {
    return { label: trimmed.slice(0, 57) + "…", href };
  }
  return { label: trimmed, href: href && href !== trimmed ? href : undefined };
}

export function formatTimeInTimezone(dateStr: string, timezone: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function formatDateInTimezone(dateStr: string, timezone: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });
}
