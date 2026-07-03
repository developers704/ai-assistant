import type { UiContext } from "@/types";
import { getState, setState } from "@/lib/store/server-store";
import { updateWorkingMemory } from "@/lib/memory/working-memory";

export function getUiContext(): UiContext {
  return (
    getState().uiContext ?? {
      currentPath: "/chat",
      updatedAt: new Date().toISOString(),
    }
  );
}

export function updateUiContext(patch: Partial<UiContext>): UiContext {
  const next: UiContext = {
    ...getUiContext(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  setState((s) => ({ ...s, uiContext: next }));
  return next;
}

/** Track conversational intelligence state for follow-ups (open it, yes, explain). */
export function recordIntelligenceState(patch: {
  lastTopic?: string;
  lastSuggestedRoute?: string;
  lastToolResult?: string;
}): void {
  updateWorkingMemory({
    lastTopic: patch.lastTopic,
    pendingNavigation: patch.lastSuggestedRoute,
    lastToolResultSummary: patch.lastToolResult,
  });
}
