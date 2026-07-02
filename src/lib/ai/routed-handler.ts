import type { AIResponse, AppState } from "@/types";
import { routeIntent, intentToTool } from "@/lib/ai/intent-router";
import { buildDynamicContext } from "@/lib/ai/dynamic-context";
import { runPlanner } from "@/lib/ai/planner";
import { validateToolResult } from "@/lib/ai/validator";
import { executeTool, executeConfirmedPending } from "@/lib/tools/registry";
import {
  clearPendingActions,
  isConfirmMessage,
  isRejectMessage,
} from "@/lib/actions/confirmation";
import { extractFactsFromMessage } from "@/lib/memory/extract";
import { updateUiContext } from "@/lib/store/ui-context";
import { intentForTool } from "@/lib/assistant/format-tool-result";

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

function toolResultToAIResponse(
  toolName: string,
  result: Awaited<ReturnType<typeof executeTool>>,
  prefix?: string
): AIResponse {
  const message =
    (prefix ? `${prefix}\n\n` : "") +
    (result.textAnswer ?? result.spokenAnswer ?? "Done.");
  return {
    intent: intentForTool(toolName),
    message,
    speak: true,
    pendingAction: result.pendingAction,
    data: result.navigateTo ? { navigate: result.navigateTo } : undefined,
  };
}

/**
 * Deterministic pre-LLM handler — saves OpenAI cost on confirm/reject/simple reads.
 * Planner gated to complex_planner only.
 */
export async function tryRoutedResponse(
  message: string,
  state: AppState
): Promise<AIResponse | null> {
  extractFactsFromMessage(message);

  const ui = state.uiContext;
  const routed = routeIntent({
    message,
    currentPath: ui?.currentPath,
    selectedEmailId: ui?.selectedEmailId,
    selectedMeetingId: ui?.selectedMeetingId,
  });

  updateUiContext({ lastUserIntent: routed });

  if (isConfirmMessage(message) || routed === "confirm") {
    const result = await executeConfirmedPending({ source: "chat" });
    if (result) {
      return toolResultToAIResponse(result.toolName, result, "Confirmed.");
    }
    return {
      intent: "confirm_action",
      message: "There's nothing pending confirmation right now.",
      speak: true,
    };
  }

  if (isRejectMessage(message) || routed === "reject") {
    clearPendingActions();
    return {
      intent: "reject_action",
      message: "Cancelled. What would you like to do next?",
      speak: true,
    };
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
          return toolResultToAIResponse(step.tool, result);
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
      toolName === "search_company_knowledge" ? { query: message } : {};
    const result = await executeTool(toolName, args, { source: "chat" });
    validateToolResult(result);
    return toolResultToAIResponse(toolName, result);
  }

  if (routed === "email.draft") {
    const result = await executeTool("draft_email_reply", {}, { source: "chat" });
    return toolResultToAIResponse("draft_email_reply", result);
  }

  if (routed === "calendar.delete") {
    const result = await executeTool(
      "delete_meeting",
      ui?.selectedMeetingId ? { event_id: ui.selectedMeetingId } : {},
      { source: "chat" }
    );
    return toolResultToAIResponse("delete_meeting", result);
  }

  return null;
}
