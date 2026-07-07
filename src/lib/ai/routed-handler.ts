import type { AIResponse, AppState } from "@/types";
import { routeIntent, intentToTool, type RoutedIntent } from "@/lib/ai/intent-router";
import { buildDynamicContext } from "@/lib/ai/dynamic-context";
import { runPlanner } from "@/lib/ai/planner";
import { validateToolResult } from "@/lib/ai/validator";
import { executeTool } from "@/lib/tools/registry";
import { getActivePendingAction, savePendingAction } from "@/lib/actions/confirmation";
import { extractFactsFromMessage } from "@/lib/memory/extract";
import { updateUiContext } from "@/lib/store/ui-context";
import { intentForTool } from "@/lib/assistant/format-tool-result";
import { detectSalesFocus } from "@/lib/ai/sales-focus";
import { parseMeetingFromMessage } from "@/lib/ai/meeting-parse";
import {
  resolveOpenTargetFromMessage,
  type OfferTarget,
} from "@/lib/actions/pending-offer";
import {
  synthesizeOfferExecution,
  synthesizeToolResponse,
  type AlexaChannel,
} from "@/lib/ai/response-synthesizer";
import { extractStoreQueryPhrase } from "@/lib/stores/store-intelligence";
import { recordToolIntelligence } from "@/lib/ai/app-intelligence";
import {
  isComposeEmailToPerson,
  composeEmailHasBody,
  buildComposeEmailPrompt,
} from "@/lib/ai/email-compose";
import {
  meetingRequestNeedsTime,
  buildMeetingTimeClarify,
} from "@/lib/ai/meeting-clarify";
import { recordNavigationOffer, recordToolRun } from "@/lib/memory/working-memory";
import type { ToolResult } from "@/lib/tools/types";

const FAST_READ_TOOLS = new Set([
  "get_calendar_today",
  "get_email_summary",
  "get_today_sales",
  "get_daily_briefing",
  "list_tasks",
  "list_contacts",
  "get_metal_rates",
  "get_industry_news",
  "get_sports_news",
  "get_politics_news",
  "search_company_knowledge",
  "get_store_directory",
  "find_nearest_store",
  "list_valliani_stores",
  "get_valliani_store_details",
]);

function buildSalesToolArgs(message: string, routed: RoutedIntent): Record<string, unknown> {
  const focus =
    routed === "sales.top_store"
      ? "top_store"
      : detectSalesFocus(message, routed);
  return {
    focus,
    user_message: message,
  };
}

function finalizeResponse(
  toolName: string,
  result: ToolResult,
  message: string,
  routed: RoutedIntent,
  channel: AlexaChannel
): AIResponse {
  const synthesized = synthesizeToolResponse({
    toolName,
    result,
    userMessage: message,
    routedIntent: routed,
    channel,
  });

  if (synthesized.pendingOffer && !result.pendingAction) {
    savePendingAction(synthesized.pendingOffer);
  }

  const nav = synthesized.navigateTo ?? result.navigateTo;
  recordToolRun({
    toolName,
    summary: synthesized.message.slice(0, 120),
    intent: routed,
    navigateTo: nav,
  });
  if (nav) {
    recordNavigationOffer(nav, toolName);
  }

  recordToolIntelligence(toolName, synthesized.message.slice(0, 120));

  return {
    intent: intentForTool(toolName),
    message: synthesized.message,
    speak: true,
    pendingAction: result.pendingAction ?? synthesized.pendingOffer,
    data: nav ? { navigate: nav } : undefined,
  };
}

async function executeOpenOffer(
  message: string,
  target?: OfferTarget | null
): Promise<AIResponse | null> {
  const openTarget = target ?? resolveOpenTargetFromMessage(message);
  if (!openTarget) return null;

  const synth = synthesizeOfferExecution(openTarget);
  recordNavigationOffer(synth.navigateTo ?? "/", openTarget);
  return {
    intent: "general",
    message: synth.message,
    speak: true,
    data: synth.navigateTo ? { navigate: synth.navigateTo } : undefined,
  };
}

/**
 * Deterministic pre-LLM handler — routes with priority; synthesizes focused answers.
 * Confirm/reject/open follow-ups are handled upstream in processAlexaMessage.
 */
export async function tryRoutedResponse(
  message: string,
  state: AppState,
  channel: AlexaChannel = "chat"
): Promise<AIResponse | null> {
  extractFactsFromMessage(message);

  const ui = state.uiContext;
  const hasPending = !!getActivePendingAction();

  const routed = routeIntent({
    message,
    currentPath: ui?.currentPath,
    selectedEmailId: ui?.selectedEmailId,
    selectedMeetingId: ui?.selectedMeetingId,
    hasPendingAction: hasPending,
  });

  updateUiContext({ lastUserIntent: routed });

  if (routed === "affirmative.open") {
    const opened = await executeOpenOffer(message);
    if (opened) return opened;
  }

  if (routed === "complex_planner") {
    const ctx = await buildDynamicContext(state, message);
    const plan = await runPlanner(message, ctx);
    if (plan?.steps?.length) {
      const lines: string[] = [`**${plan.goal}**`, ""];
      for (const step of plan.steps) {
        const result = await executeTool(step.tool, step.args ?? {}, {
          source: channel,
          confirmed: !step.requiresConfirmation,
        });
        validateToolResult(result);
        if (result.status === "needs_confirmation" && result.pendingAction) {
          return finalizeResponse(step.tool, result, message, routed, channel);
        }
        lines.push(`- ${step.reason}: ${result.spokenAnswer ?? result.textAnswer ?? "done"}`);
        if (!result.ok) break;
      }
      return {
        intent: "general",
        message: lines.join("\n"),
        speak: true,
      };
    }
  }

  if (
    routed === "email.draft" &&
    isComposeEmailToPerson(message) &&
    !composeEmailHasBody(message) &&
    !ui?.selectedEmailId
  ) {
    const prompt = buildComposeEmailPrompt(message, state);
    recordNavigationOffer("/email", "compose email");
    return {
      intent: "email_draft",
      message: prompt,
      speak: true,
    };
  }

  if (routed === "calendar.create" && meetingRequestNeedsTime(message)) {
    const clarify = buildMeetingTimeClarify(message, state);
    recordToolRun({
      toolName: "add_meeting",
      summary: clarify,
      intent: "calendar.create",
    });
    return {
      intent: "schedule_meeting",
      message: clarify,
      speak: true,
    };
  }

  const toolName = intentToTool(routed);

  if (toolName && FAST_READ_TOOLS.has(toolName)) {
    const args =
      toolName === "search_company_knowledge"
        ? { query: message }
        : toolName === "find_nearest_store"
          ? { user_message: message, storeName: extractStoreQueryPhrase(message), limit: 3 }
          : toolName === "list_valliani_stores"
            ? {
                state: /\b(california|ca|nevada|nv|arizona|az|texas|tx)\b/i.exec(message)?.[1],
                status: /\bopening soon\b/i.test(message) ? "Opening Soon" : undefined,
              }
            : toolName === "get_valliani_store_details"
              ? { query: extractStoreQueryPhrase(message), storeName: extractStoreQueryPhrase(message) }
          : toolName === "get_store_directory"
            ? { user_message: message, query: message }
            : toolName === "get_today_sales"
              ? buildSalesToolArgs(message, routed)
              : { user_message: message };
    const result = await executeTool(toolName, args, { source: channel });
    validateToolResult(result);
    return finalizeResponse(toolName, result, message, routed, channel);
  }

  if (routed === "email.draft") {
    const result = await executeTool(
      "draft_email_reply",
      { user_message: message },
      { source: channel }
    );
    return finalizeResponse("draft_email_reply", result, message, routed, channel);
  }

  if (routed === "calendar.create") {
    const meeting = parseMeetingFromMessage(message, state);
    const result = await executeTool(
      "add_meeting",
      {
        title: meeting.title,
        start: meeting.start,
        attendees: meeting.attendees,
        user_message: message,
      },
      { source: channel }
    );
    return finalizeResponse("add_meeting", result, message, routed, channel);
  }

  if (routed === "calendar.delete") {
    const result = await executeTool(
      "delete_meeting",
      ui?.selectedMeetingId ? { event_id: ui.selectedMeetingId } : { user_message: message },
      { source: channel }
    );
    return finalizeResponse("delete_meeting", result, message, routed, channel);
  }

  if (routed === "calendar.delete_all") {
    const result = await executeTool("delete_all_meetings", {}, { source: channel });
    return finalizeResponse("delete_all_meetings", result, message, routed, channel);
  }

  if (routed === "navigation") {
    const target = resolveOpenTargetFromMessage(message);
    if (target) {
      return executeOpenOffer(message, target);
    }
  }

  return null;
}
