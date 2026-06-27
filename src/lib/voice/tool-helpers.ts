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

/** Resolve which pending task the user means (chat, voice, or rules). */
export function resolveTaskTarget(
  message: string,
  tasks: Reminder[],
  explicitQuery?: string
): Reminder | undefined {
  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) return undefined;

  const query = explicitQuery?.trim();
  if (query) {
    const byQuery = matchByTitle(pending, query);
    if (byQuery) return byQuery;
  }

  const extractPatterns = [
    /(?:remove|delete|cancel|complete|finish|mark done)\s+(?:the\s+)?task\s+(?:about\s+|called\s+|named\s+)?(.+)/i,
    /(?:remove|delete|complete)\s+(.+?)\s+(?:from\s+)?(?:my\s+)?tasks?/i,
  ];
  for (const pattern of extractPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/[,.\s]*(this|it)\s+is\s+completed.*$/i, "").trim();
      const found = matchByTitle(pending, cleaned);
      if (found) return found;
    }
  }

  const lower = message.toLowerCase();
  if (
    /\b(this|that)\s+task\b|remove this|delete this|cancel this|the task above/i.test(lower)
  ) {
    if (pending.length === 1) return pending[0];
    const fromContext = resolveTaskFromRecentContext(message, tasks);
    if (fromContext) return fromContext;
  }

  for (const task of pending) {
    const significant = task.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    if (significant.some((w) => lower.includes(w))) {
      return task;
    }
  }

  return pending.length === 1 ? pending[0] : undefined;
}

/** When user says "this task", match a task title quoted or listed in their message. */
export function resolveTaskFromRecentContext(
  message: string,
  tasks: Reminder[]
): Reminder | undefined {
  const pending = tasks.filter((t) => !t.completed);
  let best: Reminder | undefined;
  let bestScore = 0;

  for (const task of pending) {
    const title = task.title.toLowerCase();
    if (message.toLowerCase().includes(title)) return task;

    const words = title.split(/\s+/).filter((w) => w.length > 4);
    const score = words.filter((w) => message.toLowerCase().includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = task;
    }
  }

  return bestScore >= 2 ? best : undefined;
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
