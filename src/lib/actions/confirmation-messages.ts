/** Client-safe yes/no detection — kept separate from server confirmation staging. */

export function isConfirmMessage(text: string): boolean {
  return /^(yes|confirm|go ahead|send it|proceed|approved?|do it)\b/i.test(text.trim());
}

export function isRejectMessage(text: string): boolean {
  return /^(no|cancel|reject|don't|stop|nevermind|never mind)\b/i.test(text.trim());
}
