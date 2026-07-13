import type { AlexaChannel, AlexaIntent, AlexaUiAction } from "@/lib/alexa/types";
import { APP_SECTIONS, type AppSectionId } from "@/lib/ai/app-map";

/** Canonical section → route map derived from APP_SECTIONS (replaces PAGE_PATHS drift). */
export const SECTION_ROUTES: Record<string, string> = Object.fromEntries(
  Object.values(APP_SECTIONS).map((s) => [s.id, s.route])
);

export function resolveSectionRoute(sectionId: string): string | undefined {
  return SECTION_ROUTES[sectionId] ?? APP_SECTIONS[sectionId as AppSectionId]?.route;
}

export function resolveNavigation(input: {
  intent: AlexaIntent;
  channel: AlexaChannel;
  toolUiAction?: AlexaUiAction;
}): AlexaUiAction {
  if (input.toolUiAction && input.toolUiAction.type !== "none") {
    return input.toolUiAction;
  }

  const display = input.intent.displayIntent;
  const section =
    (input.intent.entities.section as string | undefined) ??
    (input.intent.domain !== "unknown" &&
    input.intent.domain !== "general" &&
    input.intent.domain !== "knowledge"
      ? input.intent.domain
      : undefined);

  const route = section ? resolveSectionRoute(section) : undefined;

  // Information-only → no forced nav
  if (display === "tell" && !input.intent.requestedNavigation) {
    return { type: "none" };
  }

  // Explicit open/show/navigate
  if (
    (display === "open" || display === "navigate" || display === "show") &&
    route
  ) {
    // Chat: navigate when explicit; Voice: same for explicit
    if (input.intent.domain === "sales" && input.intent.entities) {
      return {
        type: "apply_filters",
        route,
        sectionId: section,
        filters: {
          designs: input.intent.entities.designs,
          dateRange: input.intent.entities.dateRange,
          stores: input.intent.entities.stores,
          groupBy: input.intent.groupBy,
        },
      };
    }
    return { type: "navigate", route, sectionId: section };
  }

  // Voice may navigate after successful read when show/open requested
  if (input.channel === "voice" && input.intent.requestedNavigation && route) {
    return { type: "navigate", route, sectionId: section };
  }

  return { type: "none" };
}
