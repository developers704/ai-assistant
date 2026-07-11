export type RoutedIntent =
  | "calendar.read"
  | "calendar.create"
  | "calendar.delete"
  | "calendar.delete_all"
  | "email.summary"
  | "email.draft"
  | "sales.read"
  | "sales.top_store"
  | "sales.query"
  | "sales.compare"
  | "sales.analysis"
  | "contacts.search"
  | "task.create"
  | "task.delete"
  | "news.gold"
  | "news.industry"
  | "image.generate"
  | "knowledge.search"
  | "store.nearest"
  | "store.list"
  | "store.lookup"
  | "store.call"
  | "store.opening_soon"
  | "social.open"
  | "social.account"
  | "social.posts"
  | "social.comments"
  | "social.insights"
  | "social.caption"
  | "social.reply"
  | "social.inbox"
  | "social.thread"
  | "social.dm"
  | "social.publish_blocked"
  | "navigation"
  | "affirmative.open"
  | "complex_planner"
  | "confirm"
  | "reject"
  | "unknown";

import { isComposeEmailToPerson } from "@/lib/ai/email-compose";
import { isStoreIntelligenceQuery } from "@/lib/stores/store-intelligence";

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
  /\b(analyze|analyse|compare|forecast|strategy|recommend|plan my day|summarize everything|sales performance|why did sales|multiple|and then)\b/i;

const MULTI_ACTION =
  /\b(and|aur|then|phir)\b.+\b(email|meeting|calendar|sales|task|draft|schedule|delete)\b/i;

const EMAIL_DRAFT =
  /\b(send|write|draft|compose|reply)\b[\s\S]{0,40}\b(email|mail|message)\b[\s\S]{0,30}\b(to|for)\b/i;

const EMAIL_DRAFT_ALT =
  /\b(email|mail)\s+to\s+[a-z]/i;

const MEETING_CREATE =
  /\b(set|schedule|book|create|add|plan)\b[\s\S]{0,30}\b(meeting|appointment|call)\b/i;

const MEETING_SCHEDULE_WITH =
  /\bschedule\b[\s\S]{0,20}\b(?:a |an )?(?:meeting|appointment|call)\b/i;

const CALENDAR_READ =
  /(?:what'?s|whats|what is|show|list|view|see|tell me|check)\b[\s\S]{0,50}\b(?:today|tomorrow|my)?\s*(?:schedule|calendar|calender|meetings?|appointments?|events?)\b/i;

const CALENDAR_READ_ALT =
  /(?:today|tomorrow)('s)?\s*schedule\b|\b(?:my|any)\s+(?:meetings?|appointments?|events?)\b(?:\s+(?:today|tomorrow))?|\bwhat\b[\s\S]{0,25}\b(?:on|for)\b[\s\S]{0,25}\b(?:today|tomorrow)\b/i;

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
const MALL_HINT =
  /\b(mall|mills|center|centre|fair|plaza|outlets|galleria|fashion|valley|oakridge|eastridge|meadowood|baybrook|deerbrook|ontario|great)\b/i;

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

  // Simple sales entity compare — before complex_planner (which also matches "compare")
  if (
    /\bcompare\b[\s\S]{0,80}\b(and|with|vs\.?|versus|aur)\b/i.test(lower) &&
    !/\b(correlation|correlated|forecast|anomaly|predict|segment|strategy|plan my day)\b/i.test(lower)
  ) {
    return "sales.compare";
  }

  if (COMPLEX_TRIGGERS.test(lower) || MULTI_ACTION.test(lower)) {
    return "complex_planner";
  }
  if (/\b(29 stores|top 5 issues|everything)\b/i.test(lower) && /\b(compare|analyze)\b/i.test(lower)) {
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

  if (isComposeEmailToPerson(input.message)) {
    return "email.draft";
  }

  if (MEETING_CREATE.test(lower) || (MEETING_WITH.test(lower) && /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(am|pm))\b/i.test(lower))) {
    if (/\b(delete|cancel|remove)\b/i.test(lower)) return "calendar.delete";
    return "calendar.create";
  }

  if (TOP_STORE.test(lower) || ONE_TOP_STORE.test(lower) || /\bwhich\s+store\b.*\b(sales|revenue|best|top)\b/i.test(lower)) {
    return "sales.top_store";
  }

  // Sales Intelligence — filtered / compare / entity questions (before generic sales)
  const SALES_ENTITY =
    /\b(novell?o|ovani|ovanny|ladys?\s+ring|ladies\s+ring|gents?\s+ring|gold\s+chain|earrings?|rolex|mhvr|kma|kgs|14\s*k(?:t|arat)?|10\s*k(?:t|arat)?|18\s*k(?:t|arat)?|great\s*mall|valley\s*fair)\b/i;
  const SALES_FOLLOWUP =
    /\b(now by|by department|by store|by vendor|by design|by class|what about|same for|ab |hisaab|top vendor models?|top models?|break it down|lowest five|top five)\b/i;
  const SALES_COMPARE =
    /\bcompare\b[\s\S]{0,80}\b(and|with|vs\.?|versus|aur)\b/i;

  if (
    SALES_COMPARE.test(lower) &&
    !/\b(correlation|forecast|anomaly|predict|segment)\b/i.test(lower)
  ) {
    return "sales.compare";
  }

  if (
    (SALES_ENTITY.test(lower) || SALES_FOLLOWUP.test(lower)) &&
    (/\b(sales|revenue|margin|discount|units?|sold|batao|dikhao|show|kitni|kitna)\b/i.test(lower) ||
      SALES_FOLLOWUP.test(lower) ||
      /\b(novell?o|ovani|ladys?\s+ring|mhvr)\b/i.test(lower))
  ) {
    if (/\b(correlation|correlated|forecast|anomaly|predict|trend model)\b/i.test(lower)) {
      return "sales.analysis";
    }
    return "sales.query";
  }

  if (/\b(gold|silver|metal)\b.*\b(price|rate)\b/i.test(lower) || /\bkitne ka gold\b/i.test(lower)) {
    return "news.gold";
  }

  if (CALENDAR_TYPO.test(lower) || /\b(calendar|meeting|schedule|appointment|aaj.*meeting)\b/i.test(lower)) {
    if (/\b(delete|cancel|remove)\b/i.test(lower)) return "calendar.delete";
    if (CALENDAR_READ.test(lower) || CALENDAR_READ_ALT.test(lower)) return "calendar.read";
    if (
      /\b(add|book|create|set|plan)\b/i.test(lower) ||
      MEETING_SCHEDULE_WITH.test(lower) ||
      MEETING_CREATE.test(lower)
    ) {
      return "calendar.create";
    }
    return "calendar.read";
  }

  if (/\b(email|inbox|mail|unread)\b/i.test(lower)) {
    if (/\b(draft|reply|write|send)\b/i.test(lower)) return "email.draft";
    return "email.summary";
  }

  if (/\b(sales|revenue|top product|mhvr|csv report|novell?o|ovani|ladys?\s+ring|discount rate|margin)\b/i.test(lower)) {
    if (/\b(correlation|correlated|forecast|anomaly|predict|trend model|segment)\b/i.test(lower)) {
      return "sales.analysis";
    }
    if (/\b(analyze|trend)\b/i.test(lower) && !SALES_ENTITY.test(lower)) {
      return "sales.analysis";
    }
    if (FULL_SALES_REPORT.test(lower)) return "sales.read";
    if (/\b(store|location)\b/i.test(lower) && !SALES_ENTITY.test(lower) && !SALES_FOLLOWUP.test(lower)) {
      return "sales.top_store";
    }
    if (SALES_ENTITY.test(lower) || SALES_FOLLOWUP.test(lower) || /\b(by department|by vendor|by design|by class)\b/i.test(lower)) {
      return "sales.query";
    }
    return "sales.read";
  }

  if (/\bcall\b/i.test(lower) && MALL_HINT.test(lower)) return "store.call";
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

  if (isStoreIntelligenceQuery(input.message)) {
    if (/\b(?:closest|nearest)\b/i.test(lower)) return "store.nearest";
    if (/\bcall\b/i.test(lower) && MALL_HINT.test(lower)) return "store.call";
    if (/\b(?:address|phone|hours)\b/i.test(lower)) return "store.lookup";
    if (/\bstores?\s+(?:are\s+)?(?:in|across)\b/i.test(lower) && /\b(california|nevada|arizona|texas|ca|nv|az|tx)\b/i.test(lower)) {
      return "store.list";
    }
    if (/\bstores?\s+(?:in|near|around)\b/i.test(lower)) return "store.list";
    if (/\b(?:how many|list|show|all)\b/i.test(lower) && /\bstores?\b/i.test(lower)) return "store.list";
    if (/\bopening soon\b/i.test(lower)) return "store.opening_soon";
    return "store.lookup";
  }

  if (/\b(instagram|insta|social media|social)\b/i.test(lower)) {
    if (/\b(post|publish|upload|share)\b[\s\S]{0,30}\b(instagram|insta|this|it)\b/i.test(lower)) {
      return "social.publish_blocked";
    }
    if (/\bcaption\b/i.test(lower)) return "social.caption";
    if (/\breply\b/i.test(lower) && /\bcomment\b/i.test(lower)) return "social.reply";
    if (/\b(dms?|direct messages?|inbox|messaged me|messages?)\b/i.test(lower)) {
      if (/\b(draft|write|reply|respond)\b/i.test(lower) && /\b(dms?|message)\b/i.test(lower)) return "social.dm";
      return "social.inbox";
    }
    if (/\bcomments?\b/i.test(lower)) return "social.comments";
    if (/\b(insight|perform|reach|impression|engagement)\b/i.test(lower)) return "social.insights";
    if (/\b(followers?|account|profile|bio)\b/i.test(lower)) return "social.account";
    if (/\b(posts?|content|feed)\b/i.test(lower)) return "social.posts";
    return "social.open";
  }

  if (/\b(policy|return|brand|founder)\b/i.test(lower)) return "knowledge.search";
  if (/\bstore count\b/i.test(lower)) return "store.list";
  if (/\bvalliani\b/i.test(lower) && !/\b(store|stores|mall|location|branch|nearest|closest)\b/i.test(lower)) {
    return "knowledge.search";
  }
  if (
    /\b(tell me\s+)?(everything|all)\b[\s\S]{0,50}\b(you know|about|on)\b/i.test(lower) ||
    /\beverything you know\b/i.test(lower) ||
    /\b(company overview|about valliani)\b/i.test(lower)
  ) {
    return "knowledge.search";
  }
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
    "sales.query": "query_sales",
    "sales.compare": "compare_sales",
    "sales.analysis": "open_data_analyst",
    "contacts.search": "list_contacts",
    "task.create": "add_task",
    "task.delete": "delete_task",
    "news.gold": "get_metal_rates",
    "news.industry": "get_industry_news",
    "image.generate": "generate_jewellery_image",
    "knowledge.search": "search_company_knowledge",
    "store.nearest": "find_nearest_store",
    "store.list": "list_valliani_stores",
    "store.lookup": "get_valliani_store_details",
    "store.call": "get_valliani_store_details",
    "store.opening_soon": "list_valliani_stores",
    "social.open": "open_social_dashboard",
    "social.account": "get_instagram_account",
    "social.posts": "get_instagram_recent_posts",
    "social.comments": "get_instagram_post_comments",
    "social.insights": "get_instagram_post_insights",
    "social.caption": "draft_instagram_caption",
    "social.reply": "draft_instagram_comment_reply",
    "social.inbox": "get_instagram_inbox",
    "social.thread": "get_instagram_conversation",
    "social.dm": "draft_instagram_dm",
    "navigation": "show_detail_page",
  };
  return map[intent] ?? null;
}
