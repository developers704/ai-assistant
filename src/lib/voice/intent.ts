export type VoicePrefetchIntent = "email_draft" | "email" | "calendar" | "sales";

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

export function detectVoiceIntent(text: string): VoicePrefetchIntent | null {
  const lower = normalizeVoiceTranscript(text).toLowerCase().trim();
  if (!lower) return null;

  if (
    /draft.*(?:email|reply|mail)|make a draft|write (?:an? )?email|reply to|compose (?:an? )?email|email draft|draft of this/i.test(
      lower
    )
  ) {
    return "email_draft";
  }

  if (
    /summarize.*(?:email|inbox)|email summary|important emails?|my (email|inbox)|inbox summary|unread emails?|check (my )?email|emails? to reply|any (new )?mail/i.test(
      lower
    )
  ) {
    return "email";
  }

  if (
    /calendar|schedule|meeting|what'?s on today|events? today|on my (calendar|plate)|my day look|appointments?/i.test(
      lower
    )
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
