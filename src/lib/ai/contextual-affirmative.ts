import type { AIResponse, AppState, WorkingMemory } from "@/types";
import { formatSalesByFocus } from "@/lib/assistant/sales-data";
import { executeTool } from "@/lib/tools/registry";
import { synthesizeToolResponse } from "@/lib/ai/response-synthesizer";
import type { AlexaChannel } from "@/lib/ai/response-synthesizer";
import { sectionForPath } from "@/lib/ai/app-map";
import { recordNavigationOffer } from "@/lib/memory/working-memory";

function lastAssistantText(state: AppState): string {
  return (
    [...state.chatHistory]
      .reverse()
      .find((m) => m.role === "assistant")
      ?.content ?? ""
  );
}

function offeredSalesBreakdown(last: string, memory: WorkingMemory): boolean {
  if (memory.lastOfferedAction === "sales:full_breakdown") return true;
  if (/want full store breakdown/i.test(last)) return true;
  if (/want full store breakdown/i.test(memory.lastToolResultSummary ?? "")) return true;
  if (/ask for \*\*full report\*\*/i.test(last)) return true;
  if (memory.lastIntent === "sales.top_store") return true;
  return false;
}

function offeredMoreDetail(last: string, memory: WorkingMemory): boolean {
  if (/want (?:the )?full|more detail|full (?:report|breakdown)/i.test(last)) return true;
  if (memory.lastIntent === "sales.read") return true;
  return false;
}

function offeredOpenPage(last: string, memory: WorkingMemory): string | null {
  if (memory.pendingNavigation) return memory.pendingNavigation;
  const openMatch = last.match(/open \*\*([^*]+)\*\* from the sidebar/i);
  if (openMatch?.[1]) {
    const label = openMatch[1].toLowerCase();
    if (label.includes("sales")) return "/sales";
    if (label.includes("news")) return "/news";
    if (label.includes("email")) return "/email";
    if (label.includes("calendar")) return "/calendar";
    if (label.includes("analyst")) return "/analyst";
    if (label.includes("contacts")) return "/contacts";
    if (label.includes("briefing") || label.includes("dashboard")) return "/dashboard";
  }
  return null;
}

/**
 * Resolve bare "yes" / "sure" / "ok" using the previous assistant turn.
 */
export async function resolveContextualAffirmative(
  state: AppState,
  memory: WorkingMemory,
  channel: AlexaChannel = "chat"
): Promise<AIResponse | null> {
  const last = lastAssistantText(state);

  if (offeredSalesBreakdown(last, memory) || offeredMoreDetail(last, memory)) {
    return {
      intent: "sales_report",
      message: formatSalesByFocus("full_report"),
      speak: true,
    };
  }

  if (memory.lastIntent === "email.summary" || /unread of \d+ messages/i.test(last)) {
    const result = await executeTool("get_email_summary", { user_message: "show my emails" }, { source: channel });
    const synth = synthesizeToolResponse({
      toolName: "get_email_summary",
      result,
      userMessage: "show my emails",
      routedIntent: "email.summary",
      channel,
    });
    return {
      intent: "email_summary",
      message: synth.message,
      speak: true,
    };
  }

  if (memory.lastIntent === "calendar.read" || /events today|meetings? scheduled/i.test(last)) {
    const result = await executeTool("get_calendar_today", { user_message: "calendar today" }, { source: channel });
    const synth = synthesizeToolResponse({
      toolName: "get_calendar_today",
      result,
      userMessage: "calendar today",
      routedIntent: "calendar.read",
      channel,
    });
    return {
      intent: "calendar_today",
      message: synth.message,
      speak: true,
    };
  }

  if (memory.lastIntent === "news.industry" || memory.lastIntent === "news.gold") {
    const tool = memory.lastIntent === "news.gold" ? "get_metal_rates" : "get_industry_news";
    const result = await executeTool(tool, { user_message: "latest news" }, { source: channel });
    const synth = synthesizeToolResponse({
      toolName: tool,
      result,
      userMessage: "latest news",
      routedIntent: memory.lastIntent,
      channel,
    });
    return {
      intent: "general",
      message: synth.message,
      speak: true,
    };
  }

  const openRoute = offeredOpenPage(last, memory);
  if (openRoute) {
    const section = sectionForPath(openRoute);
    recordNavigationOffer(section.route, section.label);
    return {
      intent: "general",
      message: `Opening **${section.label}** for you.`,
      speak: true,
      data: { navigate: section.route },
    };
  }

  return null;
}
