/**
 * Gmail-style Smart Compose — local phrase / next-word suggestions.
 * Instant, no API. Tab (or →) accepts; Esc dismisses.
 */

/** Longest-match wins. Triggers are lowercase trailing text (no trailing space). */
const PHRASE_COMPLETIONS: ReadonlyArray<readonly [string, string]> = [
  ["hi how are", " you?"],
  ["how are", " you?"],
  ["how is", " everything?"],
  ["hope you are", " doing well"],
  ["hope you're", " doing well"],
  ["thank you for", " your time"],
  ["thanks for", " your help"],
  ["thank you", " so much"],
  ["looking forward to", " hearing from you"],
  ["looking forward", " to hearing from you"],
  ["please let me", " know"],
  ["let me know", " if you have any questions"],
  ["if you have any", " questions"],
  ["please find", " attached"],
  ["as discussed", ","],
  ["as per our", " conversation"],
  ["just wanted to", " follow up"],
  ["wanted to", " follow up"],
  ["following up", " on"],
  ["i wanted to", " check in"],
  ["i hope this", " email finds you well"],
  ["best regards", ","],
  ["kind regards", ","],
  ["talk soon", "!"],
  ["see you", " soon"],
  ["have a great", " day"],
  ["have a nice", " day"],
  ["sounds good", " to me"],
  ["that works", " for me"],
  ["please advise", " at your earliest convenience"],
  ["at your earliest", " convenience"],
  ["i appreciate", " your help"],
  ["appreciate your", " patience"],
  ["circling back", " on this"],
  ["per our call", ","],
  ["attached please", " find"],
  ["can we", " schedule a quick call"],
  ["let's", " schedule a time"],
  ["good morning", "!"],
  ["good afternoon", "!"],
  ["hi there", ","],
  ["hello", ","],
];

/** Incomplete last token → rest (e.g. lookin → g forward to). */
const WORD_COMPLETIONS: ReadonlyArray<readonly [string, string]> = [
  ["lookin", "g forward to"],
  ["appreciat", "e your"],
  ["schedul", "e"],
  ["attach", "ed"],
  ["followin", "g up"],
  ["regard", "s,"],
  ["sincerel", "y,"],
  ["tomorro", "w"],
  ["questio", "n"],
  ["availab", "le"],
  ["confir", "m"],
  ["receiv", "ed"],
  ["updat", "e"],
  ["meetin", "g"],
];

function matchesTrigger(normalized: string, trigger: string): boolean {
  if (normalized === trigger) return true;
  if (normalized.endsWith(` ${trigger}`)) return true;
  // Long phrases may start at line begin without a leading space
  return trigger.length >= 10 && normalized.endsWith(trigger);
}

/** Suggest continuation for text before the caret (plain). Empty = no suggestion. */
export function suggestComposeContinuation(textBeforeCaret: string): string {
  const raw = textBeforeCaret.replace(/\u00a0/g, " ");
  if (!raw.trim() || raw.length > 4000) return "";

  const endsWithSpace = /\s$/.test(raw);
  const normalized = raw.replace(/\s+/g, " ").replace(/\s+$/, "").toLowerCase();
  if (!normalized) return "";

  let bestTrigger = "";
  let bestCompletion = "";

  for (const [trigger, completion] of PHRASE_COMPLETIONS) {
    if (!matchesTrigger(normalized, trigger)) continue;
    if (trigger.length < bestTrigger.length) continue;
    bestTrigger = trigger;
    bestCompletion = completion;
  }

  if (bestCompletion) {
    if (endsWithSpace) return bestCompletion.replace(/^\s+/, "");
    if (/^[,!?]/.test(bestCompletion)) return bestCompletion;
    return bestCompletion.startsWith(" ") ? bestCompletion : ` ${bestCompletion}`;
  }

  if (endsWithSpace) return "";
  const m = normalized.match(/([a-z']+)$/);
  if (!m) return "";
  const token = m[1];
  if (token.length < 4) return "";

  for (const [prefix, rest] of WORD_COMPLETIONS) {
    if (token === prefix) return rest;
    if (prefix.startsWith(token) && token.length >= 4) {
      return prefix.slice(token.length) + rest;
    }
  }

  return "";
}
