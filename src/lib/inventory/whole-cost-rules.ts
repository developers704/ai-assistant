/**
 * Whole Cost (CP) rules — single source of truth for:
 * - Onhand / price calculator (base = Tag Price)
 * - Sales report fallback / all historical sales margins (base = Sales Amount)
 *
 * HARD RULES (owner — always):
 * 1) Fixed SKU list → fixed $ cost (everyone)
 * 1b) SKU divisor overrides (e.g. 240304 → base ÷ 8.8) — beats design/dept formulas
 * 1c) Priority collections (design and/or description; Eternal Vow also Class):
 *     Bella Ovani, Aanika V, Ovani, Quince, Eternal Vow, Benchmark → ÷ 2.25
 *     Novello → ÷ 8.8
 *     These beat department formulas (LADYS RING, GENTS RING, GOLD JEWL, diamond ÷8.8).
 * 1d) Department GENTS RING → base ÷ 8.8 (beats GOLD JEWL ÷4; same as ladies ring diamond)
 * 2) Gold jewelry (GOLD JEWL design or gold dept incl. GOLD CHAIN) + UV signal
 *    (description UV/ultimate value, Design UV, or Class UV) → base ÷ 1.3
 * 3) Diamond (diamond dept OR "diamond" in description) + UV / ultimate value in description
 *    → base ÷ 8.8 (fixed SKUs already handled above)
 * Then remaining sheet rules (LINKNLOCK, gold÷4, Triton ÷2.25, Tungsten = tag, watches, …).
 * Rolex and Cartier → base ÷ 2.10.
 */

export type WholeCostRuleFields = {
  department?: string | null;
  design?: string | null;
  class?: string | null;
  subClass?: string | null;
  description?: string | null;
  /** Item # / SKU — used for fixed-cost overrides */
  sku?: string | null;
};

export type WholeCostRuleHit = {
  cost: number;
  ruleName: string;
};

/**
 * Fixed Whole Cost by SKU (applies to everyone — overrides sheet formulas).
 * Match by leading digits so POS variants 231618S / 231611Y still hit.
 */
export const FIXED_WHOLE_COST_BY_SKU: Record<string, number> = {
  "231611": 350,
  "231614": 350,
  "231616": 499,
  "231618": 275,
  "231620": 400,
  "231622": 215,
  "231624": 675,
  "230768": 940,
  "232736": 150,
};

/**
 * SKU-only divisor overrides (base ÷ N) — wins over design/dept formulas
 * (e.g. GOLD JEWL ÷4). Match by leading Item # digits.
 */
export const SKU_DIVISOR_OVERRIDE: Record<string, number> = {
  "240304": 8.8, // NUGGET.CROSS mens ring — owner: ÷8.8 only for this SKU
};

/** Leading numeric Item # (231618S-10 → 231618). */
export function skuCostKey(sku: string | null | undefined): string {
  const raw = String(sku ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return "";
  return raw.match(/^(\d+)/)?.[1] ?? raw.split(/[-\s]/)[0] ?? "";
}

/** Fixed Whole Cost for SKU, or null. */
export function fixedWholeCostForSku(sku: string | null | undefined): number | null {
  const key = skuCostKey(sku);
  if (!key) return null;
  const n = FIXED_WHOLE_COST_BY_SKU[key];
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

/** SKU divisor override (e.g. 8.8), or null. */
export function skuDivisorOverride(sku: string | null | undefined): number | null {
  const key = skuCostKey(sku);
  if (!key) return null;
  const n = SKU_DIVISOR_OVERRIDE[key];
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Compact token for fuzzy POS match (drop spaces / punctuation). */
function compact(value: string): string {
  return norm(value).replace(/[^A-Z0-9]/g, "");
}

const GOLD_JEWL_DESIGNS = new Set(["GOLD JEWL", "GOLD JEWEL", "GOLD BANDS"]);

const GOLD_DEPARTMENTS = new Set([
  "GOLD BANDS",
  "GOLD ID",
  "GOLD HOOPS",
  "GOLD PNDTS",
  "GOLF PNDTS", // POS typo
  "GOLD RINGS",
  "GOLD CHAIN",
]);

/** Design GOLD JEWL / GOLD JEWEL (owner hard rule for ÷1.3 with UV). */
function isGoldJewlDesign(design: string, designCompact: string): boolean {
  return (
    design === "GOLD JEWL" ||
    design === "GOLD JEWEL" ||
    designCompact === "GOLDJEWL" ||
    designCompact === "GOLDJEWEL"
  );
}

/** Class UV or description contains UV / ultimate value (any casing). */
export function hasUvOrUltimateValueText(
  productClass?: string | null,
  description?: string | null
): boolean {
  if (norm(productClass) === "UV") return true;
  const desc = String(description ?? "");
  return /\buv\b/i.test(desc) || /ultimate\s*value/i.test(desc);
}

function isWatchDepartment(department: string, deptCompact: string): boolean {
  return WATCH_DEPT_RULES.some((rule) => rule.matchDept(department, deptCompact));
}

/** Gold dept (GOLD CHAIN, GOLD ID, …) or GOLD JEWL / GOLD BANDS design. */
export function isGoldJewelryCategory(
  department: string,
  design: string,
  designCompact: string
): boolean {
  const deptCompact = compact(department);
  if (isWatchDepartment(department, deptCompact)) return false;
  return (
    GOLD_DEPARTMENTS.has(department) ||
    GOLD_JEWL_DESIGNS.has(design) ||
    isGoldJewlDesign(design, designCompact)
  );
}

/** UV gold signal: Design UV, Class UV, or UV / ultimate value in description. */
export function isUvGoldSignal(
  design: string,
  designCompact: string,
  productClass: string,
  description?: string | null
): boolean {
  if (design === "UV" || designCompact === "UV") return true;
  return hasUvOrUltimateValueText(productClass, description);
}

/** UV gold jewelry → Tag / Sales Amount ÷ 1.3 (not plain gold ÷ 4). */
export function isUvGoldJewelry(fields: WholeCostRuleFields): boolean {
  const department = norm(fields.department);
  const design = norm(fields.design);
  const designCompact = compact(design);
  return (
    isGoldJewelryCategory(department, design, designCompact) &&
    isUvGoldSignal(design, designCompact, norm(fields.class), fields.description)
  );
}

function isDiamondItem(department: string, description?: string | null): boolean {
  if (DIAMOND_DEPARTMENTS.has(department)) return true;
  return /diamond/i.test(String(description ?? ""));
}

const DIAMOND_DEPARTMENTS = new Set([
  "BANGLE",
  "EARRINGS",
  "FANCY NECK",
  "GENTS RING",
  "LADYS RING",
  "LADYS BRCL",
  "MENS BRCLT",
  "PENDANT",
  "TRIO",
]);

type WatchRule = {
  ruleName: string;
  /** Return cost from base (tag / sales amount). */
  calc: (base: number) => number;
  /** True when POS department matches this brand. */
  matchDept: (dept: string, deptCompact: string) => boolean;
};

/**
 * Watch brands live in Department (POS): RADO, CARTIER, MICHAEL KO, MONT WATCH, …
 */
const WATCH_DEPT_RULES: WatchRule[] = [
  {
    ruleName: "Rolex",
    calc: (b) => b / 2.1,
    matchDept: (d, c) => d === "ROLEX" || c === "ROLEX",
  },
  {
    ruleName: "Rado",
    calc: (b) => b / 1.82 + 20,
    matchDept: (d, c) => d === "RADO" || c === "RADO",
  },
  {
    ruleName: "Cartier",
    calc: (b) => b / 2.1,
    matchDept: (d, c) => d === "CARTIER" || c === "CARTIER",
  },
  {
    ruleName: "Bright Link",
    calc: (b) => b / 4,
    matchDept: (d, c) =>
      d === "BRIGHT LINK" || c === "BRIGHTLINK" || (c.includes("BRIGHT") && c.includes("LINK")),
  },
  {
    ruleName: "Movado",
    calc: (b) => b / 1.82 + 20,
    matchDept: (d, c) => d === "MOVADO" || c === "MOVADO",
  },
  {
    ruleName: "Mont Blank",
    // POS: MONT WATCH, MONT ACCES, MONTBLANC…
    calc: (b) => b / 1.82 + 20,
    matchDept: (d, c) =>
      d.startsWith("MONT ") ||
      c.startsWith("MONT") ||
      c.includes("MONTBLANC") ||
      c.includes("MONTBLANK"),
  },
  {
    ruleName: "Longines",
    calc: (b) => b * 0.58 + 25,
    matchDept: (d, c) => d === "LONGINES" || c === "LONGINES",
  },
  {
    ruleName: "Bulova",
    calc: (b) => b * 0.48 + 15,
    matchDept: (d, c) => d === "BULOVA" || c === "BULOVA",
  },
  {
    ruleName: "Michael Kors",
    calc: (b) => b / 2 + 10,
    matchDept: (d, c) =>
      d === "MICHAEL KO" ||
      d === "MICHAEL KORS" ||
      c === "MICHAELKO" ||
      c === "MICHAELKORS" ||
      c.startsWith("MICHAELKO"),
  },
  {
    ruleName: "G shock",
    calc: (b) => b * 0.4825 + 15,
    matchDept: (d, c) => d === "G-SHOCK" || d === "G SHOCK" || c === "GSHOCK",
  },
  {
    ruleName: "Tissot",
    calc: (b) => b / 2 + 10,
    matchDept: (d, c) => d === "TISSOT" || c === "TISSOT",
  },
];

function finish(cost: number, ruleName: string): WholeCostRuleHit | null {
  if (!Number.isFinite(cost) || cost <= 0) return null;
  return { cost, ruleName };
}

/** Bella Ovani before generic Ovani (BELLA OVAN is the POS short design). */
function mentionsBellaOvani(value: string): boolean {
  const c = compact(value);
  return c.includes("BELLAOVANI") || c.includes("BELLAOVAN");
}

/** Aanika V / Anika V in one column (AANIKA.V, AANIKA V, ANIKA V). */
function mentionsAanikaV(value: string): boolean {
  const c = compact(value);
  return c.includes("AANIKAV") || c.includes("ANIKAV");
}

/** Ovani, Ovani Gent, Ovanifusio — not a preceding letter (so NOVANI does not hit). */
function mentionsOvani(value: string): boolean {
  return /\bOVANI/.test(norm(value));
}

function mentionsNovello(value: string): boolean {
  const text = norm(value);
  return /\bNOVELLO/.test(text) || /\bNOVELO/.test(text);
}

function mentionsQuince(value: string): boolean {
  const text = norm(value);
  return /\bQUINCE\b/.test(text) || /\bQUIENCE\b/.test(text);
}

/** Eternal Vow, Eternal-vow, Etternal / Etrenal typos. POS stores this in Class. */
function mentionsEternalVow(value: string): boolean {
  const c = compact(value);
  return c.includes("ETERNALVOW") || c.includes("ETRENALVOW") || c.includes("ETTERNALVOW");
}

function mentionsBenchmark(description: string | null | undefined): boolean {
  return /\bBENCHMARK\b/i.test(String(description ?? ""));
}

/**
 * Collection brands that beat department divisors (ladies ring, gents ring, gold ÷4).
 * Bella Ovani is checked before Ovani so the rule name stays Bella.
 */
function priorityCollectionCost(
  fields: WholeCostRuleFields,
  base: number
): WholeCostRuleHit | null {
  const design = norm(fields.design);
  const description = norm(fields.description);
  const productClass = norm(fields.class);
  const subClass = norm(fields.subClass);

  if (mentionsBellaOvani(design) || mentionsBellaOvani(description)) {
    return finish(base / 2.25, "Bella Ovani");
  }
  if (mentionsAanikaV(design) || mentionsAanikaV(description)) {
    return finish(base / 2.25, "Aanika V");
  }
  if (mentionsOvani(design) || mentionsOvani(description)) {
    return finish(base / 2.25, "Ovani");
  }
  if (mentionsNovello(design) || mentionsNovello(description)) {
    return finish(base / 8.8, "Novello");
  }
  if (mentionsQuince(design) || mentionsQuince(description)) {
    return finish(base / 2.25, "Quince");
  }
  if (
    mentionsEternalVow(design) ||
    mentionsEternalVow(description) ||
    mentionsEternalVow(productClass) ||
    mentionsEternalVow(subClass)
  ) {
    return finish(base / 2.25, "Eternal Vow");
  }
  if (mentionsBenchmark(fields.description)) {
    return finish(base / 2.25, "Benchmark");
  }
  return null;
}

/**
 * Apply first matching Whole Cost rule to `basePrice`
 * (Tag Price for inventory, Sales Amount for sales fallback).
 * Fixed SKU costs win over department/design formulas.
 */
export function resolveWholeCostFromRules(
  fields: WholeCostRuleFields,
  basePrice: number
): WholeCostRuleHit | null {
  const fixed = fixedWholeCostForSku(fields.sku);
  if (fixed != null) {
    return { cost: fixed, ruleName: `Fixed SKU ${skuCostKey(fields.sku)}` };
  }

  const base = Number(basePrice);
  if (!Number.isFinite(base) || base <= 0) return null;

  const skuDiv = skuDivisorOverride(fields.sku);
  if (skuDiv != null) {
    return finish(base / skuDiv, `SKU ÷${skuDiv} ${skuCostKey(fields.sku)}`);
  }

  const department = norm(fields.department);
  const design = norm(fields.design);
  const productClass = norm(fields.class);
  const subClass = norm(fields.subClass);
  const deptCompact = compact(department);
  const designCompact = compact(design);

  const priority = priorityCollectionCost(fields, base);
  if (priority) return priority;

  // GENTS RING — diamond ÷8.8 unless a priority collection already matched
  if (department === "GENTS RING" || deptCompact === "GENTSRING") {
    return finish(base / 8.8, "Gents ring department");
  }

  // 1. UV gold (GOLD JEWL / GOLD CHAIN + Design UV or Class UV or description UV) → ÷ 1.3
  if (
    isUvGoldJewelry({
      department,
      design,
      class: productClass,
      description: fields.description,
    })
  ) {
    return finish(base / 1.3, "Gold JEWL + UV / Ultimate Value");
  }

  // 2. Diamond + UV / ultimate value in description → ÷ 8.8
  //    (fixed special SKUs already returned above)
  if (
    isDiamondItem(department, fields.description) &&
    hasUvOrUltimateValueText(productClass, fields.description)
  ) {
    return finish(base / 8.8, "Diamond + UV / Ultimate Value");
  }

  // 3–10. Design rules
  if (design === "LINKNLOCK" || designCompact === "LINKNLOCK") {
    return finish(base / 2.75, "Linknlock");
  }
  if (design === "LOVE" || designCompact === "LOVE") {
    return finish(base / 2.75, "Love Spell");
  }
  if (design === "OROVENTI" || designCompact === "OROVENTI") {
    return finish(base / 2.5, "Oroventi");
  }
  if (design === "CLOVER" || designCompact === "CLOVER") {
    return finish(base / 4, "Clover gold");
  }
  if (design === "PLAT JEWL" || designCompact === "PLATJEWL") {
    return finish(base / 4, "Platinum Jewelry");
  }
  if (design === "SILVER JEW" || designCompact === "SILVERJEW") {
    return finish(base / 4, "Silver Jewelry");
  }
  if (design === "B STONE" || designCompact === "BSTONE") {
    return finish(base / 8.8, "Birthstone Jewelry by design");
  }

  // 11. Sub-Class BIRTHSTONE
  if (subClass === "BIRTHSTONE" || compact(subClass) === "BIRTHSTONE") {
    return finish(base / 8.8, "Birthstone Jewelry by subclass");
  }

  // 12. Gold by design (no UV — plain GOLD JEWL / GOLD BANDS)
  if (GOLD_JEWL_DESIGNS.has(design) || designCompact === "GOLDJEWL" || designCompact === "GOLDJEWEL") {
    return finish(base / 4, "Gold by design");
  }

  // 13. Gold by department
  if (GOLD_DEPARTMENTS.has(department)) {
    return finish(base / 4, "Gold by department");
  }

  // 14. Tungsten — cost equals the tag / sales-amount base
  if (
    department === "TUNGS BAND" ||
    deptCompact.includes("TUNG") ||
    designCompact.includes("TUNGSTEN") ||
    compact(String(fields.description ?? "")).includes("TUNGSTEN")
  ) {
    return finish(base, "Tungsten");
  }

  // 15. Triton
  if (department === "TRITON" || deptCompact === "TRITON" || designCompact === "TRITON") {
    return finish(base / 2.25, "Triton");
  }

  // 16. Diamond departments (no UV in description — still ÷ 8.8 per sheet)
  if (DIAMOND_DEPARTMENTS.has(department)) {
    return finish(base / 8.8, "Diamond departments / loose stone");
  }

  // 17+. Watch brands by Department
  for (const rule of WATCH_DEPT_RULES) {
    if (rule.matchDept(department, deptCompact)) {
      return finish(rule.calc(base), rule.ruleName);
    }
  }

  return null;
}

/** Numeric cost only (null when no rule matches). */
export function wholeCostFromRules(
  fields: WholeCostRuleFields,
  basePrice: number
): number | null {
  return resolveWholeCostFromRules(fields, basePrice)?.cost ?? null;
}
