import { v4 as uuidv4 } from "uuid";
import type {
  AlexaTurnInput,
  AlexaTurnResult,
  AlexaIntent,
} from "@/lib/alexa/types";
import { unknownIntent } from "@/lib/alexa/types";
import { normalizeAlexaInput } from "@/lib/alexa/input-normalizer";
import { resolveAlexaIntent } from "@/lib/alexa/intent-resolver";
import { getAlexaWorkingMemory, applyIntentToMemory } from "@/lib/alexa/structured-memory";
import { selectRelevantTools, pickPrimaryTool } from "@/lib/alexa/tool-selector";
import { evaluateActionPolicy } from "@/lib/alexa/policy-engine";
import { getCanonicalTool } from "@/lib/tools/canonical-registry";
import { executeAppTool } from "@/lib/tools/execute-app-tool";
import { composeAlexaResponse } from "@/lib/alexa/response-composer";
import { resolveNavigation } from "@/lib/alexa/navigation-resolver";
import { assertRagAllowed, isLiveDataIntent } from "@/lib/alexa/rag-guard";
import {
  confirmPendingAction,
  getPendingAction,
  rejectPendingAction,
} from "@/lib/actions/action-manager";
import { mapToolResultToAlexa } from "@/lib/alexa/result-adapter";
import { beginTrace, finalizeTrace } from "@/lib/alexa/trace";
import { AlexaFlags } from "@/lib/alexa/flags";
import { processAlexaMessage } from "@/lib/ai/process-message";
import { getState } from "@/lib/store/server-store";
import { isConfirmMessage, isRejectMessage } from "@/lib/actions/confirmation-messages";

function buildToolArgs(intent: AlexaIntent, message: string): Record<string, unknown> {
  const args: Record<string, unknown> = {
    user_message: message,
    query: message,
  };
  if (intent.entities.designs) args.designs = intent.entities.designs;
  if (intent.entities.stores) args.stores = intent.entities.stores;
  if (intent.entities.dateRange) args.date_range = intent.entities.dateRange;
  if (intent.groupBy) args.group_by = intent.groupBy;
  if (intent.entities.section) args.page = intent.entities.section;
  if (intent.entities.contact) {
    args.contact = intent.entities.contact;
    args.query = intent.entities.contact;
  }
  return args;
}

/**
 * Unified Alexa orchestrator — Chat and Voice share this entry.
 * When ALEXA_UNIFIED_ORCHESTRATOR is off, callers should use legacy paths.
 */
export async function processAlexaTurn(input: AlexaTurnInput): Promise<AlexaTurnResult> {
  const traceId = input.requestId ?? uuidv4();
  const conversationId = input.conversationId || "default";

  const { raw, normalized } = normalizeAlexaInput({
    message: input.message,
    channel: input.channel,
    locale: input.locale,
  });

  const memory = getAlexaWorkingMemory(conversationId);
  const currentRoute = input.currentRoute ?? memory.currentRoute;

  beginTrace({
    traceId,
    conversationId,
    channel: input.channel,
    rawInput: raw,
    normalizedInput: normalized,
  });

  // Confirm / reject pending
  if (isConfirmMessage(normalized)) {
    const confirmed = await confirmPendingAction(conversationId);
    if (confirmed) {
      const toolResult = mapToolResultToAlexa(confirmed, conversationId, input.channel, traceId);
      const composed = composeAlexaResponse({
        channel: input.channel,
        intent: unknownIntent({ domain: "general", action: "confirm", confidence: 1 }),
        toolResult,
      });
      finalizeTrace(traceId, {
        selectedTool: confirmed.toolName,
        toolStatus: confirmed.status,
        finalTextAnswer: composed.textAnswer,
        finalSpokenAnswer: composed.spokenAnswer,
      });
      return {
        traceId,
        intent: unknownIntent({ domain: "general", action: "confirm", confidence: 1 }),
        toolResult,
        textAnswer: composed.textAnswer,
        spokenAnswer: composed.spokenAnswer,
        pendingAction: null,
      };
    }
  }

  if (isRejectMessage(normalized)) {
    rejectPendingAction(conversationId);
    const msg = "Cancelled.";
    finalizeTrace(traceId, { finalTextAnswer: msg, finalSpokenAnswer: msg });
    return {
      traceId,
      intent: unknownIntent({ domain: "general", action: "reject", confidence: 1 }),
      textAnswer: msg,
      spokenAnswer: msg,
      pendingAction: null,
    };
  }

  const intent = await resolveAlexaIntent({
    normalizedMessage: normalized,
    memory,
    currentRoute,
  });

  if (intent.requiresClarification) {
    const field = intent.missingFields[0] ?? "detail";
    const entityHint =
      field === "design"
        ? `I heard a design name that might be unclear. Did you mean ${JSON.stringify(intent.entities.designs ?? [])}?`
        : field === "time"
          ? "What time should I schedule that for?"
          : field === "contact"
            ? "Which contact did you mean?"
            : `I need a bit more detail (${field}) before I continue.`;
    const composed = composeAlexaResponse({
      channel: input.channel,
      intent,
      clarification: entityHint,
    });
    finalizeTrace(traceId, {
      intent,
      finalTextAnswer: composed.textAnswer,
      finalSpokenAnswer: composed.spokenAnswer,
    });
    return {
      traceId,
      intent,
      textAnswer: composed.textAnswer,
      spokenAnswer: composed.spokenAnswer,
    };
  }

  // RAG guard: live data never falls through to knowledge-only
  if (intent.domain === "knowledge") {
    const rag = assertRagAllowed(intent);
    if (!rag.allowed && isLiveDataIntent(intent)) {
      intent.domain = "sales";
      intent.requiresTool = true;
    }
  }

  const candidates = AlexaFlags.dynamicTools()
    ? selectRelevantTools({ intent, currentRoute, memory })
    : [];
  const primary = pickPrimaryTool(intent);

  // Unknown / general → defer to legacy LLM pipeline
  if (!primary || intent.domain === "unknown" || intent.domain === "general") {
    const legacyChannel = input.channel === "voice" ? "voice" : "chat";
    const legacy = await processAlexaMessage(normalized, getState(), legacyChannel);
    if (legacy) {
      const composed = {
        textAnswer: legacy.message,
        spokenAnswer: legacy.message.replace(/\*\*/g, "").slice(0, 400),
      };
      finalizeTrace(traceId, {
        intent,
        finalTextAnswer: composed.textAnswer,
        finalSpokenAnswer: composed.spokenAnswer,
      });
      return {
        traceId,
        intent,
        textAnswer: composed.textAnswer,
        spokenAnswer: composed.spokenAnswer,
        pendingAction: legacy.pendingAction
          ? getPendingAction(conversationId)
          : null,
        uiAction: legacy.data?.navigate
          ? { type: "navigate", route: String(legacy.data.navigate) }
          : undefined,
        deferToLegacy: false,
      };
    }
    finalizeTrace(traceId, { intent, finalTextAnswer: "", finalSpokenAnswer: "" });
    return {
      traceId,
      intent,
      textAnswer: "",
      spokenAnswer: "",
      deferToLegacy: true,
    };
  }

  const toolDef = getCanonicalTool(primary);
  if (!toolDef) {
    return {
      traceId,
      intent,
      textAnswer: "",
      spokenAnswer: "",
      deferToLegacy: true,
    };
  }

  const policy = evaluateActionPolicy({
    intent,
    tool: toolDef,
    channel: input.channel,
  });
  if (!policy.allowed) {
    const msg = policy.reason ?? "That action isn't allowed.";
    return {
      traceId,
      intent,
      textAnswer: msg,
      spokenAnswer: msg,
    };
  }

  const args = buildToolArgs(intent, normalized);
  const toolResult = await executeAppTool(primary, args, {
    traceId,
    conversationId,
    channel: input.channel,
    currentRoute,
    timezone: input.timezone,
    userId: input.userId,
    idempotencyKey: `${conversationId}:${primary}:${normalized.slice(0, 80)}`,
  });

  const uiAction = resolveNavigation({
    intent,
    channel: input.channel,
    toolUiAction: toolResult.uiAction,
  });

  const composed = composeAlexaResponse({
    channel: input.channel,
    intent,
    toolResult,
  });

  applyIntentToMemory(conversationId, intent, primary, uiAction);

  finalizeTrace(traceId, {
    intent,
    candidateTools: candidates.map((t) => t.name),
    selectedTool: primary,
    toolArgs: args,
    toolStatus: toolResult.status,
    toolDurationMs: toolResult.metadata?.durationMs,
    finalTextAnswer: composed.textAnswer,
    finalSpokenAnswer: composed.spokenAnswer,
    uiAction,
    pendingActionId: toolResult.pendingAction?.id,
  });

  return {
    traceId,
    intent,
    toolResult,
    textAnswer: composed.textAnswer,
    spokenAnswer: composed.spokenAnswer,
    uiAction,
    pendingAction: toolResult.pendingAction ?? null,
  };
}
