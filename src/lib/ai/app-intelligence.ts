import type { AIResponse, AppState } from "@/types";
import {
  APP_SECTIONS,
  sectionForPath,
  type AppSectionDefinition,
} from "@/lib/ai/app-map";
import { routeIntent, type RoutedIntent } from "@/lib/ai/intent-router";
import {
  buildSectionRuntimeContext,
  buildWhatCanYouDoHere,
  buildSectionExplanation,
  resolveSectionFromQuestion,
  buildExplainThis,
  type SectionRuntimeContext,
} from "@/lib/ai/section-context";
import { getActivePendingAction } from "@/lib/actions/confirmation";
import {
  isStrictConfirmMessage,
  isConfirmMessage,
} from "@/lib/actions/confirmation-messages";
import { getWorkingMemory, recordNavigationOffer, updateWorkingMemory } from "@/lib/memory/working-memory";
import { resolveContextualAffirmative } from "@/lib/ai/contextual-affirmative";

const WHAT_CAN_YOU_DO =
  /\b(what can you do|what do you do|what are you able to|help me here|your capabilities)\b/i;

const WHAT_CAN_IN =
  /\bwhat can you do\b[\s\S]{0,30}\b(in|on|for)\b/i;

const WHAT_IS_SECTION =
  /\b(what is|what's|whats|explain|tell me about|describe)\b[\s\S]{0,40}\b(data analyst|analyst|news|sales|email|calendar|calculator|contacts|settings|briefing|dashboard|images?|chat)\b/i;

const EXPLAIN_THIS =
  /\b(explain this|what does this (?:show|mean)|what am i looking at|summarize this (?:page|view|dashboard|report))\b/i;

const OPEN_IT =
  /\b(open it|show more|yes open|yes pls open|go there|take me there|open that)\b/i;

/** Data/action intents — answer in chat via tools, not section explanations. */
const TOOL_ANSWER_INTENTS = new Set<RoutedIntent>([
  "calendar.read",
  "calendar.create",
  "calendar.delete",
  "calendar.delete_all",
  "email.summary",
  "email.draft",
  "sales.read",
  "sales.top_store",
  "sales.analysis",
  "contacts.search",
  "task.create",
  "task.delete",
  "news.gold",
  "news.industry",
  "image.generate",
  "knowledge.search",
  "store.nearest",
  "store.list",
  "store.lookup",
  "store.call",
  "store.opening_soon",
]);

function shouldAnswerWithTools(message: string, hasPending: boolean): boolean {
  const routed = routeIntent({ message, hasPendingAction: hasPending });
  return TOOL_ANSWER_INTENTS.has(routed);
}

function wantsLiveNews(message: string): boolean {
  const lower = message.toLowerCase();
  if (!/\b(news|market|headlines|gold|silver)\b/i.test(lower)) return false;
  return /\b(what|about|latest|tell|show|update|happening)\b/i.test(lower);
}

function offerNavigation(
  section: AppSectionDefinition,
  topic: string
): AIResponse {
  recordNavigationOffer(section.route, topic);

  return {
    intent: "general",
    message: `${buildSectionExplanation(section, false)}\n\nOpen **${section.label}** from the sidebar, or say **open ${section.label.toLowerCase()}**.`,
    speak: true,
    data: section.id === "settings" ? { navigate: section.route } : undefined,
  };
}

function handleOpenIt(ctx: SectionRuntimeContext): AIResponse | null {
  const route =
    ctx.lastSuggestedRoute ??
    ctx.pendingAction?.payload?.path?.toString() ??
    ctx.section.route;

  const section = sectionForPath(typeof route === "string" ? route : ctx.section.route);

  recordNavigationOffer(section.route, ctx.lastTopic ?? section.label);

  return {
    intent: "general",
    message: `Opening **${section.label}** for you.`,
    speak: true,
    data: { navigate: section.route },
  };
}

async function handleBareYes(message: string, state: AppState): Promise<AIResponse | null> {
  if (getActivePendingAction()) return null;
  if (!isConfirmMessage(message)) return null;
  return resolveContextualAffirmative(state, getWorkingMemory(), "chat");
}

/**
 * App Intelligence Layer — section-aware answers before generic routing.
 * Returns null when live tools or specialized routers should take over.
 */
export async function tryAppIntelligence(
  message: string,
  state: AppState
): Promise<AIResponse | null> {
  const ctx = buildSectionRuntimeContext(state);
  const lower = message.toLowerCase().trim();
  const pending = getActivePendingAction();

  if (wantsLiveNews(message)) {
    return null;
  }

  if (OPEN_IT.test(lower) && !pending) {
    return handleOpenIt(ctx);
  }

  if (isStrictConfirmMessage(lower) && !pending) {
    const contextual = await handleBareYes(message, state);
    if (contextual) return contextual;
    return null;
  }

  if (EXPLAIN_THIS.test(lower)) {
    const text = buildExplainThis(ctx, message);
    if (text) {
      recordNavigationOffer(ctx.section.route, ctx.section.label);
      return { intent: "general", message: text, speak: true };
    }
  }

  if (WHAT_CAN_YOU_DO.test(lower) && !WHAT_CAN_IN.test(lower)) {
    recordNavigationOffer(ctx.section.route, ctx.section.label);
    return {
      intent: "help",
      message: buildWhatCanYouDoHere(ctx),
      speak: true,
    };
  }

  if (WHAT_CAN_IN.test(lower) || (WHAT_CAN_YOU_DO.test(lower) && WHAT_CAN_IN.test(lower))) {
    const sec = resolveSectionFromQuestion(message) ?? ctx.section;
    recordNavigationOffer(sec.route, sec.label);
    return {
      intent: "help",
      message: `**${sec.label}**\n\n${sec.exampleResponses.capabilities ?? sec.purpose}\n\nOpen **${sec.label}** from the sidebar, or say **open ${sec.label.toLowerCase()}**.`,
      speak: true,
    };
  }

  if (WHAT_IS_SECTION.test(lower) && !shouldAnswerWithTools(message, !!pending)) {
    const sec = resolveSectionFromQuestion(message) ?? sectionFromAliases(lower);
    if (sec) {
      recordNavigationOffer(sec.route, sec.label);
      return offerNavigation(sec, sec.label);
    }
  }

  return null;
}

function sectionFromAliases(lower: string): AppSectionDefinition | null {
  for (const sec of Object.values(APP_SECTIONS)) {
    if (sec.aliases.some((a) => lower.includes(a))) return sec;
  }
  return null;
}

/** Persist intelligence state after tool execution (call from router). */
export function recordToolIntelligence(toolName: string, summary: string): void {
  updateWorkingMemory({
    lastToolResultSummary: summary.slice(0, 200),
  });
}

/** Full app map summary for LLM system prompts. */
export function buildAppMapPromptBlock(): string {
  const lines = Object.values(APP_SECTIONS).map(
    (s) =>
      `- **${s.label}** (${s.route}): ${s.purpose} Tools: ${s.relatedTools.slice(0, 4).join(", ")}.`
  );
  return `## APP SECTIONS\n${lines.join("\n")}`;
}
