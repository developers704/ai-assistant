export type VoicePrefetchIntent =
  | "email_draft"
  | "email"
  | "calendar"
  | "meeting_create"
  | "sales"
  | "task_list"
  | "task_remove"
  | "task_complete"
  | "contacts"
  | "daily_briefing"
  | "news"
  | "sports_news"
  | "politics_news"
  | "metal_rates"
  | "price_estimate"
  | "image_generate"
  | "analyst"
  | "knowledge"
  | "store_nearest"
  | "store_directory"
  | "settings"
  | "navigation";

/** Fix common Realtime speech-to-text mishearings before intent detection. */
export function normalizeVoiceTranscript(text: string): string {
  let t = text.trim();
  t = t.replace(/make a graph for this scene/gi, "make a draft of this email");
  t = t.replace(/graph for this scene/gi, "draft of this email");
  t = t.replace(/draft of this scene/gi, "draft of this email");
  t = t.replace(/draft of the scene/gi, "draft of this email");
  t = t.replace(/make a graph/gi, "make a draft");
  t = t.replace(/draft (?:of )?this seen/gi, "draft of this email");
  t = t.replace(/this scene/gi, "this email");
  return t;
}

export function extractTaskQuery(text: string): string | null {
  const patterns = [
    /(?:remove|delete|cancel)\s+(?:the\s+)?task\s+(?:about\s+|called\s+|named\s+)?(.+)/i,
    /(?:remove|delete)\s+(.+?)\s+from\s+(?:my\s+)?tasks?/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

export function extractCompleteTaskQuery(text: string): string | null {
  const patterns = [
    /(?:complete|finish|done with|mark complete)\s+(?:the\s+)?task\s+(?:about\s+|called\s+)?(.+)/i,
    /(?:complete|finish|mark done)\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

export function extractContactQuery(text: string): string {
  const patterns = [
    /(?:contact|phone(?:\s+number)?|call|whatsapp|reach)\s+(?:for\s+)?(.+)/i,
    /(?:who is|find)\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

export function extractImagePrompt(text: string): string | null {
  const patterns = [
    /(?:generate|create|make)\s+(?:an?\s+)?(?:image|photo|picture)\s+(?:of\s+)?(.+)/i,
    /(?:generate|create)\s+(.+?(?:necklace|ring|earring|bracelet|jewel|gold|diamond).*)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

export function extractPriceEstimate(text: string): { weight: number; karat?: string } | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:gram|grams|g)\b.*?(\d{2}k)?/i);
  if (m) {
    return { weight: parseFloat(m[1]), karat: m[2]?.toUpperCase() };
  }
  const m2 = text.match(/(\d+(?:\.\d+)?)\s*(?:gram|grams|g)\b/i);
  if (m2) return { weight: parseFloat(m2[1]) };
  return null;
}

const MEETING_CREATE =
  /\b(set|schedule|book|create|add|plan)\b[\s\S]{0,30}\b(meeting|appointment|call)\b/i;

const CALENDAR_READ =
  /(?:what'?s|whats|show|list|view|see|tell me)\b[\s\S]{0,40}\b(?:today|tomorrow|my)?\s*(?:schedule|calendar|calender|meetings?|appointments?|events?)\b/i;

export function detectVoiceIntent(text: string): VoicePrefetchIntent | null {
  const lower = normalizeVoiceTranscript(text).toLowerCase().trim();
  if (!lower) return null;

  if (
    /daily briefing|morning briefing|what should i focus|give me a briefing|full briefing/i.test(
      lower
    )
  ) {
    return "daily_briefing";
  }

  if (
    /(?:generate|create|make)\s+(?:an?\s+)?(?:image|photo|picture)|generate .*(?:necklace|ring|earring|jewel)/i.test(
      lower
    )
  ) {
    return "image_generate";
  }

  if (
    /sports news|sports headlines|latest sports|(?:nfl|nba|mlb|soccer|football)\s+(?:news|headlines)|what(?:'s| is) (?:the )?(?:sports|game)/i.test(
      lower
    )
  ) {
    return "sports_news";
  }

  if (
    /politics news|political news|politics headlines|us politics|world news|international news|what(?:'s| is) happening (?:in|with) politics|headlines today/i.test(
      lower
    )
  ) {
    return "politics_news";
  }

  if (
    /(?:industry|jewell?(?:ery|ery)?|jewelry)\s+news|what(?:'s| is) in the news|news today/i.test(
      lower
    )
  ) {
    return "news";
  }

  if (
    /gold price|silver price|metal rate|price of gold|how much is gold|live rate|spot price/i.test(
      lower
    )
  ) {
    return "metal_rates";
  }

  if (
    /how much (?:for|is|would)|price (?:for|of)|estimate|quote.*(?:gram|gold|22k|24k)/i.test(lower) &&
    /\d+\s*(?:gram|grams|g)\b/i.test(lower)
  ) {
    return "price_estimate";
  }

  if (
    /data analyst|analyze (?:my )?(?:sales )?(?:data|report|csv)|upload csv|analyst page|top products? in (?:the )?report/i.test(
      lower
    )
  ) {
    return "analyst";
  }

  if (
    /open (?:the )?(?:stores?(?:\s+map(?:\s+and\s+info)?)?|store\s+(?:map|locator)|locations?|sales|calendar|email|dashboard|chat|contacts|images|news|analyst|calculator|settings)|go to (?:stores?(?:\s+map(?:\s+and\s+info)?)?|store\s+(?:map|locator)|locations?|sales|calendar|email|dashboard|chat|contacts|images|news|analyst|calculator|settings)/i.test(
      lower
    )
  ) {
    return "navigation";
  }

  if (
    /(?:closest|nearest)\b[\s\S]{0,50}\b(?:to|from)\b/i.test(lower) ||
    /\bwhich\s+(?:branch|store)\b[\s\S]{0,30}\b(?:closest|nearest)\b/i.test(lower)
  ) {
    return "store_nearest";
  }

  if (
    (/\b(?:address|phone|hours)\b[\s\S]{0,20}\b(?:of|for|at)\b/i.test(lower) &&
      /\b(?:store|stores|branch|mall|mills|plaza|fair|center|location)\b/i.test(lower)) ||
    /\bstores?\s+(?:in|near|across)\b/i.test(lower) ||
    /\bcall\b[\s\S]{0,30}\b(?:mall|mills|center|fair|plaza)\b/i.test(lower) ||
    /\b(?:how many|list|show)\b[\s\S]{0,20}\bstores?\b/i.test(lower)
  ) {
    return "store_directory";
  }

  if (
    /policy|return policy|brand|founder|company knowledge|warranty|layaway/i.test(lower) &&
    !/\b(?:store|stores|mall|nearest|closest|address|phone)\b/i.test(lower)
  ) {
    return "knowledge";
  }

  if (/\bvalliani\b/i.test(lower) && /\b(?:everything|all you know|overview)\b/i.test(lower)) {
    return "knowledge";
  }

  if (
    /settings|integrations?|is google connected|google connected|plaid connected|connection status|disconnect google/i.test(
      lower
    )
  ) {
    return "settings";
  }

  if (
    /draft.*(?:email|reply|mail)|make a draft|write (?:an? )?email|reply to|compose (?:an? )?email|email draft|draft of this/i.test(
      lower
    )
  ) {
    return "email_draft";
  }

  if (
    (MEETING_CREATE.test(lower) || /\bmeeting\s+with\b/i.test(lower)) &&
    !/\b(delete|cancel|remove)\b/i.test(lower)
  ) {
    return "meeting_create";
  }

  if (
    /(?:remove|delete|cancel)\s+(?:the\s+)?task|remove .+ from (?:my )?tasks?/i.test(lower)
  ) {
    return "task_remove";
  }

  if (
    /(?:complete|finish|mark complete|mark done|done with)\s+(?:the\s+)?task|complete .+ task/i.test(
      lower
    )
  ) {
    return "task_complete";
  }

  if (
    /(?:my tasks|task list|pending tasks?|to-?do list|what tasks|what do i need to do|list tasks)/i.test(
      lower
    )
  ) {
    return "task_list";
  }

  if (
    /contacts?|phone number|call ross|call umair|who is|find contact|whatsapp/i.test(lower) &&
    !/draft|email|calendar|sales|task|meeting/i.test(lower)
  ) {
    return "contacts";
  }

  if (
    /summarize.*(?:email|inbox)|email summary|important emails?|my (email|inbox)|inbox summary|unread emails?|check (my )?email|emails? to reply|any (new )?mail|open (?:the |my )?email|show (?:the |my )?email|go to email/i.test(
      lower
    )
  ) {
    return "email";
  }

  if (
    CALENDAR_READ.test(lower) ||
    /(?:today|tomorrow)('s)?\s*schedule\b/i.test(lower) ||
    /(?:what|anything)\b[\s\S]{0,20}\b(?:on|for)\b[\s\S]{0,20}\b(?:today|tomorrow)\b/i.test(lower) ||
    (/calendar|meetings? today|events? today|appointments?/i.test(lower) &&
      !/\b(add|schedule|book|create|set|plan)\b/i.test(lower))
  ) {
    return "calendar";
  }

  if (
    /sales|revenue|top store|top product|best store|best sku|how much (did we|have we) sell|store(s)? performance|transactions today/i.test(
      lower
    )
  ) {
    return "sales";
  }

  return null;
}

export function extractNavigationPage(text: string): string | null {
  const lower = text.toLowerCase();
  const pages = [
    "settings",
    "analyst",
    "calculator",
    "contacts",
    "dashboard",
    "calendar",
    "images",
    "sales",
    "email",
    "news",
    "chat",
  ] as const;
  for (const page of pages) {
    if (new RegExp(`\\b${page}\\b`).test(lower)) return page;
  }
  return null;
}
