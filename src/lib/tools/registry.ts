import type OpenAI from "openai";
import {
  executeVoiceTool,
  type VoiceToolResult,
} from "@/lib/voice/execute-tool";
import { TOOL_BY_NAME } from "@/lib/tools/metadata";
import type { ToolExecutionContext, ToolResult } from "@/lib/tools/types";
import {
  confirmationResult,
  getActivePendingAction,
  isConfirmationEnforced,
  savePendingAction,
  stageAddMeeting,
  stageDeleteMeeting,
  stageDeleteAllMeetings,
  stageDeleteTask,
} from "@/lib/actions/confirmation";
import { getState } from "@/lib/store/server-store";
import { resolveMeetingToolArgs } from "@/lib/ai/meeting-parse";

function parseLegacyOutput(output: string): Record<string, unknown> {
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    return { spokenAnswer: output };
  }
}

/** Map legacy VoiceToolResult → standard ToolResult (backward compatible). */
export function mapLegacyResult(toolName: string, legacy: VoiceToolResult): ToolResult {
  const data = parseLegacyOutput(legacy.output);
  const success = data.success !== false;
  const spoken =
    typeof data.spokenAnswer === "string"
      ? data.spokenAnswer
      : typeof data.script === "string"
        ? data.script
        : typeof data.message === "string"
          ? data.message
          : "Done.";

  return {
    ok: success,
    toolName,
    status: success ? "success" : "failed",
    confidence: success ? 0.95 : 0.5,
    spokenAnswer: spoken,
    textAnswer:
      typeof data.synthesizedAnswer === "string"
        ? data.synthesizedAnswer
        : typeof data.markdown === "string"
          ? data.markdown
          : spoken,
    data,
    navigateTo: legacy.uiAction?.path,
    error: success ? undefined : spoken,
  };
}

function attachDraftPending(result: ToolResult): ToolResult {
  if (result.toolName !== "draft_email_reply" || !result.ok) return result;
  const pending = getActivePendingAction();
  if (!pending || pending.type !== "email") return result;
  return {
    ...result,
    status: "needs_confirmation",
    pendingAction: pending,
    textAnswer: `I've drafted a reply to **${pending.payload.to_name ?? pending.title}** about "${String(pending.payload.subject ?? "")}". Review the draft below and tap **Send email** to send.`,
    spokenAnswer: `I've drafted a reply to ${pending.payload.to_name ?? pending.title}. Review it and tap Send email to confirm.`,
  };
}

function buildExecutionContext(ctx?: Partial<ToolExecutionContext>): ToolExecutionContext {
  const state = getState();
  const ui = state.uiContext;
  return {
    source: ctx?.source ?? "chat",
    currentPath: ctx?.currentPath ?? ui?.currentPath,
    selectedEmailId: ctx?.selectedEmailId ?? ui?.selectedEmailId,
    selectedMeetingId: ctx?.selectedMeetingId ?? ui?.selectedMeetingId,
    selectedReportId: ctx?.selectedReportId ?? ui?.selectedReportId,
    selectedContactId: ctx?.selectedContactId ?? ui?.selectedContactId,
    confirmed: ctx?.confirmed,
    pendingActionId: ctx?.pendingActionId,
  };
}

/**
 * Central tool executor — wraps legacy executeVoiceTool with confirmation gating.
 * Single source of truth for Voice + Chat tool execution.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown> = {},
  ctx?: Partial<ToolExecutionContext>
): Promise<ToolResult> {
  const def = TOOL_BY_NAME.get(name);
  if (!def) {
    return {
      ok: false,
      toolName: name,
      status: "not_found",
      confidence: 0,
      error: `Unknown tool: ${name}`,
      spokenAnswer: `I don't have a tool called ${name}.`,
    };
  }

  const context = buildExecutionContext(ctx);
  const prefs = getState().user?.preferences;

  if (!context.confirmed && isConfirmationEnforced(name, prefs)) {
    let staged = null as Awaited<ReturnType<typeof stageDeleteTask>> | null;

    if (name === "delete_task") {
      staged = await stageDeleteTask(args, context);
      if (!staged) {
        return {
          ok: false,
          toolName: name,
          status: "failed",
          confidence: 0.4,
          spokenAnswer: "I couldn't find that task. Say the exact task name.",
        };
      }
    } else if (name === "delete_meeting") {
      staged = await stageDeleteMeeting(args, context);
      if (!staged) {
        return {
          ok: false,
          toolName: name,
          status: "failed",
          confidence: 0.4,
          spokenAnswer: "I couldn't find that meeting. Try the exact title or open your calendar.",
        };
      }
    } else if (name === "delete_all_meetings") {
      staged = await stageDeleteAllMeetings(context);
      if (!staged) {
        return {
          ok: false,
          toolName: name,
          status: "failed",
          confidence: 0.4,
          spokenAnswer: "There are no meetings on your calendar to delete.",
        };
      }
    } else if (name === "add_meeting") {
      const resolved = resolveMeetingToolArgs(args, getState());
      staged = stageAddMeeting({ ...args, ...resolved }, context);
    }

    if (staged) {
      savePendingAction(staged.pending);
      return confirmationResult(name, staged.pending, "Got it.");
    }
  }

  const legacy = await executeVoiceTool(name, args);
  return attachDraftPending(mapLegacyResult(name, legacy));
}

/** Execute a confirmed pending action (after user says yes). */
export async function executeConfirmedPending(
  ctx?: Partial<ToolExecutionContext>
): Promise<ToolResult | null> {
  const pending = getActivePendingAction();
  if (!pending) return null;

  if (pending.type === "assistant_offer") {
    const path = String(pending.payload.path ?? "/");
    const offerTool =
      typeof pending.payload.toolName === "string"
        ? pending.payload.toolName
        : pending.toolName;
    const toolArgs =
      (pending.payload.toolArgs as Record<string, unknown> | undefined) ?? {};

    const { clearPendingActions } = await import("@/lib/actions/confirmation");

    if (offerTool && offerTool !== "show_detail_page") {
      const result = await executeTool(offerTool, toolArgs, {
        ...ctx,
        confirmed: true,
        pendingActionId: pending.id,
      });
      clearPendingActions();
      return {
        ...result,
        navigateTo: result.navigateTo ?? path,
      };
    }

    clearPendingActions();
    return {
      ok: true,
      toolName: "show_detail_page",
      status: "success",
      confidence: 1,
      spokenAnswer: `Opening ${pending.preview}.`,
      textAnswer: `Opening **${pending.preview}** for you.`,
      navigateTo: path,
    };
  }

  if (pending.type === "email" || pending.toolName === "send_email_reply") {
    const { sendGmailMessage } = await import("@/lib/google/gmail");
    const sent = await sendGmailMessage({
      to: String(pending.payload.to ?? ""),
      subject: String(pending.payload.subject ?? ""),
      body: String(pending.payload.body ?? pending.preview ?? ""),
      threadId: pending.payload.threadId ? String(pending.payload.threadId) : undefined,
    });

    if (sent.ok) {
      const { clearPendingActions } = await import("@/lib/actions/confirmation");
      clearPendingActions();
    }

    const recipient = String(pending.payload.to_name ?? pending.payload.to ?? "recipient");
    return {
      ok: sent.ok,
      toolName: "send_email_reply",
      status: sent.ok ? "success" : "failed",
      confidence: 1,
      spokenAnswer: sent.ok
        ? `Email sent to ${recipient}.`
        : sent.error ?? "Could not send the email.",
      textAnswer: sent.ok
        ? `✅ Email sent to **${recipient}**.`
        : `❌ ${sent.error ?? "Could not send the email."}`,
      error: sent.error,
    };
  }

  const toolName =
    pending.toolName ||
    (typeof pending.payload.action === "string" ? pending.payload.action : undefined);
  const stagedArgs =
    (pending.payload.stagedArgs as Record<string, unknown> | undefined) ?? pending.payload;

  if (!toolName) return null;

  const result = await executeTool(toolName, stagedArgs, {
    ...ctx,
    confirmed: true,
    pendingActionId: pending.id,
  });

  if (result.ok) {
    const { clearPendingActions } = await import("@/lib/actions/confirmation");
    clearPendingActions();
  }

  return result;
}

export function getChatOpenAITools(): OpenAI.ChatCompletionTool[] {
  // Schemas come from TOOL_DEFINITIONS — same source as canonical-registry.
  return Array.from(TOOL_BY_NAME.values())
    .filter((t) => t.allowedInChat)
    .map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
}

export function getVoiceOpenAITools(): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  // Schemas come from TOOL_DEFINITIONS — same source as canonical-registry.
  return Array.from(TOOL_BY_NAME.values())
    .filter((t) => t.allowedInVoice)
    .map((t) => ({
      type: "function" as const,
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
}

export { TOOL_BY_NAME, TOOL_DEFINITIONS } from "@/lib/tools/metadata";
