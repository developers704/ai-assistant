import type { CalendarEvent, Reminder } from "@/types";

export function matchByTitle<T extends { title: string; id: string }>(
  items: T[],
  query: string
): T | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  return (
    items.find((i) => i.title.toLowerCase() === q) ||
    items.find((i) => i.title.toLowerCase().includes(q)) ||
    items.find((i) => q.includes(i.title.toLowerCase()))
  );
}

export function buildTasksVoiceScript(tasks: Reminder[]): string {
  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) {
    return "You have no pending tasks. Your task list is clear.";
  }
  if (pending.length === 1) {
    const t = pending[0];
    return `You have one pending task: ${t.title}, due ${t.dueDate}${t.dueTime ? ` at ${t.dueTime}` : ""}.`;
  }
  const names = pending
    .slice(0, 5)
    .map((t) => t.title)
    .join("; ");
  const extra = pending.length > 5 ? ` and ${pending.length - 5} more` : "";
  return `You have ${pending.length} pending tasks: ${names}${extra}.`;
}

export function findCalendarEvent(
  events: CalendarEvent[],
  query: string
): CalendarEvent | undefined {
  return matchByTitle(events, query);
}

export function defaultMeetingEnd(startIso: string, endIso?: string): string {
  if (endIso) return endIso;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
  return new Date(start.getTime() + 60 * 60 * 1000).toISOString();
}
