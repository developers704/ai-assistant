import type { AppState, WorkingMemory } from "@/types";
import { getState, setState } from "@/lib/store/server-store";
import { getUiContext, updateUiContext } from "@/lib/store/ui-context";

/** Server-side shared memory for Chat + Voice — survives navigation and rerenders. */
export function getWorkingMemory(): WorkingMemory {
  const state = getState();
  const ui = state.uiContext ?? getUiContext();
  const stored = state.workingMemory;

  return {
    currentPage: ui.currentPath || stored?.currentPage || "/chat",
    lastTopic: stored?.lastTopic ?? ui.lastTopic,
    lastIntent: stored?.lastIntent ?? ui.lastUserIntent,
    lastToolResultSummary: stored?.lastToolResultSummary ?? ui.lastToolResult,
    pendingNavigation: stored?.pendingNavigation ?? ui.lastSuggestedRoute,
    lastOfferedAction: stored?.lastOfferedAction,
    selectedEmailId: ui.selectedEmailId,
    selectedMeetingId: ui.selectedMeetingId,
    selectedReportId: ui.selectedReportId,
    selectedContactId: ui.selectedContactId,
    selectedStore: stored?.selectedStore,
    updatedAt: stored?.updatedAt ?? new Date().toISOString(),
  };
}

export function updateWorkingMemory(patch: Partial<WorkingMemory>): WorkingMemory {
  const prev = getWorkingMemory();
  const next: WorkingMemory = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  setState((s) => ({ ...s, workingMemory: next }));

  updateUiContext({
    currentPath: next.currentPage,
    lastTopic: next.lastTopic,
    lastUserIntent: next.lastIntent,
    lastToolResult: next.lastToolResultSummary,
    lastSuggestedRoute: next.pendingNavigation,
    selectedEmailId: next.selectedEmailId,
    selectedMeetingId: next.selectedMeetingId,
    selectedReportId: next.selectedReportId,
    selectedContactId: next.selectedContactId,
  });

  return next;
}

/** Sync memory snapshot from full app state (call at start of each turn). */
export function syncWorkingMemoryFromState(state: AppState): WorkingMemory {
  const ui = state.uiContext ?? getUiContext();
  return updateWorkingMemory({
    currentPage: ui.currentPath || "/chat",
    selectedEmailId: ui.selectedEmailId,
    selectedMeetingId: ui.selectedMeetingId,
    selectedReportId: ui.selectedReportId,
    selectedContactId: ui.selectedContactId,
  });
}

export function recordToolRun(input: {
  toolName: string;
  summary: string;
  intent?: string;
  navigateTo?: string;
}): void {
  updateWorkingMemory({
    lastTopic: input.toolName,
    lastIntent: input.intent,
    lastToolResultSummary: input.summary.slice(0, 240),
    pendingNavigation: input.navigateTo,
    lastOfferedAction: input.navigateTo ? `open:${input.navigateTo}` : undefined,
  });
}

export function recordNavigationOffer(route: string, topic: string): void {
  updateWorkingMemory({
    lastTopic: topic,
    pendingNavigation: route,
    lastOfferedAction: `open:${route}`,
  });
}

export function recordOfferedAction(action: string): void {
  updateWorkingMemory({ lastOfferedAction: action, lastTopic: action });
}
