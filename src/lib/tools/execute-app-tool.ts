import type { AlexaChannel, AlexaToolExecutionContext, AlexaToolResult } from "@/lib/alexa/types";
import { mapToolResultToAlexa, validateAlexaToolResult } from "@/lib/alexa/result-adapter";
import { executeTool } from "@/lib/tools/registry";
import { claimIdempotencyKey, rememberIdempotencyResult } from "@/lib/tools/idempotency";
import { withTimeout } from "@/lib/tools/tool-timeout";

/**
 * Canonical app tool executor (channel-agnostic).
 * Wraps the shared registry `executeTool` and returns AlexaToolResult.
 */
export async function executeAppTool(
  toolName: string,
  args: unknown,
  context: AlexaToolExecutionContext
): Promise<AlexaToolResult> {
  const started = Date.now();
  const safeArgs =
    args && typeof args === "object" && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : {};

  if (context.idempotencyKey) {
    const claimed = claimIdempotencyKey(context.idempotencyKey);
    if (!claimed.ok && claimed.existing) {
      return claimed.existing as AlexaToolResult;
    }
  }

  try {
    const legacy = await withTimeout(
      executeTool(toolName, safeArgs, {
        source: context.channel === "voice" ? "voice" : "chat",
        currentPath: context.currentRoute,
        confirmed: context.confirmed,
        pendingActionId: context.pendingActionId,
      }),
      15_000,
      toolName
    );

    const mapped = validateAlexaToolResult(
      mapToolResultToAlexa(legacy, context.conversationId, context.channel, context.traceId)
    );
    mapped.metadata = {
      ...mapped.metadata,
      durationMs: Date.now() - started,
      traceId: context.traceId,
    };

    if (context.idempotencyKey) {
      rememberIdempotencyResult(context.idempotencyKey, mapped);
    }
    return mapped;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    return {
      ok: false,
      status: "error",
      tool: toolName,
      textAnswer: message,
      spokenAnswer: "Something went wrong running that action.",
      error: { code: "EXECUTION_ERROR", message, retryable: true },
      metadata: { durationMs: Date.now() - started, traceId: context.traceId },
    };
  }
}

/** @deprecated Use executeAppTool — kept for gradual migration. */
export async function executeVoiceToolCompat(
  name: string,
  args: Record<string, unknown> = {},
  channel: AlexaChannel = "voice"
): Promise<AlexaToolResult> {
  return executeAppTool(name, args, {
    traceId: `compat-${Date.now()}`,
    conversationId: "legacy",
    channel,
  });
}
