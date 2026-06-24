import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import {
  buildCalendarVoiceScript,
  getVoiceCalendarEvents,
} from "@/lib/voice/calendar-data";
import { buildEmailVoiceScript, getVoiceEmails } from "@/lib/voice/email-data";

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

  return `
CURRENT DATE/TIME (${calendar.tz}): ${new Date().toLocaleString("en-US", { timeZone: calendar.tz })}
TODAY: ${calendar.todayKey}

CALENDAR (${calendar.googleConnected ? "Google" : "demo"}) — ${calendar.events.length} event(s):
${calendarScript}

INBOX (${inbox.googleConnected ? "Gmail" : "demo"}) — ${inbox.emails.length} email(s):
${emailScript}

SALES (demo POS): $${sales.totalRevenue.toLocaleString()} today.

CRITICAL: Answer email questions from INBOX data only. Answer calendar questions from CALENDAR data only. Never mix them.
`.trim();
}
