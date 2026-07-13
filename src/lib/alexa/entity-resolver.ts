import type { EntityCandidate } from "@/lib/alexa/types";
import {
  CONTACT_ALIASES,
  DESIGN_ALIASES,
  SECTION_ALIASES,
  STORE_ALIASES,
} from "@/lib/alexa/entity-dictionaries";

function scoreAlias(raw: string, map: Record<string, string>, type: string): EntityCandidate | null {
  const key = raw.toLowerCase().trim();
  if (!key) return null;
  if (map[key]) {
    return { type, rawValue: raw, resolvedValue: map[key], confidence: 0.96 };
  }
  // fuzzy contains
  for (const [alias, resolved] of Object.entries(map)) {
    if (key.includes(alias) || alias.includes(key)) {
      const confidence = key === alias ? 0.95 : 0.82;
      return { type, rawValue: raw, resolvedValue: resolved, confidence, alternatives: [resolved] };
    }
  }
  return null;
}

export function resolveEntitiesFromText(message: string): EntityCandidate[] {
  const found: EntityCandidate[] = [];
  const lower = message.toLowerCase();

  for (const [alias, resolved] of Object.entries(DESIGN_ALIASES)) {
    if (new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i").test(lower)) {
      found.push({
        type: "design",
        rawValue: alias,
        resolvedValue: resolved,
        confidence: 0.94,
      });
    }
  }

  for (const [alias, resolved] of Object.entries(STORE_ALIASES)) {
    if (new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i").test(lower)) {
      found.push({
        type: "store",
        rawValue: alias,
        resolvedValue: resolved,
        confidence: 0.92,
      });
    }
  }

  for (const [alias, resolved] of Object.entries(CONTACT_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, "i").test(lower)) {
      found.push({
        type: "contact",
        rawValue: alias,
        resolvedValue: resolved,
        confidence: alias === "roz" ? 0.78 : 0.93,
      });
    }
  }

  for (const [alias, resolved] of Object.entries(SECTION_ALIASES)) {
    if (new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i").test(lower)) {
      found.push({
        type: "section",
        rawValue: alias,
        resolvedValue: resolved,
        confidence: 0.9,
      });
    }
  }

  return dedupe(found);
}

function dedupe(items: EntityCandidate[]): EntityCandidate[] {
  const seen = new Set<string>();
  const out: EntityCandidate[] = [];
  for (const item of items) {
    const k = `${item.type}:${item.resolvedValue ?? item.rawValue}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function shouldClarifyEntity(c: EntityCandidate, isWrite: boolean): boolean {
  if (c.confidence >= 0.9) return false;
  if (isWrite) return c.confidence < 0.9;
  return c.confidence < 0.7;
}

export function resolveSingleAlias(
  raw: string,
  type: "design" | "store" | "contact" | "section"
): EntityCandidate | null {
  if (type === "design") return scoreAlias(raw, DESIGN_ALIASES, type);
  if (type === "store") return scoreAlias(raw, STORE_ALIASES, type);
  if (type === "contact") return scoreAlias(raw, CONTACT_ALIASES, type);
  return scoreAlias(raw, SECTION_ALIASES, type);
}
