import type { AIResponse, AppState } from "@/types";
import { routeIntent, intentToTool, type RoutedIntent } from "@/lib/ai/intent-router";
import { buildDynamicContext } from "@/lib/ai/dynamic-context";
import { runPlanner } from "@/lib/ai/planner";
import { validateToolResult } from "@/lib/ai/validator";
import { executeTool, executeConfirmedPending } from "@/lib/tools/registry";
import {
  clearPendingActions,
  getActivePendingAction,
  savePendingAction,
} from "@/lib/actions/confirmation";
import {
  isConfirmMessage,
  isRejectMessage,
  isStrictConfirmMessage,
} from "@/lib/actions/confirmation-messages";
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
} from "@/lib/ai/response-synthesizer";
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
  routed: RoutedIntent
): AIResponse {
  const synthesized = synthesizeToolResponse({
    toolName,
    result,
    userMessage: message,
    routedIntent: routed,
  });

  if (synthesized.pendingOffer && !result.pendingAction) {
    savePendingAction(synthesized.pendingOffer);
  }

  return {
    intent: intentForTool(toolName),
    message: synthesized.message,
    speak: true,
    pendingAction: result.pendingAction ?? synthesized.pendingOffer,
    data:
      synthesized.navigateTo ?? result.navigateTo
        ? { navigate: synthesized.navigateTo ?? result.navigateTo }
        : undefined,
  };
}

async function executeOpenOffer(
  message: string,
  target?: OfferTarget | null
): Promise<AIResponse | null> {
  const pending = getActivePendingAction();

  if (pending) {
    const result = await executeConfirmedPending({ source: "chat" });
    if (result) {
      const synth = synthesizeOfferExecution(
        (pending.payload.target as OfferTarget) ?? "news",
        result
      );
      return {
        intent: "general",
        message: synth.message,
        speak: true,
        data: synth.navigateTo ? { navigate: synth.navigateTo } : undefined,
      };
    }
  }

  const openTarget = target ?? resolveOpenTargetFromMessage(message);
  if (!openTarget) return null;

  const synth = synthesizeOfferExecution(openTarget);
  return {
    intent: "general",
    message: synth.message,
    speak: true,
    data: synth.navigateTo ? { navigate: synth.navigateTo } : undefined,
  };
}

/**
 * Deterministic pre-LLM handler — routes with priority; synthesizes focused answers.
 */
export async function tryRoutedResponse(
  message: string,
  state: AppState
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

  if (isRejectMessage(message) || routed === "reject") {
    clearPendingActions();
    return {
      intent: "reject_action",
      message: "Cancelled. What would you like to do next?",
      speak: true,
    };
  }

  if (routed === "affirmative.open") {
    const opened = await executeOpenOffer(message);
    if (opened) return opened;
    if (!hasPending) return null;
  }

  if (
    (routed === "confirm" || isStrictConfirmMessage(message)) &&
    hasPending
  ) {
    const result = await executeConfirmedPending({ source: "chat" });
    if (result) {
      return finalizeResponse(result.toolName, result, message, routed);
    }
  }

  if (isConfirmMessage(message) && !hasPending) {
    return null;
  }

  if (routed === "complex_planner") {
    const ctx = await buildDynamicContext(state, message);
    const plan = await runPlanner(message, ctx);
    if (plan?.steps?.length) {
      const lines: string[] = [`**${plan.goal}**`, ""];
      for (const step of plan.steps) {
        const result = await executeTool(step.tool, step.args ?? {}, {
          source: "chat",
          confirmed: !step.requiresConfirmation,
        });
        validateToolResult(result);
        if (result.status === "needs_confirmation" && result.pendingAction) {
          return finalizeResponse(step.tool, result, message, routed);
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

  const toolName = intentToTool(routed);

  if (toolName && FAST_READ_TOOLS.has(toolName)) {
    const args =
      toolName === "search_company_knowledge"
        ? { query: message }
        : toolName === "get_today_sales"
          ? buildSalesToolArgs(message, routed)
          : { user_message: message };
    const result = await executeTool(toolName, args, { source: "chat" });
    validateToolResult(result);
    return finalizeResponse(toolName, result, message, routed);
  }

  if (routed === "email.draft") {
    const result = await executeTool(
      "draft_email_reply",
      { user_message: message },
      { source: "chat" }
    );
    return finalizeResponse("draft_email_reply", result, message, routed);
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
      { source: "chat" }
    );
    return finalizeResponse("add_meeting", result, message, routed);
  }

  if (routed === "calendar.delete") {
    const result = await executeTool(
      "delete_meeting",
      ui?.selectedMeetingId ? { event_id: ui.selectedMeetingId } : {},
      { source: "chat" }
    );
    return finalizeResponse("delete_meeting", result, message, routed);
  }

  if (routed === "navigation") {
    const target = resolveOpenTargetFromMessage(message);
    if (target) {
      return executeOpenOffer(message, target);
    }
  }

  return null;
}
