import type { AlexaIntent, AlexaWorkingMemory } from "@/lib/alexa/types";
import type { AlexaToolDefinition } from "@/lib/tools/canonical-registry";
import { TOOL_REGISTRY, listCanonicalTools } from "@/lib/tools/canonical-registry";

const DOMAIN_TOOLS: Record<string, string[]> = {
  sales: [
    "query_sales",
    "get_today_sales",
    "compare_sales",
    "get_sales_entity_details",
    "get_top_vendor_models",
    "apply_sales_dashboard_filters",
  ],
  email: ["get_email_summary", "draft_email_reply"],
  calendar: [
    "get_calendar_today",
    "add_meeting",
    "delete_meeting",
    "delete_all_meetings",
    "list_tasks",
    "add_task",
  ],
  tasks: ["list_tasks", "add_task", "delete_task", "complete_task"],
  contacts: ["list_contacts"],
  stores: [
    "get_store_directory",
    "find_nearest_store",
    "get_store_distance",
    "list_valliani_stores",
    "get_valliani_store_details",
  ],
  social: [
    "get_instagram_account",
    "get_instagram_recent_posts",
    "get_instagram_inbox",
    "open_social_dashboard",
    "draft_instagram_dm",
  ],
  calculator: ["get_metal_rates", "estimate_jewellery_price"],
  news: ["get_industry_news", "get_sports_news", "get_politics_news"],
  knowledge: ["search_company_knowledge"],
  navigation: ["show_detail_page", "get_settings_status", "open_data_analyst"],
  media: ["generate_jewellery_image"],
};

export function selectRelevantTools(input: {
  intent: AlexaIntent;
  currentRoute?: string;
  memory?: AlexaWorkingMemory;
}): AlexaToolDefinition[] {
  const names = new Set<string>();
  const domainTools = DOMAIN_TOOLS[input.intent.domain] ?? [];
  for (const n of domainTools) names.add(n);

  if (input.intent.requestedNavigation) {
    names.add("show_detail_page");
    if (input.intent.domain === "sales") names.add("apply_sales_dashboard_filters");
  }

  // Route-aware boosts
  const route = input.currentRoute ?? input.memory?.currentRoute ?? "";
  if (route.includes("/sales")) {
    for (const n of DOMAIN_TOOLS.sales) names.add(n);
  }

  const selected = [...names]
    .map((n) => TOOL_REGISTRY[n])
    .filter((t): t is AlexaToolDefinition => !!t)
    .slice(0, 8);

  if (selected.length === 0) {
    return listCanonicalTools().slice(0, 8);
  }
  return selected;
}

export function pickPrimaryTool(intent: AlexaIntent): string | null {
  if (!intent.requiresTool) return null;
  switch (intent.domain) {
    case "sales":
      if (intent.action === "compare") return "compare_sales";
      if (/\btop\b.*vendor|vendor models/i.test(JSON.stringify(intent.entities)))
        return "get_top_vendor_models";
      return "query_sales";
    case "email":
      return intent.action === "draft" ? "draft_email_reply" : "get_email_summary";
    case "calendar":
      if (intent.action === "create") return "add_meeting";
      if (intent.action === "delete") return "delete_meeting";
      return "get_calendar_today";
    case "tasks":
      if (intent.action === "create") return "add_task";
      if (intent.action === "delete") return "delete_task";
      return "list_tasks";
    case "knowledge":
      return "search_company_knowledge";
    case "stores":
      if (intent.action === "nearest" || intent.entities.nearest) return "find_nearest_store";
      if (intent.action === "distance") return "get_store_distance";
      return "get_store_directory";
    case "news":
      return "get_industry_news";
    case "calculator":
      return intent.action === "estimate" ? "estimate_jewellery_price" : "get_metal_rates";
    case "navigation":
      return "show_detail_page";
    case "media":
      return "generate_jewellery_image";
    case "social":
      return "get_instagram_account";
    case "contacts":
      return "list_contacts";
    default:
      return null;
  }
}
