import type { AlexaChannel, AlexaIntent, AlexaUiAction } from "@/lib/alexa/types";
import { AlexaFlags } from "@/lib/alexa/flags";

export interface AlexaTrace {
  traceId: string;
  conversationId: string;
  channel: AlexaChannel;
  rawInput: string;
  normalizedInput: string;
  intent?: AlexaIntent;
  candidateTools?: string[];
  selectedTool?: string;
  toolArgs?: unknown;
  toolStartedAt?: string;
  toolDurationMs?: number;
  toolStatus?: string;
  memoryBefore?: unknown;
  memoryAfter?: unknown;
  finalTextAnswer?: string;
  finalSpokenAnswer?: string;
  uiAction?: AlexaUiAction;
  pendingActionId?: string;
  model?: string;
  tokenUsage?: unknown;
  estimatedCost?: number;
  error?: unknown;
  createdAt: string;
}

const traces: AlexaTrace[] = [];
const MAX = 200;

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/sk-[a-zA-Z0-9-_]+/g, "[REDACTED_KEY]")
      .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/password|token|secret|authorization|api[_-]?key/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export function beginTrace(partial: {
  traceId: string;
  conversationId: string;
  channel: AlexaChannel;
  rawInput: string;
  normalizedInput: string;
}): void {
  if (!AlexaFlags.traceLogging()) return;
  const trace: AlexaTrace = {
    ...partial,
    rawInput: String(redact(partial.rawInput)),
    normalizedInput: String(redact(partial.normalizedInput)),
    createdAt: new Date().toISOString(),
  };
  traces.unshift(trace);
  if (traces.length > MAX) traces.pop();
}

export function finalizeTrace(
  traceId: string,
  patch: Partial<AlexaTrace>
): void {
  if (!AlexaFlags.traceLogging()) return;
  const idx = traces.findIndex((t) => t.traceId === traceId);
  if (idx < 0) return;
  traces[idx] = {
    ...traces[idx],
    ...patch,
    toolArgs: patch.toolArgs !== undefined ? redact(patch.toolArgs) : traces[idx].toolArgs,
    finalTextAnswer:
      patch.finalTextAnswer !== undefined
        ? String(redact(patch.finalTextAnswer))
        : traces[idx].finalTextAnswer,
  };
}

export function listTraces(limit = 50): AlexaTrace[] {
  return traces.slice(0, limit);
}

export function getTrace(traceId: string): AlexaTrace | undefined {
  return traces.find((t) => t.traceId === traceId);
}
