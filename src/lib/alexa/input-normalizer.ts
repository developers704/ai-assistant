import type { AlexaChannel } from "@/lib/alexa/types";

const FILLERS =
  /\b(um+|uh+|erm+|like|please|alexa|hey alexa|ok alexa|can you|could you|would you|just)\b/gi;

const ROMAN_URDU: Array<[RegExp, string]> = [
  [/\bdikha\s*do\b/gi, "show"],
  [/\bdikhao\b/gi, "show"],
  [/\bbolo\b/gi, "tell"],
  [/\bbatao\b/gi, "tell"],
  [/\bkholo\b/gi, "open"],
  [/\bkal\b/gi, "yesterday"],
  [/\baaj\b/gi, "today"],
  [/\bdo\s*baje\b/gi, "2 PM"],
  [/\bteen\s*baje\b/gi, "3 PM"],
  [/\blaga\s*do\b/gi, "schedule"],
  [/\bmeeting\s*laga\b/gi, "schedule meeting"],
  [/\bko\b/gi, " "],
  [/\bwali\b/gi, " "],
  [/\bki\s+sales\b/gi, " sales"],
  [/\bstore\s*wise\b/gi, "by store"],
  [/\bdepartment\s*wise\b/gi, "by department"],
  [/\bdashboard\s+par\b/gi, "open dashboard"],
  [/\bscreen\s+kholo\b/gi, "open"],
];

const TRANSCRIPTION: Array<[RegExp, string]> = [
  [/\bnovelo\b/gi, "NOVELLO"],
  [/\bnovello\b/gi, "NOVELLO"],
  [/\bovanny\b/gi, "OVANI"],
  [/\bowani\b/gi, "OVANI"],
  [/\bovani\b/gi, "OVANI"],
  [/\bgray\s+mall\b/gi, "Great Mall"],
  [/\bgreat\s+mall\b/gi, "Great Mall"],
  [/\bbay\s*brook\b/gi, "Baybrook Mall"],
  [/\broz\b/gi, "Ross"],
  [/\bcalender\b/gi, "calendar"],
];

export function normalizeAlexaInput(input: {
  message: string;
  channel: AlexaChannel;
  locale?: string;
}): {
  raw: string;
  normalized: string;
  detectedLanguage?: string;
} {
  const raw = input.message.trim();
  let normalized = raw;

  for (const [re, rep] of ROMAN_URDU) {
    normalized = normalized.replace(re, rep);
  }
  for (const [re, rep] of TRANSCRIPTION) {
    normalized = normalized.replace(re, rep);
  }
  normalized = normalized.replace(FILLERS, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Light structural rewrites for common spoken patterns
  if (/\bschedule\b/i.test(normalized) && /\bmeeting\b/i.test(normalized) && /\btomorrow\b/i.test(normalized)) {
    if (!/\bat\b|\d\s*(am|pm)/i.test(normalized)) {
      // leave time missing — clarification later
    }
  }

  const hasUrduHint = ROMAN_URDU.some(([re]) => re.test(raw));
  return {
    raw,
    normalized: normalized || raw,
    detectedLanguage: hasUrduHint ? "roman-urdu+en" : "en",
  };
}
