import type { AppState } from "@/types";
import { parseMeetingFromMessage } from "@/lib/ai/meeting-parse";

/** Meeting request missing an explicit time (e.g. "set meeting with Ross tomorrow"). */
export function meetingRequestNeedsTime(message: string): boolean {
  const lower = message.toLowerCase();
  const isSchedule =
    /\b(set|schedule|book|create|add|plan)\b/i.test(lower) ||
    /\bmeeting\s+with\b/i.test(lower);
  if (!isSchedule) return false;
  if (/\d{1,2}\s*(?::\d{2})?\s*(am|pm)/i.test(lower)) return false;
  if (!/\b(with|to)\s+[a-z]/i.test(lower) && !/\bmeeting\s+with\b/i.test(lower)) return false;
  return true;
}

export function buildMeetingTimeClarify(message: string, state: AppState): string {
  const parsed = parseMeetingFromMessage(message, state);
  const day = /tomorrow/i.test(message)
    ? "tomorrow"
    : /today/i.test(message)
      ? "today"
      : parsed.dateLabel;
  return `What time ${day} should I schedule the meeting with **${parsed.displayName}**?`;
}
