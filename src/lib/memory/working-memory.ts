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
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<WorkingMemory>;
  const next: WorkingMemory = {
    ...prev,
    ...defined,
    updatedAt: new Date().toISOString(),
  };

  setState((s) => ({ ...s, workingMemory: next }));

  updateUiContext({
    ...(next.currentPage !== undefined && { currentPath: next.currentPage }),
    ...(next.lastTopic !== undefined && { lastTopic: next.lastTopic }),
    ...(next.lastIntent !== undefined && { lastUserIntent: next.lastIntent }),
    ...(next.lastToolResultSummary !== undefined && { lastToolResult: next.lastToolResultSummary }),
    ...(next.pendingNavigation !== undefined && { lastSuggestedRoute: next.pendingNavigation }),
    ...(next.selectedEmailId !== undefined && { selectedEmailId: next.selectedEmailId }),
    ...(next.selectedMeetingId !== undefined && { selectedMeetingId: next.selectedMeetingId }),
    ...(next.selectedReportId !== undefined && { selectedReportId: next.selectedReportId }),
    ...(next.selectedContactId !== undefined && { selectedContactId: next.selectedContactId }),
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
  const patch: Partial<WorkingMemory> = {
    lastTopic: input.toolName,
    lastToolResultSummary: input.summary.slice(0, 240),
  };
  if (input.intent !== undefined) patch.lastIntent = input.intent;
  if (input.navigateTo !== undefined) {
    patch.pendingNavigation = input.navigateTo;
    const prev = getWorkingMemory();
    if (!prev.lastOfferedAction || prev.lastOfferedAction.startsWith("open:")) {
      patch.lastOfferedAction = `open:${input.navigateTo}`;
    }
  }
  updateWorkingMemory(patch);
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
