import type { AppState, Email, CalendarEvent, Contact, PendingAction } from "@/types";
import {
  type AppSectionDefinition,
  type AppSectionId,
  sectionForPath,
  sectionFromMessage,
  APP_SECTIONS,
} from "@/lib/ai/app-map";
import { getAssistantSalesSummary, formatSalesByFocus } from "@/lib/assistant/sales-data";
import { detectSalesFocus } from "@/lib/ai/sales-focus";
import { getUiContext } from "@/lib/store/ui-context";
import { formatCurrency } from "@/lib/utils";

export interface SectionRuntimeContext {
  section: AppSectionDefinition;
  currentPath: string;
  sectionId: AppSectionId;
  selectedEmail?: Email;
  selectedMeeting?: CalendarEvent;
  selectedContact?: Contact;
  selectedReportId?: string;
  pendingAction?: PendingAction;
  lastTopic?: string;
  lastSuggestedRoute?: string;
  lastToolResult?: string;
  lastUserIntent?: string;
}

export function buildSectionRuntimeContext(state: AppState): SectionRuntimeContext {
  const ui = state.uiContext ?? getUiContext();
  const path = ui.currentPath || "/chat";
  const section = sectionForPath(path);

  return {
    section,
    sectionId: section.id,
    currentPath: path,
    selectedEmail: ui.selectedEmailId
      ? state.emails.find((e) => e.id === ui.selectedEmailId)
      : undefined,
    selectedMeeting: ui.selectedMeetingId
      ? state.events.find((e) => e.id === ui.selectedMeetingId)
      : undefined,
    selectedContact: ui.selectedContactId
      ? state.contacts.find((c) => c.id === ui.selectedContactId)
      : undefined,
    selectedReportId: ui.selectedReportId,
    pendingAction: state.pendingActions[0],
    lastTopic: ui.lastTopic,
    lastSuggestedRoute: ui.lastSuggestedRoute,
    lastToolResult: ui.lastToolResult,
    lastUserIntent: ui.lastUserIntent,
  };
}

/** "What can you do here?" — grounded in current page + selections. */
export function buildWhatCanYouDoHere(ctx: SectionRuntimeContext): string {
  const base = ctx.section.exampleResponses.capabilities ?? ctx.section.purpose;
  const lines: string[] = [`**${ctx.section.label}** — ${base}`];

  if (ctx.sectionId === "email" && ctx.selectedEmail) {
    lines.push(
      `\nYou have **${ctx.selectedEmail.from}** — "${ctx.selectedEmail.subject}" selected. Say **reply to this** to draft a response.`
    );
  } else if (ctx.sectionId === "email") {
    lines.push(`\n${ctx.section.exampleResponses.replyNoSelection ?? "Select an email to reply."}`);
  }

  if (ctx.sectionId === "sales") {
    const { summary, source, label } = getAssistantSalesSummary();
    const top = summary.topStores[0];
    if (top) {
      lines.push(
        `\nLatest report${label ? ` (${label})` : ""}: **${formatCurrency(summary.totalRevenue)}** net · top store **${top.name}**.`
      );
    } else if (source === "mock") {
      lines.push("\n_Demo sales data — upload CSV in Data Analyst._");
    }
  }

  if (ctx.sectionId === "calendar" && ctx.selectedMeeting) {
    lines.push(`\nSelected meeting: **${ctx.selectedMeeting.title}**.`);
  }

  if (ctx.pendingAction) {
    lines.push(`\n⏳ Pending: **${ctx.pendingAction.title}** — say **yes** to confirm or **cancel**.`);
  }

  lines.push(`\nSay **open ${ctx.section.label.toLowerCase()}** to stay on this page, or ask a specific question.`);
  return lines.join("");
}

/** Explain a section by id or message match. */
export function buildSectionExplanation(
  section: AppSectionDefinition,
  offerOpen = true
): string {
  const explain = section.exampleResponses.explain ?? section.purpose;
  let text = explain;
  if (offerOpen) {
    text += `\n\nSay **yes** or **open it** to go to **${section.label}**.`;
  }
  return text;
}

/** Resolve section for "what can you do in news?" style questions. */
export function resolveSectionFromQuestion(message: string): AppSectionDefinition | null {
  const lower = message.toLowerCase();

  const inMatch = lower.match(
    /\b(?:in|on|for)\s+(?:the\s+)?(.+?)(?:\?|$|section|page|tab)/i
  );
  if (inMatch?.[1]) {
    const fromPhrase = sectionFromMessage(inMatch[1]);
    if (fromPhrase) return fromPhrase;
  }

  return sectionFromMessage(message);
}

/** Page-aware "explain this" without full report dumps. */
export function buildExplainThis(
  ctx: SectionRuntimeContext,
  userMessage: string
): string | null {
  switch (ctx.sectionId) {
    case "sales": {
      const focus = detectSalesFocus(userMessage, "sales.read");
      const short = formatSalesByFocus(focus === "full_report" ? "summary" : focus);
      return `**Sales view** — ${ctx.section.purpose}\n\n${short}`;
    }
    case "email": {
      if (ctx.selectedEmail) {
        const e = ctx.selectedEmail;
        return `**Selected email**\n\n**From:** ${e.from}\n**Subject:** ${e.subject}\n\n${e.preview || e.body.slice(0, 280)}${e.body.length > 280 ? "…" : ""}\n\nSay **reply to this** to draft a response.`;
      }
      return ctx.section.exampleResponses.replyNoSelection ?? null;
    }
    case "calendar": {
      if (ctx.selectedMeeting) {
        const m = ctx.selectedMeeting;
        return `**Selected meeting:** ${m.title}\n${m.description ? `\n${m.description}` : ""}\n\nAttendees: ${m.attendees.join(", ") || "—"}`;
      }
      return `**Calendar & Tasks** — select a meeting on the calendar or ask *what's on my schedule today?*`;
    }
    case "analyst":
      return buildSectionExplanation(APP_SECTIONS.analyst, false);
    case "news":
      return buildSectionExplanation(APP_SECTIONS.news, false);
    default:
      return buildSectionExplanation(ctx.section, false);
  }
}

/** Compact block for LLM / dynamic context injection. */
export function buildSectionContextBlock(ctx: SectionRuntimeContext): string {
  const lines = [
    `SECTION: ${ctx.section.label} (${ctx.section.route})`,
    `PURPOSE: ${ctx.section.purpose}`,
    `TOOLS: ${ctx.section.relatedTools.join(", ")}`,
  ];
  if (ctx.selectedEmail) lines.push(`SELECTED EMAIL: ${ctx.selectedEmail.from} — ${ctx.selectedEmail.subject}`);
  if (ctx.selectedMeeting) lines.push(`SELECTED MEETING: ${ctx.selectedMeeting.title}`);
  if (ctx.selectedContact) lines.push(`SELECTED CONTACT: ${ctx.selectedContact.name}`);
  if (ctx.selectedReportId) lines.push(`SELECTED REPORT: ${ctx.selectedReportId}`);
  if (ctx.pendingAction) lines.push(`PENDING: ${ctx.pendingAction.type} — ${ctx.pendingAction.title}`);
  if (ctx.lastTopic) lines.push(`LAST TOPIC: ${ctx.lastTopic}`);
  if (ctx.lastSuggestedRoute) lines.push(`LAST SUGGESTED ROUTE: ${ctx.lastSuggestedRoute}`);
  if (ctx.lastToolResult) lines.push(`LAST TOOL: ${ctx.lastToolResult}`);
  return lines.join("\n");
}
