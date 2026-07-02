export type VoicePrefetchIntent =
  | "email_draft"
  | "email"
  | "calendar"
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
  | "analyst";

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

  if (/data analyst|analyze (?:my )?data|sales csv|upload csv|analyst page/i.test(lower)) {
    return "analyst";
  }

  if (
    /draft.*(?:email|reply|mail)|make a draft|write (?:an? )?email|reply to|compose (?:an? )?email|email draft|draft of this/i.test(
      lower
    )
  ) {
    return "email_draft";
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
    /calendar|schedule|meeting|what'?s on today|events? today|on my (calendar|plate)|my day look|appointments?|open (?:the |my )?calendar|show (?:the |my )?calendar|go to calendar/i.test(
      lower
    ) &&
    !/add meeting|schedule a|remove meeting|cancel meeting|delete meeting/i.test(lower)
  ) {
    return "calendar";
  }

  if (
    /sales|revenue|how much (did we|have we) sell|store(s)? performance|transactions today/i.test(
      lower
    )
  ) {
    return "sales";
  }

  return null;
}
