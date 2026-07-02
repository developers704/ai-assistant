import { v4 as uuidv4 } from "uuid";
import type { PendingAction, UserProfile } from "@/types";
import { getState, setState } from "@/lib/store/server-store";
import { TOOL_BY_NAME } from "@/lib/tools/metadata";
import type { ToolExecutionContext, ToolResult } from "@/lib/tools/types";
import { matchByTitle } from "@/lib/voice/tool-helpers";
import { findCalendarEvent } from "@/lib/voice/tool-helpers";
import { getVoiceCalendarEvents } from "@/lib/voice/calendar-data";
import { userTimezone } from "@/lib/calendar-dates";

const CONFIRM_TTL_MS = 10 * 60 * 1000;

export interface StagedConfirmation {
  pending: PendingAction;
  toolName: string;
  args: Record<string, unknown>;
}

/** Enforce user settings globally — confirmation layer is the single gate for risky ops. */
export function isConfirmationEnforced(
  toolName: string,
  prefs: UserProfile["preferences"] | undefined
): boolean {
  const def = TOOL_BY_NAME.get(toolName);
  if (!def?.requiresConfirmation) return false;
  if (!prefs) return def.riskLevel === "dangerous";

  if (toolName === "delete_task" || toolName === "delete_meeting") {
    return prefs.confirmBeforeMeeting || def.riskLevel === "dangerous";
  }
  if (toolName === "add_meeting") {
    return prefs.confirmBeforeMeeting;
  }
  return def.requiresConfirmation;
}

export function createPendingAction(input: {
  type: PendingAction["type"];
  title: string;
  summary: string;
  preview: string;
  payload: Record<string, unknown>;
  toolName: string;
  source: "voice" | "chat";
  riskLevel?: "safe" | "confirmation_required" | "dangerous";
  confirmText?: string;
  cancelText?: string;
}): PendingAction {
  const now = new Date();
  return {
    id: uuidv4(),
    type: input.type,
    title: input.title,
    preview: input.preview,
    payload: {
      ...input.payload,
      toolName: input.toolName,
      stagedArgs: input.payload.stagedArgs ?? input.payload,
    },
    createdAt: now.toISOString(),
    summary: input.summary,
    riskLevel: input.riskLevel ?? "confirmation_required",
    expiresAt: new Date(now.getTime() + CONFIRM_TTL_MS).toISOString(),
    confirmText: input.confirmText ?? "yes",
    cancelText: input.cancelText ?? "cancel",
    source: input.source,
    toolName: input.toolName,
  };
}

export function savePendingAction(pending: PendingAction): void {
  setState((s) => ({ ...s, pendingActions: [pending] }));
}

export function getActivePendingAction(): PendingAction | undefined {
  const pending = getState().pendingActions[0];
  if (!pending) return undefined;
  if (pending.expiresAt && new Date(pending.expiresAt) < new Date()) {
    setState((s) => ({ ...s, pendingActions: [] }));
    return undefined;
  }
  return pending;
}

export function clearPendingActions(): void {
  setState((s) => ({ ...s, pendingActions: [] }));
}

/** Stage delete_task before execution */
export async function stageDeleteTask(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<StagedConfirmation | null> {
  const state = getState();
  const pending = state.reminders.filter((r) => !r.completed);
  const taskId = args.task_id ? String(args.task_id) : undefined;
  const titleQuery = args.title ? String(args.title) : undefined;
  const target =
    (taskId ? pending.find((t) => t.id === taskId) : undefined) ||
    (titleQuery ? matchByTitle(pending, titleQuery) : undefined);

  if (!target) return null;

  const pendingAction = createPendingAction({
    type: "task_delete",
    title: `Delete task: ${target.title}`,
    summary: `Remove task "${target.title}" due ${target.dueDate}?`,
    preview: target.title,
    payload: { stagedArgs: { task_id: target.id, title: target.title }, action: "delete_task" },
    toolName: "delete_task",
    source: ctx.source,
    riskLevel: "dangerous",
  });

  return { pending: pendingAction, toolName: "delete_task", args: { task_id: target.id } };
}

/** Stage delete_meeting before execution */
export async function stageDeleteMeeting(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<StagedConfirmation | null> {
  const { events } = await getVoiceCalendarEvents();
  const eventId =
    args.event_id ? String(args.event_id) : ctx.selectedMeetingId;
  const titleQuery = String(args.title ?? args.event_title ?? "");
  const target =
    (eventId ? events.find((e) => e.id === eventId) : undefined) ||
    (titleQuery ? findCalendarEvent(events, titleQuery) : undefined);

  if (!target) return null;

  const tz = userTimezone(getState());
  const time = new Date(target.start).toLocaleString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });

  const pendingAction = createPendingAction({
    type: "meeting_cancel",
    title: `Cancel meeting: ${target.title}`,
    summary: `Delete "${target.title}" at ${time}? Say yes to confirm.`,
    preview: `${target.title} — ${time}`,
    payload: {
      stagedArgs: { event_id: target.id, title: target.title },
      action: "delete_meeting",
    },
    toolName: "delete_meeting",
    source: ctx.source,
    riskLevel: "dangerous",
  });

  return { pending: pendingAction, toolName: "delete_meeting", args: { event_id: target.id } };
}

/** Stage add_meeting when confirmBeforeMeeting is on */
export function stageAddMeeting(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): StagedConfirmation {
  const title = String(args.title ?? "Meeting");
  const start = String(args.start ?? "");
  const pendingAction = createPendingAction({
    type: "meeting_create",
    title: `Schedule: ${title}`,
    summary: `Create meeting "${title}" at ${start}? Say yes to confirm.`,
    preview: `${title} — ${start}`,
    payload: { stagedArgs: args, action: "add_meeting", ...args },
    toolName: "add_meeting",
    source: ctx.source,
    riskLevel: "confirmation_required",
  });
  return { pending: pendingAction, toolName: "add_meeting", args };
}

export function confirmationResult(
  toolName: string,
  pending: PendingAction,
  spokenPrefix: string
): ToolResult {
  return {
    ok: true,
    toolName,
    status: "needs_confirmation",
    confidence: 1,
    spokenAnswer: `${spokenPrefix} ${pending.summary} Say yes to confirm or cancel.`,
    textAnswer: pending.summary,
    pendingAction: pending,
  };
}

export { isConfirmMessage, isRejectMessage } from "@/lib/actions/confirmation-messages";
