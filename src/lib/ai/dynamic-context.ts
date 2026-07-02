import type { AppState } from "@/types";
import { getAssistantSalesSummary } from "@/lib/assistant/sales-data";
import { formatCurrency } from "@/lib/utils";
import { buildEmailVoiceScript, getVoiceEmails } from "@/lib/voice/email-data";
import { buildCalendarVoiceScript, getVoiceCalendarEvents } from "@/lib/voice/calendar-data";
import { buildTasksVoiceScript } from "@/lib/voice/tool-helpers";
import { retrieveRelevantMemories } from "@/lib/memory/retrieve";
import { loadConversationSummaries } from "@/lib/memory/store";
import { getUiContext } from "@/lib/store/ui-context";
import { userTimezone } from "@/lib/calendar-dates";

export interface CompactDynamicContext {
  currentTime: string;
  timezone: string;
  userProfile: string;
  currentPage: string;
  selectedEmail?: string;
  selectedMeeting?: string;
  selectedReport?: string;
  selectedContact?: string;
  pendingAction?: string;
  latestSalesSummary: string;
  todayCalendarSummary: string;
  inboxSummary: string;
  pendingTasksSummary: string;
  relevantMemory: string;
  recentConversationSummary: string;
  textBlock: string;
}

/**
 * Shared compact context for Voice + Chat.
 * Keep short — full detail via tools, not prompt injection.
 */
export async function buildDynamicContext(
  state: AppState,
  userMessage?: string
): Promise<CompactDynamicContext> {
  const ui = state.uiContext ?? getUiContext();
  const tz = userTimezone(state);
  const now = new Date();

  const [calendar, inbox] = await Promise.all([
    getVoiceCalendarEvents(),
    getVoiceEmails(),
  ]);

  const salesBundle = getAssistantSalesSummary();
  const salesLine =
    salesBundle.source === "report"
      ? `${formatCurrency(salesBundle.summary.totalRevenue)} net, ${salesBundle.summary.totalTransactions} units (${salesBundle.label ?? "report"})`
      : `${formatCurrency(salesBundle.summary.totalRevenue)} demo sales`;

  const selectedEmail = ui.selectedEmailId
    ? state.emails.find((e) => e.id === ui.selectedEmailId)
    : undefined;
  const selectedMeeting = ui.selectedMeetingId
    ? state.events.find((e) => e.id === ui.selectedMeetingId)
    : undefined;
  const selectedContact = ui.selectedContactId
    ? state.contacts.find((c) => c.id === ui.selectedContactId)
    : undefined;

  const pending = state.pendingActions[0];
  const memories = userMessage ? retrieveRelevantMemories(userMessage, 3) : [];
  const summaries = loadConversationSummaries(1);

  const userProfile = state.user
    ? `${state.user.name}, ${state.user.role} @ ${state.user.company}`
    : "Executive";

  const ctx: CompactDynamicContext = {
    currentTime: now.toLocaleString("en-US", { timeZone: tz }),
    timezone: tz,
    userProfile,
    currentPage: ui.currentPath || "/chat",
    selectedEmail: selectedEmail
      ? `${selectedEmail.from} — "${selectedEmail.subject}"`
      : undefined,
    selectedMeeting: selectedMeeting ? `${selectedMeeting.title}` : undefined,
    selectedReport: ui.selectedReportId ?? salesBundle.label,
    selectedContact: selectedContact?.name,
    pendingAction: pending ? `${pending.type}: ${pending.title}` : undefined,
    latestSalesSummary: salesLine,
    todayCalendarSummary: buildCalendarVoiceScript(calendar.events.slice(0, 4), calendar.tz),
    inboxSummary: buildEmailVoiceScript(inbox.emails.slice(0, 5)),
    pendingTasksSummary: buildTasksVoiceScript(
      state.reminders.filter((r) => !r.completed).slice(0, 5)
    ),
    relevantMemory: memories.join(" | ") || "None",
    recentConversationSummary: summaries[0] ?? "None",
    textBlock: "",
  };

  const lines = [
    `TIME: ${ctx.currentTime} (${ctx.timezone})`,
    `USER: ${ctx.userProfile}`,
    `PAGE: ${ctx.currentPage}`,
    ctx.selectedEmail ? `SELECTED EMAIL: ${ctx.selectedEmail}` : "",
    ctx.selectedMeeting ? `SELECTED MEETING: ${ctx.selectedMeeting}` : "",
    ctx.selectedReport ? `REPORT: ${ctx.selectedReport}` : "",
    ctx.selectedContact ? `SELECTED CONTACT: ${ctx.selectedContact}` : "",
    ctx.pendingAction ? `PENDING: ${ctx.pendingAction}` : "",
    `SALES: ${ctx.latestSalesSummary}`,
    `CALENDAR (top): ${ctx.todayCalendarSummary}`,
    `INBOX (top): ${ctx.inboxSummary}`,
    `TASKS: ${ctx.pendingTasksSummary}`,
    ctx.relevantMemory !== "None" ? `MEMORY: ${ctx.relevantMemory}` : "",
  ].filter(Boolean);

  ctx.textBlock = lines.join("\n");
  return ctx;
}
