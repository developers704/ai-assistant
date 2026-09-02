/** Keep only the writer's new text — drop Gmail/Outlook quoted originals. */
export function stripQuotedReply(raw: string): string {
  if (!raw?.trim()) return "";
  let text = raw.replace(/\r\n/g, "\n").replace(/\u202f/g, " ").trim();

  text = text.replace(/\nOn .+wrote:[\s\S]*$/i, "");
  text = text.replace(/\n-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i, "");
  text = text.replace(/\nFrom:\s.+\nSent:\s[\s\S]*$/i, "");

  const lines = text.split("\n");
  while (lines.length && /^\s*>/.test(lines[lines.length - 1]!)) {
    lines.pop();
  }
  while (lines.length && !lines[lines.length - 1]!.trim()) {
    lines.pop();
  }
  // Drop a trailing empty quote header if the On...wrote line had no leading newline
  const joined = lines.join("\n").replace(/^On .+wrote:\s*$/im, "").trim();
  return joined;
}

export function replySubjectForThread(subject: string): string {
  const s = subject.trim();
  if (!s) return "Re:";
  return /^\s*re\s*:/i.test(s) ? s : `Re: ${s}`;
}
