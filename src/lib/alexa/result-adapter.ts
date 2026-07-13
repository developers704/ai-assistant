import type { ToolResult } from "@/lib/tools/types";
import type {
  AlexaChannel,
  AlexaPendingAction,
  AlexaRiskLevel,
  AlexaToolResult,
  AlexaUiAction,
} from "@/lib/alexa/types";
import type { PendingAction } from "@/types";

function mapRisk(level?: PendingAction["riskLevel"]): AlexaRiskLevel {
  if (level === "dangerous") return "destructive";
  if (level === "confirmation_required") return "write";
  return "read";
}

export function mapPendingToAlexa(
  pending: PendingAction | undefined,
  conversationId: string,
  channel: AlexaChannel
): AlexaPendingAction | null {
  if (!pending) return null;
  return {
    id: pending.id,
    conversationId,
    type: pending.type,
    risk: mapRisk(pending.riskLevel),
    status: "awaiting_confirmation",
    payload: pending.payload,
    summary: pending.summary ?? pending.title,
    createdBy: (pending.source as AlexaChannel) ?? channel,
    createdAt: pending.createdAt,
    expiresAt: pending.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

export function mapToolResultToAlexa(
  result: ToolResult,
  conversationId: string,
  channel: AlexaChannel,
  traceId?: string
): AlexaToolResult {
  let status: AlexaToolResult["status"] = "success";
  if (result.status === "needs_confirmation") status = "needs_confirmation";
  else if (result.status === "not_found") status = "not_found";
  else if (!result.ok || result.status === "failed") status = "error";

  const uiAction: AlexaUiAction | undefined = result.navigateTo
    ? { type: "navigate", route: result.navigateTo }
    : undefined;

  return {
    ok: result.ok,
    status,
    tool: result.toolName,
    data: result.data,
    textAnswer: result.textAnswer ?? result.spokenAnswer,
    spokenAnswer: result.spokenAnswer ?? result.textAnswer,
    uiAction,
    pendingAction: mapPendingToAlexa(result.pendingAction, conversationId, channel),
    warnings: [],
    error: result.error
      ? { code: "TOOL_ERROR", message: result.error, retryable: false }
      : null,
    metadata: { traceId },
  };
}

export function validateAlexaToolResult(result: AlexaToolResult): AlexaToolResult {
  if (!result.tool) {
    return {
      ...result,
      ok: false,
      status: "error",
      error: { code: "INVALID_RESULT", message: "Missing tool name", retryable: false },
    };
  }
  if (!result.textAnswer && !result.spokenAnswer && result.ok) {
    return {
      ...result,
      textAnswer: "Done.",
      spokenAnswer: "Done.",
      warnings: [...(result.warnings ?? []), "Missing text/spoken answers; filled defaults."],
    };
  }
  return result;
}
