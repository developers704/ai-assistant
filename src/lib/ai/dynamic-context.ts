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
import { buildSectionContextBlock, buildSectionRuntimeContext } from "@/lib/ai/section-context";
import { getLatestReportWithSummary } from "@/lib/reports/store";

/** Compact catalog so voice can pass real filter names into sales tools. */
function buildSalesFilterCatalogLine(): string {
  const report = getLatestReportWithSummary();
  if (!report) return "SALES FILTERS: no report loaded";

  const clip = (vals: string[], n: number) => {
    if (!vals.length) return "(none)";
    const shown = vals.slice(0, n);
    const more = vals.length > n ? ` +${vals.length - n} more` : "";
    return `${shown.join(", ")}${more}`;
  };

  const dates = report.availableDates ?? [];
  const dateSpan =
    dates.length > 0 ? `${dates[0]} → ${dates[dates.length - 1]} (${dates.length} days)` : "(none)";

  return [
    `SALES FILTERS (use exact names with apply_sales_dashboard_filters / query_sales):`,
    `  dates: ${dateSpan}`,
    `  stores: ${clip(report.availableStores ?? [], 12)}`,
    `  departments: ${clip(report.availableDepartments ?? [], 12)}`,
    `  designs: ${clip(report.availableDesigns ?? [], 12)}`,
    `  classes: ${clip(report.availableClasses ?? [], 10)}`,
    `  vendors: ${clip(report.availableVendors ?? [], 10)}`,
  ].join("\n");
}

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

  const sectionCtx = buildSectionRuntimeContext(state);
  const sectionBlock = buildSectionContextBlock(sectionCtx);

  const lines = [
    `TIME: ${ctx.currentTime} (${ctx.timezone})`,
    `USER: ${ctx.userProfile}`,
    `PAGE: ${ctx.currentPage}`,
    sectionBlock,
    ctx.selectedEmail ? `SELECTED EMAIL: ${ctx.selectedEmail}` : "",
    ctx.selectedMeeting ? `SELECTED MEETING: ${ctx.selectedMeeting}` : "",
    ctx.selectedReport ? `REPORT: ${ctx.selectedReport}` : "",
    ctx.selectedContact ? `SELECTED CONTACT: ${ctx.selectedContact}` : "",
    ctx.pendingAction ? `PENDING: ${ctx.pendingAction}` : "",
    `SALES: ${ctx.latestSalesSummary}`,
    buildSalesFilterCatalogLine(),
    `CALENDAR (top): ${ctx.todayCalendarSummary}`,
    `INBOX (top): ${ctx.inboxSummary}`,
    `TASKS: ${ctx.pendingTasksSummary}`,
    ctx.relevantMemory !== "None" ? `MEMORY: ${ctx.relevantMemory}` : "",
  ].filter(Boolean);

  ctx.textBlock = lines.join("\n");
  return ctx;
}
