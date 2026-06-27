import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import {
  buildCalendarVoiceScript,
  getVoiceCalendarEvents,
} from "@/lib/voice/calendar-data";
import { buildEmailVoiceScript, getVoiceEmails } from "@/lib/voice/email-data";
import { buildTasksVoiceScript } from "@/lib/voice/tool-helpers";
import { getState } from "@/lib/store/server-store";

/**
 * Compact live snapshot injected into every Realtime voice session.
 */
export async function buildVoiceLiveContext(): Promise<string> {
  const [calendar, inbox] = await Promise.all([
    getVoiceCalendarEvents(),
    getVoiceEmails(),
  ]);
  const sales = computeSalesSummary(mockSalesData);
  const calendarScript = buildCalendarVoiceScript(calendar.events, calendar.tz);
  const emailScript = buildEmailVoiceScript(inbox.emails);
  const state = getState();
  const tasksScript = buildTasksVoiceScript(state.reminders);
  const pendingDraft = state.pendingActions.find((a) => a.type === "email");

  return `
CURRENT DATE/TIME (${calendar.tz}): ${new Date().toLocaleString("en-US", { timeZone: calendar.tz })}
TODAY: ${calendar.todayKey}

CALENDAR (${calendar.googleConnected ? "Google" : "demo"}) — ${calendar.events.length} event(s):
${calendarScript}

INBOX (${inbox.googleConnected ? "Gmail" : "demo"}) — ${inbox.emails.length} email(s):
${emailScript}

TASKS — ${state.reminders.filter((r) => !r.completed).length} pending:
${tasksScript}

SALES (demo POS): $${sales.totalRevenue.toLocaleString()} today.
${pendingDraft ? `\nEMAIL DRAFT READY: ${pendingDraft.title} — user can review on AI Chat.` : ""}

CRITICAL: Use tools for writes (add/delete task, add/delete meeting, draft email). Never invent data. Email questions → inbox only. Calendar → calendar only.
`.trim();
}
