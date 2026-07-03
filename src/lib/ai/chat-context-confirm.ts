import type { AppState } from "@/types";
import { isConfirmMessage } from "@/lib/actions/confirmation-messages";
import {
  getActivePendingAction,
  savePendingAction,
  stageDeleteAllMeetings,
} from "@/lib/actions/confirmation";
import type { ToolResult } from "@/lib/tools/types";
import { executeConfirmedPending } from "@/lib/tools/registry";

/** Assistant asked to confirm a bulk calendar delete but never staged pendingAction. */
export function assistantOfferedBulkCalendarDelete(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    (/\b(confirm|please confirm)\b/i.test(lower) || /\bsignificant action\b/i.test(lower)) &&
    /\b(delete|remove|clear)\b/i.test(lower) &&
    /\b(all|every|everything)\b/i.test(lower) &&
    /\b(meeting|calendar|event)/i.test(lower)
  );
}

/**
 * When user says "yes" after assistant offered bulk delete in plain text (no pending yet),
 * stage and execute the delete in one step.
 */
export async function tryConfirmBulkDeleteFromChat(
  message: string,
  state: AppState
): Promise<ToolResult | null> {
  if (!isConfirmMessage(message)) return null;
  if (getActivePendingAction()) return null;

  const lastAssistant = [...state.chatHistory]
    .reverse()
    .find((m) => m.role === "assistant");
  if (!lastAssistant?.content) return null;
  if (!assistantOfferedBulkCalendarDelete(lastAssistant.content)) return null;

  const staged = await stageDeleteAllMeetings({ source: "chat" });
  if (!staged) return null;

  savePendingAction(staged.pending);
  return executeConfirmedPending({ source: "chat" });
}
