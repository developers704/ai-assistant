import type { UiContext } from "@/types";
import { getState, setState } from "@/lib/store/server-store";

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
