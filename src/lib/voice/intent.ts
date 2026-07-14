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
  | "navigation"
  | "session_control";

/** Deterministic-only intents when ALEXA_LIMITED_VOICE_FASTPATH is on. */
export type VoiceFastPathOnly =
  | "navigation"
  | "session_control";

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
  t = t.replace(/\bnovelo\b/gi, "novello");
  t = t.replace(/\bgray mall\b/gi, "great mall");
  return t;
}

/**
 * Limited fast-path: stop/cancel/mute/open-section only.
 * Complex business requests must go through the Realtime model / orchestrator.
 */
export function detectLimitedVoiceFastPath(text: string): VoicePrefetchIntent | null {
  const lower = normalizeVoiceTranscript(text).toLowerCase().trim();
  if (!lower) return null;

  if (
    /^(stop|cancel|never\s*mind|nevermind|shut up|be quiet|end (?:the )?(?:session|call)|mute|unmute|go back)\b/i.test(
      lower
    )
  ) {
    return "session_control";
  }

  if (
    /^(yes|yeah|yep|confirm|do it|go ahead|send it|please send)\.?$/i.test(lower) ||
    /^(no|nope|reject|don't|do not)\.?$/i.test(lower)
  ) {
    return "session_control";
  }

  if (isOpenSectionRequest(lower) && extractNavigationPage(lower)) {
    return "navigation";
  }

  return null;
}

/** True when "show/open … sales" includes a filter entity (design/store/etc.), not bare Sales Dashboard. */
export function isFilteredSalesShowRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!/\bsales?\b/i.test(lower)) return false;
  if (
    /^(?:please\s+)?(?:open|show(?:\s+me)?|go to|take me to|navigate to)\s+(?:the\s+|my\s+)?sales(?:\s+today|\s+dashboard)?\.?$/i.test(
      lower
    )
  ) {
    return false;
  }
  const remainder = lower
    .replace(
      /\b(please|show(?:\s+me)?|open|go to|take me to|navigate to|the|my|page|section|screen|sales(?:\s+today|\s+dashboard)?|dashboard)\b/gi,
      " "
    )
    .replace(/[?.!,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return remainder.length >= 2;
}

function isMostlySectionName(rest: string): boolean {
  const cleaned = rest
    .replace(
      /\b(sales(?:\s+today|\s+dashboard)?|news(?:\s+and\s+markets)?|ai\s+chat|chat|email|inbox|calendar|calender|stores?(?:\s+map(?:\s+and\s+info)?|\s+and\s+map|\s+map|\s+info)?|price\s+calculator|calculator|data\s+analyst|analyst|image\s+generation|images|social|contacts?|settings|page|section|screen|the|my)\b/gi,
      " "
    )
    .replace(/[?.!,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length < 3;
}

/** True when the user is asking to open/navigate to a section (not asking for data). */
export function isOpenSectionRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (isFilteredSalesShowRequest(lower)) return false;

  if (/^(?:please\s+)?(?:open|go to|take me to|navigate to)\b/i.test(lower)) {
    const rest = lower
      .replace(/^(?:please\s+)?(?:open|go to|take me to|navigate to)\s+(?:the\s+|my\s+)?/i, "")
      .replace(/[?.!,]+$/g, "")
      .trim();
    return isMostlySectionName(rest);
  }
  // "show me …" only when the whole phrase is essentially a section open
  if (
    /^(?:please\s+)?show(?:\s+me)?\s+(?:the\s+|my\s+)?(?:sales(?:\s+today|\s+dashboard)?|news(?:\s+and\s+markets)?|ai\s+chat|chat|email|inbox|calendar|calender|stores?(?:\s+map(?:\s+and\s+info)?|\s+and\s+map|\s+map|\s+info)?|price\s+calculator|calculator|data\s+analyst|analyst|image\s+generation|images|social|contacts?|settings)\.?$/i.test(
      lower
    )
  ) {
    return true;
  }
  return false;
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
  // When limited fast-path is enabled (env), only deterministic commands bypass the model.
  if (process.env.ALEXA_LIMITED_VOICE_FASTPATH === "true") {
    return detectLimitedVoiceFastPath(text);
  }

  const lower = normalizeVoiceTranscript(text).toLowerCase().trim();
  if (!lower) return null;

  // Open/navigate a section — always before sales/email/news data intents.
  if (isOpenSectionRequest(lower) && extractNavigationPage(lower)) {
    return "navigation";
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
    /summarize.*(?:email|inbox)|email summary|important emails?|my (email|inbox)|inbox summary|unread emails?|check (my )?email|emails? to reply|any (new )?mail/i.test(
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
    /sales|revenue|top store|top product|best store|best sku|how much (did we|have we) sell|store(s)? performance|transactions today|sales (?:of|on|for)/i.test(
      lower
    ) ||
    /\b(explain|discuss|summarize|summary|overview)\b[\s\S]{0,40}\b(novello|ovani|mhvr|department|design|vendor|class|mall|store)\b/i.test(
      lower
    ) ||
    /\b(novello|ovani|mhvr)\b/i.test(lower) ||
    /\bhow much\b[\s\S]{0,30}\b(novello|ovani|mhvr|department|design|vendor|mall|store)\b/i.test(
      lower
    ) ||
    isFilteredSalesShowRequest(lower)
  ) {
    return "sales";
  }

  return null;
}

export function extractNavigationPage(text: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveOpenSectionId } = require("@/lib/ai/app-map") as typeof import("@/lib/ai/app-map");
    return resolveOpenSectionId(text);
  } catch {
    const lower = text.toLowerCase();
    const pages = [
      "settings",
      "analyst",
      "calculator",
      "contacts",
      "calendar",
      "images",
      "sales",
      "email",
      "news",
      "chat",
      "social",
      "stores",
    ] as const;
    for (const page of pages) {
      if (new RegExp(`\\b${page}\\b`).test(lower)) return page;
    }
    return null;
  }
}
