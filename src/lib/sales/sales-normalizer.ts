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

  // Prefer exact / case-insensitive equality before aliases (dashboard multi-select
  // sends canonical values like "10K" that must not collide with "10KT").
  const qKey = normalizeKey(q);
  const exactHit = known.find((k) => k === q) ?? known.find((k) => normalizeKey(k) === qKey);
  if (exactHit) {
    return { status: "exact", value: exactHit, score: 100 };
  }

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
  index: EntityIndex,
  opts?: { exact?: boolean }
): {
  filters: SalesQueryFilters;
  clarification?: SalesClarification;
  warnings: string[];
} {
  const filters = emptyFilters();
  const warnings: string[] = [];

  if (opts?.exact) {
    const applyExact = (raw: string[] | undefined, known: string[]) => {
      if (!raw?.length) return [] as string[];
      const knownByKey = new Map(
        known
          .map((k) => [normalizeKey(k), k] as const)
          .filter(([nk]) => Boolean(nk))
      );
      const out: string[] = [];
      for (const r of raw) {
        const t = r.trim();
        if (!t) continue;
        // Exact string match first (keeps placeholder classes like "-" / "--")
        const hit =
          known.find((k) => k === t) ??
          known.find((k) => k.toLowerCase() === t.toLowerCase()) ??
          knownByKey.get(normalizeKey(t));
        if (hit) out.push(hit);
      }
      return [...new Set(out)];
    };
    filters.stores = applyExact(input.stores, index.stores);
    filters.departments = applyExact(input.departments, index.departments);
    filters.designs = applyExact(input.designs, index.designs);
    filters.vendors = applyExact(input.vendors, index.vendors);
    filters.classes = applyExact(input.classes, index.classes);
    filters.skus = applyExact(input.skus, index.skus);
    filters.vendorModels = applyExact(input.vendorModels, index.vendorModels);
    filters.products = applyExact(input.products, index.products);
    return { filters, warnings };
  }

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

const STOP_TOKENS = new Set([
  "show",
  "open",
  "give",
  "get",
  "me",
  "please",
  "sales",
  "sale",
  "the",
  "of",
  "for",
  "and",
  "with",
  "from",
  "by",
  "on",
  "at",
  "in",
  "to",
  "a",
  "an",
  "my",
  "our",
  "this",
  "that",
  "july",
  "june",
  "august",
  "september",
  "october",
  "november",
  "december",
  "january",
  "february",
  "march",
  "april",
  "may",
  "today",
  "yesterday",
  "store",
  "stores",
  "department",
  "design",
  "class",
  "vendor",
  "dashboard",
  "report",
  "filter",
  "pull",
  "bring",
  "up",
  "display",
  "fetch",
]);

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

  type HitSource = "labeled" | "phrase" | "alias" | "fuzzy";
  type Hit = {
    key: "stores" | "departments" | "designs" | "vendors" | "classes";
    value: string;
    score: number;
    source: HitSource;
  };
  const hits: Hit[] = [];
  const isStrong = (s: HitSource) => s === "labeled" || s === "phrase" || s === "alias";

  // Explicit "X department / design / class / store / vendor"
  const labeled: Array<{
    re: RegExp;
    key: Hit["key"];
    known: string[];
    label: string;
    minScore: number;
  }> = [
    {
      re: /\b([A-Za-z0-9][A-Za-z0-9'\-\s]{0,40}?)\s+departments?\b/i,
      key: "departments",
      known: index.departments,
      label: "department",
      minScore: 70,
    },
    {
      re: /\bdepartments?\s+([A-Za-z0-9][A-Za-z0-9'\-\s]{0,40}?)\b/i,
      key: "departments",
      known: index.departments,
      label: "department",
      minScore: 70,
    },
    {
      re: /\b([A-Za-z0-9][A-Za-z0-9\-]{1,40})\s+designs?\b/i,
      key: "designs",
      known: index.designs,
      label: "design",
      minScore: 70,
    },
    {
      re: /\bdesigns?\s+([A-Za-z0-9][A-Za-z0-9\-]{1,40})\b/i,
      key: "designs",
      known: index.designs,
      label: "design",
      minScore: 70,
    },
    {
      re: /\b([A-Za-z0-9][A-Za-z0-9'\-\s]{0,30}?)\s+class(?:es)?\b/i,
      key: "classes",
      known: index.classes,
      label: "class",
      minScore: 70,
    },
    {
      re: /\bclass(?:es)?\s+([A-Za-z0-9][A-Za-z0-9'\-\s]{0,30}?)\b/i,
      key: "classes",
      known: index.classes,
      label: "class",
      minScore: 70,
    },
    {
      re: /\b(?:store|mall)\s+([A-Za-z0-9][A-Za-z0-9'\-\s]{1,40}?)\b/i,
      key: "stores",
      known: index.stores,
      label: "store",
      minScore: 80,
    },
  ];

  for (const rule of labeled) {
    const m = message.match(rule.re);
    if (!m?.[1]) continue;
    const raw = m[1].trim().replace(/\b(sales?|the|my)$/i, "").trim();
    if (!raw || STOP_TOKENS.has(normalizeKey(raw))) continue;
    const matched = matchEntity(raw, rule.known, rule.label);
    if (
      (matched.status === "exact" || matched.status === "fuzzy") &&
      matched.score >= rule.minScore
    ) {
      hits.push({
        key: rule.key,
        value: matched.value,
        score: matched.score + 40,
        source: "labeled",
      });
    } else if (rule.key === "designs" || rule.key === "departments" || rule.key === "classes") {
      // Keep explicit spoken name even if not in index yet (normalizeFilterInputs will clarify)
      hits.push({ key: rule.key, value: raw, score: 60, source: "labeled" });
    }
  }

  const collect = (known: string[], key: Hit["key"]) => {
    if (hits.some((h) => h.key === key)) return;
    const sorted = [...known].sort((a, b) => b.length - a.length);
    for (const name of sorted) {
      if (!containsPhrase(message, name)) continue;
      hits.push({
        key,
        value: name,
        score: normalizeKey(name).length + 20,
        source: "phrase",
      });
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
          hits.push({
            key,
            value: best.h,
            score: normalizeKey(best.h).length + 50,
            source: "alias",
          });
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

  const tokens = normalizeKey(message)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));

  const fuzzyPass = (
    key: Hit["key"],
    known: string[],
    label: string,
    minScore: number
  ) => {
    if (hits.some((h) => h.key === key) || !known.length) return;
    // Prefer multi-token phrases for departments like "gold chain"
    if (key === "departments" || key === "stores") {
      for (let n = Math.min(3, tokens.length); n >= 2; n--) {
        for (let i = 0; i <= tokens.length - n; i++) {
          const phrase = tokens.slice(i, i + n).join(" ");
          const m = matchEntity(phrase, known, label);
          if ((m.status === "exact" || m.status === "fuzzy") && m.score >= minScore) {
            hits.push({
              key,
              value: m.value,
              score: m.score,
              source: m.status === "exact" ? "phrase" : "fuzzy",
            });
            return;
          }
        }
      }
    }
    for (const token of tokens) {
      // Single short tokens like "ring" must not latch onto "SOL RING" / "GENTS RING"
      // when the user already named another dimension (handled later) — and alone they
      // need a near-exact score so generic words don't invent class/dept filters.
      const tokenFloor = token.length <= 4 ? Math.max(minScore, 92) : minScore;
      const m = matchEntity(token, known, label);
      if ((m.status === "exact" || m.status === "fuzzy") && m.score >= tokenFloor) {
        hits.push({ key, value: m.value, score: m.score, source: "fuzzy" });
        break;
      }
    }
  };

  fuzzyPass("stores", index.stores, "store", 80);
  fuzzyPass("designs", index.designs, "design", 78);
  fuzzyPass("departments", index.departments, "department", 75);
  fuzzyPass("vendors", index.vendors, "vendor", 90);
  fuzzyPass("classes", index.classes, "class", 78);

  // Fuzzy department for typos like "lads ring"
  if (!hits.some((h) => h.key === "departments")) {
    const ringPhrase = message.match(/\b([a-z']+\s+rings?)\b/i);
    if (ringPhrase) {
      const m = matchEntity(ringPhrase[1], index.departments, "department");
      if ((m.status === "exact" || m.status === "fuzzy") && m.score >= 75) {
        hits.push({
          key: "departments",
          value: m.value,
          score: m.score,
          source: m.status === "exact" ? "alias" : "fuzzy",
        });
      }
    }
  }

  // Drop weaker/substring collisions (e.g. class "LADYS" when department "LADYS RING" matched)
  hits.sort((a, b) => b.score - a.score);
  let accepted: Hit[] = [];
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

  // Only filter dimensions the user actually named. Strong hits (full phrase, alias,
  // or "X department/class/…") win; fuzzy leftovers on other dimensions are dropped.
  // e.g. "lady's ring sales" → department LADYS RING, NOT class SOL RING.
  const hasStrong = accepted.some((h) => isStrong(h.source));
  if (hasStrong) {
    accepted = accepted.filter((h) => isStrong(h.source));
  } else if (accepted.length > 1) {
    // Ambiguous fuzzy-only utterance → keep the single best dimension, leave others "all"
    accepted = [accepted[0]];
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
