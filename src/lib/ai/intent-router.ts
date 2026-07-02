export type RoutedIntent =
  | "calendar.read"
  | "calendar.create"
  | "calendar.delete"
  | "email.summary"
  | "email.draft"
  | "sales.read"
  | "sales.analysis"
  | "contacts.search"
  | "task.create"
  | "task.delete"
  | "news.gold"
  | "news.industry"
  | "image.generate"
  | "knowledge.search"
  | "navigation"
  | "complex_planner"
  | "confirm"
  | "reject"
  | "unknown";

export interface IntentRouteInput {
  message: string;
  currentPath?: string;
  selectedEmailId?: string;
  selectedMeetingId?: string;
}

const COMPLEX_TRIGGERS =
  /\b(analyze|analyse|compare|forecast|strategy|recommend|plan my day|executive briefing|summarize everything|sales performance|why did sales|multiple|and then)\b/i;

const MULTI_ACTION =
  /\b(and|aur|then|phir)\b.+\b(email|meeting|calendar|sales|task|draft|schedule|delete)\b/i;

/**
 * Deterministic intent router — no OpenAI cost for basic routing.
 * Planner runs ONLY when this returns complex_planner.
 */
export function routeIntent(input: IntentRouteInput): RoutedIntent {
  const lower = input.message.toLowerCase().trim();
  const path = input.currentPath ?? "";

  if (/^(yes|confirm|go ahead|send it|proceed|approved?|do it)\b/i.test(lower)) {
    return "confirm";
  }
  if (/^(no|cancel|reject|don't|stop|nevermind|never mind)\b/i.test(lower)) {
    return "reject";
  }

  if (COMPLEX_TRIGGERS.test(lower) || MULTI_ACTION.test(lower)) {
    return "complex_planner";
  }
  if (/\b(29 stores|top 5 issues|everything)\b/i.test(lower) && /\b(compare|analyze|briefing)\b/i.test(lower)) {
    return "complex_planner";
  }

  if (path === "/images" && /\b(generate|create|make)\b.*\b(image|photo|ring|necklace)\b/i.test(lower)) {
    return "image.generate";
  }
  if (path === "/email" && /\b(reply|draft|respond)\b/i.test(lower)) {
    return "email.draft";
  }
  if (path === "/sales" && /\b(explain|summarize|what does this mean)\b/i.test(lower)) {
    return "sales.read";
  }
  if (path === "/calendar" && /\b(delete|cancel|remove)\b/i.test(lower)) {
    return "calendar.delete";
  }

  if (/\b(gold|silver|metal)\b.*\b(price|rate)\b/i.test(lower) || /\bkitne ka gold\b/i.test(lower)) {
    return "news.gold";
  }
  if (/\b(calendar|meeting|schedule|appointment|aaj.*meeting)\b/i.test(lower)) {
    if (/\b(delete|cancel|remove)\b/i.test(lower)) return "calendar.delete";
    if (/\b(add|schedule|book|create)\b/i.test(lower)) return "calendar.create";
    return "calendar.read";
  }
  if (/\b(email|inbox|mail|unread)\b/i.test(lower)) {
    if (/\b(draft|reply|write)\b/i.test(lower)) return "email.draft";
    return "email.summary";
  }
  if (/\b(sales|revenue|top product|mhvr|csv report)\b/i.test(lower)) {
    if (/\b(analyze|trend|forecast|compare)\b/i.test(lower)) return "sales.analysis";
    return "sales.read";
  }
  if (/\b(contact|phone number|call )\b/i.test(lower)) return "contacts.search";
  if (/\b(remind|add task|create task|to-do)\b/i.test(lower)) return "task.create";
  if (/\b(delete task|remove task|cancel task)\b/i.test(lower)) return "task.delete";
  if (/\b(industry|jewelry|jewellery) news\b/i.test(lower)) return "news.industry";
  if (/\b(generate|create).*\b(image|photo|ring|necklace)\b/i.test(lower)) return "image.generate";
  if (/\b(policy|return|store count|brand|founder|valliani)\b/i.test(lower)) return "knowledge.search";
  if (/\b(open|go to|show)\b.*\b(page|dashboard|sales|email|calendar|analyst|images|news)\b/i.test(lower)) {
    return "navigation";
  }

  return "unknown";
}

export function intentToTool(intent: RoutedIntent): string | null {
  const map: Partial<Record<RoutedIntent, string>> = {
    "calendar.read": "get_calendar_today",
    "calendar.create": "add_meeting",
    "calendar.delete": "delete_meeting",
    "email.summary": "get_email_summary",
    "email.draft": "draft_email_reply",
    "sales.read": "get_today_sales",
    "sales.analysis": "open_data_analyst",
    "contacts.search": "list_contacts",
    "task.create": "add_task",
    "task.delete": "delete_task",
    "news.gold": "get_metal_rates",
    "news.industry": "get_industry_news",
    "image.generate": "generate_jewellery_image",
    "knowledge.search": "search_company_knowledge",
    "navigation": "show_detail_page",
  };
  return map[intent] ?? null;
}
