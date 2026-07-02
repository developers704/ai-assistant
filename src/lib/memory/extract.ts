import { v4 as uuidv4 } from "uuid";
import { appendFact } from "./store";

const DURABLE_PATTERNS = [
  /pasand hai|prefer|always|never|priority|chahiye|daily briefing|office nahi/i,
  /short emails|formal tone|roman urdu/i,
];

const TEMPORARY_PATTERNS = [
  /aaj|today|abhi|gold price|open .+ page|kitne\b|what time/i,
];

/** Extract durable facts from user text — no LLM cost. */
export function extractFactsFromMessage(message: string): void {
  const trimmed = message.trim();
  if (trimmed.length < 12) return;
  if (TEMPORARY_PATTERNS.some((p) => p.test(trimmed))) return;
  if (!DURABLE_PATTERNS.some((p) => p.test(trimmed))) return;

  appendFact({
    id: uuidv4(),
    text: trimmed.slice(0, 280),
    category: /store|brand|sales|margin|vendor/i.test(trimmed) ? "business" : "preference",
    createdAt: new Date().toISOString(),
  });
}
