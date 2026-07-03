/** Client-safe yes/no and follow-up detection for chat routing. */

const STRICT_CONFIRM =
  /^(yes|confirm|go ahead|send it|proceed|approved?|do it)[!.?]*$/i;

const AFFIRMATIVE_PREFIX =
  /^(yes|yeah|yep|sure|ok|okay|alright|please|pls)\b/i;

const OPEN_VERBS = /\b(open|show|go to|view|see|read|display)\b/i;

export function isStrictConfirmMessage(text: string): boolean {
  return STRICT_CONFIRM.test(text.trim());
}

export function isRejectMessage(text: string): boolean {
  return /^(no|cancel|reject|don't|stop|nevermind|never mind)\b/i.test(text.trim());
}

/** Bare "yes" / "confirm" — only treat as confirm when caller checks pending action. */
export function isConfirmMessage(text: string): boolean {
  const trimmed = text.trim();
  if (isStrictConfirmMessage(trimmed)) return true;
  if (isAffirmativeWithOpenIntent(trimmed)) return false;
  return /^(yes|confirm|go ahead|send it|proceed|approved?|do it)\b/i.test(trimmed);
}

/** "yes pls open", "yes open news", "ok show more" — navigate/continue, not generic confirm. */
export function isAffirmativeWithOpenIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!AFFIRMATIVE_PREFIX.test(trimmed)) return false;
  if (/\b(remove|delete|cancel|clear|wipe|send|schedule)\b/i.test(trimmed)) return false;
  if (
    /\b(yes|yeah|yep|sure|ok|okay|alright|please|pls)\b[\s\S]{0,24}\b(all|every)\b[\s\S]{0,24}\b(meeting|calendar|event)/i.test(
      trimmed
    )
  ) {
    return false;
  }
  return (
    OPEN_VERBS.test(trimmed) ||
    /\b(more|details|full|news|market)\b/i.test(trimmed)
  );
}

export function isAffirmativeContinue(text: string): boolean {
  const trimmed = text.trim();
  return isStrictConfirmMessage(trimmed) || isAffirmativeWithOpenIntent(trimmed);
}
