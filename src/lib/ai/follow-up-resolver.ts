import type { AIResponse, AppState } from "@/types";
import { getActivePendingAction, clearPendingActions } from "@/lib/actions/confirmation";
import {
  isConfirmMessage,
  isRejectMessage,
  isStrictConfirmMessage,
  isAffirmativeWithOpenIntent,
} from "@/lib/actions/confirmation-messages";
import { executeConfirmedPending } from "@/lib/tools/registry";
import { tryConfirmBulkDeleteFromChat } from "@/lib/ai/chat-context-confirm";
import { getWorkingMemory, recordNavigationOffer } from "@/lib/memory/working-memory";
import { sectionForPath } from "@/lib/ai/app-map";
import { resolveOpenTargetFromMessage } from "@/lib/actions/pending-offer";
import { executeTool } from "@/lib/tools/registry";
import { synthesizeToolResponse } from "@/lib/ai/response-synthesizer";
import type { AlexaChannel } from "@/lib/ai/response-synthesizer";
import { formatResponseForChannel } from "@/lib/ai/response-synthesizer";
import { resolveContextualAffirmative } from "@/lib/ai/contextual-affirmative";

const OPEN_FOLLOWUP =
  /\b(open it|show more|read more|tell me more|yes open|yes pls open|go there|take me there|open that|show me more)\b/i;

const REPLY_THIS =
  /\b(reply|respond|draft reply)\b[\s\S]{0,20}\b(politely|this|selected|email)?\b/i;

/**
 * Resolve follow-ups: yes, open it, show more, reply to this.
 * Runs before section intelligence and tool routing.
 */
export async function resolveFollowUp(
  message: string,
  state: AppState,
  channel: AlexaChannel = "chat"
): Promise<AIResponse | null> {
  const lower = message.toLowerCase().trim();
  const memory = getWorkingMemory();
  const pending = getActivePendingAction();
  const path = state.uiContext?.currentPath ?? memory.currentPage;

  if (isRejectMessage(message)) {
    clearPendingActions();
    return formatResponseForChannel(
      {
        intent: "reject_action",
        message: "Cancelled. What would you like next?",
        speak: true,
      },
      channel
    );
  }

  if (pending && (isStrictConfirmMessage(lower) || (isConfirmMessage(message) && !isAffirmativeWithOpenIntent(message)))) {
    const result = await executeConfirmedPending({ source: channel });
    if (result) {
      return formatResponseForChannel(
        {
          intent: "confirm_action",
          message: result.textAnswer ?? result.spokenAnswer ?? "Done.",
          speak: true,
          data: result.navigateTo ? { navigate: result.navigateTo } : undefined,
        },
        channel
      );
    }
  }

  if (isConfirmMessage(message) && !pending) {
    const bulk = await tryConfirmBulkDeleteFromChat(message, state);
    if (bulk) {
      return formatResponseForChannel(
        {
          intent: "confirm_action",
          message: bulk.textAnswer ?? bulk.spokenAnswer ?? "Done.",
          speak: true,
          data: bulk.navigateTo ? { navigate: bulk.navigateTo } : undefined,
        },
        channel
      );
    }

    const contextual = await resolveContextualAffirmative(state, memory, channel);
    if (contextual) {
      return formatResponseForChannel(contextual, channel);
    }
  }

  if (OPEN_FOLLOWUP.test(lower) || (isAffirmativeWithOpenIntent(message) && !pending)) {
    const route =
      memory.pendingNavigation ??
      (pending?.payload?.path ? String(pending.payload.path) : undefined);

    const targetFromMsg = resolveOpenTargetFromMessage(message);
    const openRoute = route ?? (targetFromMsg ? `/${targetFromMsg === "dashboard" ? "dashboard" : targetFromMsg}` : null);

    if (openRoute) {
      const section = sectionForPath(openRoute);
      recordNavigationOffer(section.route, section.label);
      return formatResponseForChannel(
        {
          intent: "general",
          message: `Opening **${section.label}** for you.`,
          speak: true,
          data: { navigate: section.route },
        },
        channel
      );
    }
  }

  if (path === "/email" && REPLY_THIS.test(lower) && state.uiContext?.selectedEmailId) {
    const result = await executeTool(
      "draft_email_reply",
      { user_message: message },
      { source: channel }
    );
    const synth = synthesizeToolResponse({
      toolName: "draft_email_reply",
      result,
      userMessage: message,
      channel,
    });
    return formatResponseForChannel(
      {
        intent: "email_draft",
        message: synth.message,
        speak: true,
        pendingAction: result.pendingAction ?? synth.pendingOffer,
      },
      channel
    );
  }

  return null;
}
