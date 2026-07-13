import {
  clearPendingActions,
  getActivePendingAction,
  savePendingAction,
  createPendingAction as createLegacyPending,
} from "@/lib/actions/confirmation";
import { executeConfirmedPending } from "@/lib/tools/registry";
import type { AlexaChannel, AlexaPendingAction, AlexaRiskLevel } from "@/lib/alexa/types";
import { mapPendingToAlexa } from "@/lib/alexa/result-adapter";
import type { PendingAction } from "@/types";
import type { ToolResult } from "@/lib/tools/types";

const byConversation = new Map<string, string>();

export function createPendingAction(input: {
  conversationId: string;
  type: PendingAction["type"];
  title: string;
  summary: string;
  preview: string;
  payload: Record<string, unknown>;
  toolName: string;
  channel: AlexaChannel;
  risk?: AlexaRiskLevel;
}): AlexaPendingAction {
  const pending = createLegacyPending({
    type: input.type,
    title: input.title,
    summary: input.summary,
    preview: input.preview,
    payload: input.payload,
    toolName: input.toolName,
    source: input.channel === "voice" ? "voice" : "chat",
    riskLevel:
      input.risk === "destructive"
        ? "dangerous"
        : input.risk === "write"
          ? "confirmation_required"
          : "safe",
  });
  savePendingAction(pending);
  byConversation.set(input.conversationId, pending.id);
  return mapPendingToAlexa(pending, input.conversationId, input.channel)!;
}

export function getPendingAction(conversationId?: string): AlexaPendingAction | null {
  const active = getActivePendingAction();
  if (!active) return null;
  if (conversationId) {
    const expected = byConversation.get(conversationId);
    if (expected && expected !== active.id) {
      // Still return active — single global pending queue today
    }
  }
  return mapPendingToAlexa(active, conversationId ?? "default", active.source === "voice" ? "voice" : "chat");
}

export function rejectPendingAction(_conversationId?: string): void {
  void _conversationId;
  clearPendingActions();
}

export function expirePendingActions(): void {
  getActivePendingAction(); // TTL check clears expired
}

export async function confirmPendingAction(
  conversationId?: string
): Promise<ToolResult | null> {
  const active = getActivePendingAction();
  if (!active) return null;
  if (conversationId) {
    byConversation.set(conversationId, active.id);
  }
  return executeConfirmedPending();
}

export async function executeConfirmedAction(
  conversationId?: string
): Promise<ToolResult | null> {
  return confirmPendingAction(conversationId);
}
