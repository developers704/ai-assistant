import type { VendorPosRow } from "@/lib/reports/types";
import type { EntityIndex, SalesClarification, SalesQueryFilters } from "./sales-types";
import { emptyFilters } from "./sales-schema";

/** Build entity indexes from the loaded report (no hardcoded catalogs). */
export function buildEntityIndex(rows: VendorPosRow[]): EntityIndex {
  const uniq = (vals: string[]) =>
    [...new Set(vals.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );

  return {
    stores: uniq(rows.map((r) => r.storeName)),
    departments: uniq(rows.map((r) => r.department)),
    designs: uniq(rows.map((r) => r.design)),
    vendors: uniq(rows.map((r) => r.vendor)),
    classes: uniq(rows.map((r) => r.productClass)),
    skus: uniq(rows.map((r) => r.sku || r.itemNumber)),
    vendorModels: uniq(rows.map((r) => r.vendorModel)),
    products: uniq(rows.map((r) => r.description)),
    dates: uniq(rows.map((r) => r.date).filter(Boolean)),
  };
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Common spoken aliases → canonical-ish tokens before fuzzy match. */
const ALIAS_HINTS: Array<{ pattern: RegExp; preferIncludes: string[] }> = [
  { pattern: /\bnovell?o(?:\s+collection)?\b/i, preferIncludes: ["novello"] },
  { pattern: /\bovann?i(?:\s+brand)?\b/i, preferIncludes: ["ovani"] },
  {
    pattern: /\b(?:lady'?s?|ladies|lads|women'?s?)\s+rings?\b/i,
    preferIncludes: ["ladys ring", "lady ring"],
  },
  {
    pattern: /\b(?:gent'?s?|gents|men'?s?)\s+rings?\b/i,
    preferIncludes: ["gents ring", "gent ring"],
  },
  { pattern: /\bgold\s+chains?\b/i, preferIncludes: ["gold chain"] },
  { pattern: /\b14\s*(?:k|kt|karat|carat)\b/i, preferIncludes: ["14kt", "14k"] },
  { pattern: /\b10\s*(?:k|kt|karat|carat)\b/i, preferIncludes: ["10kt", "10k"] },
  { pattern: /\b18\s*(?:k|kt|karat|carat)\b/i, preferIncludes: ["18kt", "18k"] },
  { pattern: /\b(?:mens|men|male)\b(?!\s+ring)/i, preferIncludes: ["mens"] },
  { pattern: /\b(?:women|womens|female)\b(?!\s+ring)/i, preferIncludes: ["women"] },
  { pattern: /\bgreat\s*mall\b/i, preferIncludes: ["great mall", "dbc-gm", "gm"] },
  { pattern: /\bvalley\s*fair\b/i, preferIncludes: ["valley fair", "val"] },
  { pattern: /\b(?:vj[-\s]?)?mod(?:esto)?\b/i, preferIncludes: ["vj-mod", "mod"] },
  { pattern: /\bcull?ver\b/i, preferIncludes: ["culver"] },
  { pattern: /\brolex\b/i, preferIncludes: ["rolex"] },
  { pattern: /\bmhvr\b/i, preferIncludes: ["mhvr"] },
];

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cur =
        a[i] === b[j] ? row[j] : 1 + Math.min(row[j], prev, row[j + 1]);
      row[j] = prev;
      prev = cur;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function scoreMatch(query: string, candidate: string): number {
  const q = normalizeKey(query);
  const c = normalizeKey(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.startsWith(q) || q.startsWith(c)) return 92;
  if (c.includes(q) || q.includes(c)) return 85;
  const dist = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length);
  const sim = 1 - dist / maxLen;
  if (sim >= 0.78) return Math.round(70 + sim * 25);
  // token overlap
  const qt = new Set(q.split(" "));
  const ct = new Set(c.split(" "));
  let overlap = 0;
  for (const t of qt) if (ct.has(t)) overlap++;
  if (overlap && overlap === qt.size) return 80;
  if (overlap >= 1 && qt.size <= 2) return 65 + overlap * 5;
  return 0;
}

export type MatchResult =
  | { status: "exact" | "fuzzy"; value: string; score: number }
  | { status: "ambiguous"; options: string[]; message: string }
  | { status: "none"; message: string };

export function matchEntity(
  raw: string,
  known: string[],
  fieldLabel: string
): MatchResult {
  const q = raw.trim();
  if (!q) return { status: "none", message: `Empty ${fieldLabel}.` };

  // Alias expansion: try preferred substrings against known list
  for (const hint of ALIAS_HINTS) {
    if (!hint.pattern.test(q)) continue;
    const hits = known.filter((k) => {
      const nk = normalizeKey(k);
      return hint.preferIncludes.some((p) => nk.includes(normalizeKey(p)));
    });
    if (hits.length === 1) return { status: "exact", value: hits[0], score: 99 };
    if (hits.length > 1) {
      // Prefer shortest / most specific
      const scored = hits
        .map((h) => ({ h, s: scoreMatch(hint.preferIncludes[0], h) }))
        .sort((a, b) => b.s - a.s);
      if (scored[0].s >= 85 && scored[0].s - (scored[1]?.s ?? 0) >= 5) {
        return { status: "fuzzy", value: scored[0].h, score: scored[0].s };
      }
      return {
        status: "ambiguous",
        options: hits.slice(0, 5),
        message: `I found multiple matches for "${q}". Which ${fieldLabel} do you mean?`,
      };
    }
  }

  const scored = known
    .map((k) => ({ k, s: scoreMatch(q, k) }))
    .filter((x) => x.s >= (/store/i.test(fieldLabel) ? 80 : 65))
    .sort((a, b) => b.s - a.s);

  if (!scored.length || /\bunknown\b/i.test(q)) {
    return {
      status: "none",
      message: `I could not find "${q}" in ${fieldLabel}.`,
    };
  }

  // Stores need a stronger fuzzy match so "Unknown Mall" never becomes "Great Mall"
  const fuzzyFloor = /store/i.test(fieldLabel) ? 88 : 65;
  if (scored[0].s < fuzzyFloor && scored[0].s < 95) {
    const suggestions = scored.slice(0, 3).map((x) => x.k);
    return {
      status: "none",
      message: suggestions.length
        ? `I could not find "${q}" in ${fieldLabel}. Did you mean ${suggestions.join(", ")}?`
        : `I could not find "${q}" in ${fieldLabel}.`,
    };
  }

  if (scored.length === 1 || scored[0].s - scored[1].s >= 8) {
    return {
      status: scored[0].s >= 95 ? "exact" : "fuzzy",
      value: scored[0].k,
      score: scored[0].s,
    };
  }

  const top = scored.filter((x) => x.s >= scored[0].s - 5).map((x) => x.k);
  return {
    status: "ambiguous",
    options: top.slice(0, 5),
    message: `I found multiple matches for "${q}". Which ${fieldLabel} do you mean?`,
  };
}

export function matchMany(
  raws: string[] | undefined,
  known: string[],
  fieldLabel: string
): { values: string[]; clarification?: SalesClarification; warnings: string[] } {
  const values: string[] = [];
  const warnings: string[] = [];
  if (!raws?.length) return { values, warnings };

  for (const raw of raws) {
    const m = matchEntity(raw, known, fieldLabel);
    if (m.status === "exact" || m.status === "fuzzy") {
      values.push(m.value);
      if (m.status === "fuzzy") warnings.push(`Interpreted "${raw}" as ${m.value}.`);
    } else if (m.status === "ambiguous") {
      return {
        values,
        warnings,
        clarification: {
          field: fieldLabel as keyof SalesQueryFilters,
          message: m.message,
          options: m.options,
        },
      };
    } else {
      // Suggest closest if any weak matches
      const noneMessage = m.status === "none" ? m.message : `I could not find "${raw}".`;
      const suggestions = known
        .map((k) => ({ k, s: scoreMatch(raw, k) }))
        .filter((x) => x.s >= 50)
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
        .map((x) => x.k);
      return {
        values,
        warnings,
        clarification: {
          field: fieldLabel as keyof SalesQueryFilters,
          message: suggestions.length
            ? `I could not find "${raw}". Did you mean ${suggestions.join(", ")}?`
            : noneMessage,
          options: suggestions,
        },
      };
    }
  }
  return { values: [...new Set(values)], warnings };
}

export function normalizeFilterInputs(
  input: {
    stores?: string[];
    departments?: string[];
    designs?: string[];
    vendors?: string[];
    classes?: string[];
    products?: string[];
    skus?: string[];
    vendorModels?: string[];
  },
  index: EntityIndex
): {
  filters: SalesQueryFilters;
  clarification?: SalesClarification;
  warnings: string[];
} {
  const filters = emptyFilters();
  const warnings: string[] = [];

  const steps: Array<{
    raw?: string[];
    known: string[];
    label: string;
    key: keyof SalesQueryFilters;
  }> = [
    { raw: input.stores, known: index.stores, label: "store", key: "stores" },
    { raw: input.departments, known: index.departments, label: "department", key: "departments" },
    { raw: input.designs, known: index.designs, label: "design", key: "designs" },
    { raw: input.vendors, known: index.vendors, label: "vendor", key: "vendors" },
    { raw: input.classes, known: index.classes, label: "class", key: "classes" },
    { raw: input.skus, known: index.skus, label: "sku", key: "skus" },
    { raw: input.vendorModels, known: index.vendorModels, label: "vendor model", key: "vendorModels" },
    { raw: input.products, known: index.products, label: "product", key: "products" },
  ];

  for (const step of steps) {
    const res = matchMany(step.raw, step.known, step.label);
    warnings.push(...res.warnings);
    if (res.clarification) {
      return { filters, clarification: { ...res.clarification, field: step.key }, warnings };
    }
    filters[step.key] = res.values;
  }

  return { filters, warnings };
}

/** True if `needle` appears as a whole word/phrase in `haystack` (normalized). */
function containsPhrase(haystack: string, needle: string): boolean {
  const h = normalizeKey(haystack);
  const n = normalizeKey(needle);
  if (!n) return false;
  if (n.length <= 3) {
    // Short codes (EA, GM, KMA) — require token equality, never substring
    return h.split(" ").includes(n) || h.split(" ").includes(n.replace(/-/g, ""));
  }
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(h);
}

/**
 * Extract likely entity mentions from free text using the report index.
 * Uses word-boundary matching so short codes like "EA" / "GMS" do not
 * falsely match inside "Great Mall" / "sales".
 */
export function extractEntitiesFromMessage(
  message: string,
  index: EntityIndex
): Partial<{
  stores: string[];
  departments: string[];
  designs: string[];
  vendors: string[];
  classes: string[];
}> {
  const out: Partial<{
    stores: string[];
    departments: string[];
    designs: string[];
    vendors: string[];
    classes: string[];
  }> = {};

  type Hit = {
    key: "stores" | "departments" | "designs" | "vendors" | "classes";
    value: string;
    score: number;
  };
  const hits: Hit[] = [];

  const collect = (known: string[], key: Hit["key"]) => {
    const sorted = [...known].sort((a, b) => b.length - a.length);
    for (const name of sorted) {
      if (!containsPhrase(message, name)) continue;
      hits.push({ key, value: name, score: normalizeKey(name).length });
      break; // longest match only per field
    }
    if (!hits.some((h) => h.key === key)) {
      for (const hint of ALIAS_HINTS) {
        if (!hint.pattern.test(message)) continue;
        const matched = known.filter((k) =>
          hint.preferIncludes.some((p) => normalizeKey(k).includes(normalizeKey(p)))
        );
        if (!matched.length) continue;
        const best = matched
          .map((h) => ({ h, s: scoreMatch(hint.preferIncludes[0], h) }))
          .sort((a, b) => b.s - a.s)[0];
        if (best) {
          hits.push({ key, value: best.h, score: normalizeKey(best.h).length + 50 });
        }
        break;
      }
    }
  };

  collect(index.departments, "departments");
  collect(index.designs, "designs");
  collect(index.stores, "stores");
  collect(index.vendors, "vendors");
  collect(index.classes, "classes");

  // Fuzzy token pass for leftover store/vendor codes (e.g. "MOD", "MHVR")
  if (!hits.some((h) => h.key === "stores")) {
    const tokens = normalizeKey(message)
      .split(" ")
      .filter((t) => t.length >= 3 && !/^(show|sales?|sale|the|of|for|and|with|from|july|june|august|today|yesterday|store|stores)$/.test(t));
    for (const token of tokens) {
      const m = matchEntity(token, index.stores, "store");
      if ((m.status === "exact" || m.status === "fuzzy") && m.score >= 80) {
        hits.push({ key: "stores", value: m.value, score: m.score });
        break;
      }
    }
  }
  if (!hits.some((h) => h.key === "vendors")) {
    const tokens = normalizeKey(message)
      .split(" ")
      .filter((t) => t.length >= 3);
    for (const token of tokens) {
      const m = matchEntity(token, index.vendors, "vendor");
      if ((m.status === "exact" || m.status === "fuzzy") && m.score >= 90) {
        hits.push({ key: "vendors", value: m.value, score: m.score });
        break;
      }
    }
  }

  // Fuzzy department for typos like "lads ring"
  if (!hits.some((h) => h.key === "departments")) {
    const ringPhrase = message.match(/\b([a-z']+\s+rings?)\b/i);
    if (ringPhrase) {
      const m = matchEntity(ringPhrase[1], index.departments, "department");
      if ((m.status === "exact" || m.status === "fuzzy") && m.score >= 75) {
        hits.push({ key: "departments", value: m.value, score: m.score });
      }
    }
  }

  // Drop weaker/substring collisions (e.g. class "LADYS" when department "LADYS RING" matched)
  hits.sort((a, b) => b.score - a.score);
  const accepted: Hit[] = [];
  for (const hit of hits) {
    const nk = normalizeKey(hit.value);
    const dominated = accepted.some((a) => {
      const an = normalizeKey(a.value);
      return an !== nk && (an.includes(nk) || nk.includes(an));
    });
    if (dominated) continue;
    if (accepted.some((a) => a.key === hit.key)) continue;
    accepted.push(hit);
  }

  for (const hit of accepted) {
    out[hit.key] = [hit.value];
  }

  return out;
}

/** Parse "compare A and/aur/vs B" entity pair from a message. */
export function extractComparisonPair(message: string): { left: string; right: string } | null {
  const m = message.match(
    /\bcompare\s+(.+?)\s+(?:and|with|vs\.?|versus|aur)\s+(.+?)(?:\s+for\b|\s+on\b|[.?!]|$)/i
  );
  if (!m) return null;
  const clean = (s: string) =>
    s
      .replace(/\b(sales?|revenue|net|figures?|numbers?|ki|ke|ka)\b/gi, "")
      .replace(
        /\b(this|last|next|past)\s+(month|week|year|quarter)|year\s+to\s+date|ytd|today|yesterday|aaj|kal|parson\b/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();
  const left = clean(m[1]);
  const right = clean(m[2]);
  if (!left || !right) return null;
  return { left, right };
}
