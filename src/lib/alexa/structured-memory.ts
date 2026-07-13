import type { AlexaIntent, AlexaWorkingMemory, AlexaDomain, AlexaUiAction } from "@/lib/alexa/types";
import { getWorkingMemory, updateWorkingMemory } from "@/lib/memory/working-memory";
import { AlexaFlags } from "@/lib/alexa/flags";

const structuredStore = new Map<string, AlexaWorkingMemory>();

export function getAlexaWorkingMemory(conversationId: string): AlexaWorkingMemory {
  if (!AlexaFlags.structuredMemory()) {
    const legacy = getWorkingMemory();
    return {
      conversationId,
      currentRoute: legacy.currentPage,
      lastTool: legacy.lastTopic,
      updatedAt: legacy.updatedAt,
    };
  }

  const existing = structuredStore.get(conversationId);
  if (existing) {
    const legacy = getWorkingMemory();
    return {
      ...existing,
      currentRoute: legacy.currentPage || existing.currentRoute,
      updatedAt: new Date().toISOString(),
    };
  }

  const legacy = getWorkingMemory();
  const fresh: AlexaWorkingMemory = {
    conversationId,
    currentRoute: legacy.currentPage,
    updatedAt: new Date().toISOString(),
  };
  structuredStore.set(conversationId, fresh);
  return fresh;
}

export function updateAlexaWorkingMemory(
  conversationId: string,
  patch: Partial<AlexaWorkingMemory>
): AlexaWorkingMemory {
  const prev = getAlexaWorkingMemory(conversationId);
  const next: AlexaWorkingMemory = {
    ...prev,
    ...patch,
    conversationId,
    updatedAt: new Date().toISOString(),
  };
  structuredStore.set(conversationId, next);

  // Keep legacy memory in sync for existing callers
  updateWorkingMemory({
    currentPage: next.currentRoute ?? "/chat",
    lastTopic: next.lastTool,
    lastIntent: next.lastIntent?.action,
    pendingNavigation: next.lastUiAction?.route,
  });

  return next;
}

export function applyIntentToMemory(
  conversationId: string,
  intent: AlexaIntent,
  toolName?: string,
  uiAction?: AlexaUiAction
): AlexaWorkingMemory {
  const patch: Partial<AlexaWorkingMemory> = {
    lastDomain: intent.domain as AlexaDomain,
    lastIntent: intent,
    lastTool: toolName,
    lastUiAction: uiAction,
  };

  if (intent.domain === "sales") {
    const prev = getAlexaWorkingMemory(conversationId).salesContext ?? {};
    patch.salesContext = {
      ...prev,
      dateRange: (intent.entities.dateRange as unknown) ?? prev.dateRange,
      designs: (intent.entities.designs as string[]) ?? prev.designs,
      stores: (intent.entities.stores as string[]) ?? prev.stores,
      departments: (intent.entities.departments as string[]) ?? prev.departments,
      vendors: (intent.entities.vendors as string[]) ?? prev.vendors,
      metrics: intent.metrics ?? prev.metrics,
      groupBy: intent.groupBy ?? prev.groupBy,
    };
  }

  return updateAlexaWorkingMemory(conversationId, patch);
}
