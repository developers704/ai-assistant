export type RoutedIntent =
  | "calendar.read"
  | "calendar.create"
  | "calendar.delete"
  | "calendar.delete_all"
  | "email.summary"
  | "email.draft"
  | "sales.read"
  | "sales.top_store"
  | "sales.analysis"
  | "contacts.search"
  | "task.create"
  | "task.delete"
  | "news.gold"
  | "news.industry"
  | "image.generate"
  | "knowledge.search"
  | "navigation"
  | "affirmative.open"
  | "complex_planner"
  | "confirm"
  | "reject"
  | "unknown";

export interface IntentRouteInput {
  message: string;
  currentPath?: string;
  selectedEmailId?: string;
  selectedMeetingId?: string;
  hasPendingAction?: boolean;
}

const DELETE_ALL_CALENDAR =
  /\b(remove|delete|clear|wipe|empty)\b[\s\S]{0,40}\b(all|everything|every)\b[\s\S]{0,40}\b(calender|calendar|meetings?|schedule|events?)\b/i;

const DELETE_ALL_MEETINGS =
  /\b(remove|delete|clear)\b[\s\S]{0,30}\b(all|every|everything)\b[\s\S]{0,30}\bmeeting/i;

const CALENDAR_TYPO = /\b(calender|calendar)\b/i;

const COMPLEX_TRIGGERS =
  /\b(analyze|analyse|compare|forecast|strategy|recommend|plan my day|executive briefing|summarize everything|sales performance|why did sales|multiple|and then)\b/i;

const MULTI_ACTION =
  /\b(and|aur|then|phir)\b.+\b(email|meeting|calendar|sales|task|draft|schedule|delete)\b/i;

const EMAIL_DRAFT =
  /\b(send|write|draft|compose|reply)\b[\s\S]{0,40}\b(email|mail|message)\b[\s\S]{0,30}\b(to|for)\b/i;

const EMAIL_DRAFT_ALT =
  /\b(email|mail)\s+to\s+[a-z]/i;

const MEETING_CREATE =
  /\b(set|schedule|book|create|add|plan)\b[\s\S]{0,30}\b(meeting|appointment|call)\b/i;

const MEETING_WITH =
  /\bmeeting\s+with\b/i;

const TOP_STORE =
  /\b(best|top|highest|leading|#1|number\s*one)\b.*\b(store|location)\b/i;

const ONE_TOP_STORE =
  /\b(one|single)\s+store\b.*\b(top|sales|best|highest)\b/i;

const FULL_SALES_REPORT =
  /\b(full|complete|entire|detailed|breakdown|all stores|all products)\b.*\b(report|sales|summary)\b/i;

/**
 * Deterministic intent router — priority-ordered; no blanket "yes" → confirm.
 */
export function routeIntent(input: IntentRouteInput): RoutedIntent {
  const lower = input.message.toLowerCase().trim();
  const path = input.currentPath ?? "";

  if (/^(no|cancel|reject|don't|stop|nevermind|never mind)\b/i.test(lower)) {
    return "reject";
  }

  if (
    /^(yes|yeah|yep|sure|ok|okay|alright|please|pls)\b/i.test(lower) &&
    (/\b(open|show|go to|view|read|more|news|market|sales|email|calendar)\b/i.test(lower))
  ) {
    return "affirmative.open";
  }

  if (/^(yes|confirm|go ahead|send it|proceed|approved?|do it)\b/i.test(lower)) {
    return input.hasPendingAction ? "confirm" : "affirmative.open";
  }

  if (DELETE_ALL_CALENDAR.test(lower) || DELETE_ALL_MEETINGS.test(lower)) {
    return "calendar.delete_all";
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

  if (EMAIL_DRAFT.test(lower) || EMAIL_DRAFT_ALT.test(lower)) {
    return "email.draft";
  }

  if (MEETING_CREATE.test(lower) || (MEETING_WITH.test(lower) && /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(am|pm))\b/i.test(lower))) {
    if (/\b(delete|cancel|remove)\b/i.test(lower)) return "calendar.delete";
    return "calendar.create";
  }

  if (TOP_STORE.test(lower) || ONE_TOP_STORE.test(lower) || /\bwhich\s+store\b.*\b(sales|revenue|best|top)\b/i.test(lower)) {
    return "sales.top_store";
  }

  if (/\b(gold|silver|metal)\b.*\b(price|rate)\b/i.test(lower) || /\bkitne ka gold\b/i.test(lower)) {
    return "news.gold";
  }

  if (CALENDAR_TYPO.test(lower) || /\b(calendar|meeting|schedule|appointment|aaj.*meeting)\b/i.test(lower)) {
    if (/\b(delete|cancel|remove)\b/i.test(lower)) return "calendar.delete";
    if (/\b(add|schedule|book|create|set|plan)\b/i.test(lower)) return "calendar.create";
    return "calendar.read";
  }

  if (/\b(email|inbox|mail|unread)\b/i.test(lower)) {
    if (/\b(draft|reply|write|send)\b/i.test(lower)) return "email.draft";
    return "email.summary";
  }

  if (/\b(sales|revenue|top product|mhvr|csv report)\b/i.test(lower)) {
    if (/\b(analyze|trend|forecast|compare)\b/i.test(lower)) return "sales.analysis";
    if (FULL_SALES_REPORT.test(lower)) return "sales.read";
    if (/\b(store|location)\b/i.test(lower)) return "sales.top_store";
    return "sales.read";
  }

  if (/\b(contact|phone number|call )\b/i.test(lower)) return "contacts.search";
  if (/\b(remind|add task|create task|to-do)\b/i.test(lower)) return "task.create";
  if (/\b(delete task|remove task|cancel task)\b/i.test(lower)) return "task.delete";
  if (/\b(industry|jewelry|jewellery|market)\b.*\bnews\b/i.test(lower) || /\bnews\b.*\b(market|industry|jewelry|jewellery)\b/i.test(lower)) {
    return "news.industry";
  }
  if (/\b(news|market|headlines|gold news)\b/i.test(lower) && /\b(what|about|tell|show|latest)\b/i.test(lower)) {
    return "news.industry";
  }
  if (/\b(news|market)\b/i.test(lower) && !/\b(email|inbox|mail)\b/i.test(lower)) {
    return "news.industry";
  }
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
    "calendar.delete_all": "delete_all_meetings",
    "email.summary": "get_email_summary",
    "email.draft": "draft_email_reply",
    "sales.read": "get_today_sales",
    "sales.top_store": "get_today_sales",
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
