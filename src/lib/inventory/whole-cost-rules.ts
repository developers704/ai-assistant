/**
 * Whole Cost (CP) rules — single source of truth for:
 * - Onhand / price calculator (base = Tag Price)
 * - Sales report fallback (base = Sales Amount / grossSales)
 *
 * Priority = first match top → bottom (sheet order).
 * If inventory Whole Cost is already filled, callers must use that and skip this.
 */

export type WholeCostRuleFields = {
  department?: string | null;
  design?: string | null;
  class?: string | null;
  subClass?: string | null;
};

export type WholeCostRuleHit = {
  cost: number;
  ruleName: string;
};

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
]);

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
    ruleName: "Rado",
    calc: (b) => b / 1.82 + 20,
    matchDept: (d, c) => d === "RADO" || c === "RADO",
  },
  {
    ruleName: "Cartier",
    calc: (b) => b / 4,
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

/**
 * Apply first matching Whole Cost rule to `basePrice`
 * (Tag Price for inventory, Sales Amount for sales fallback).
 */
export function resolveWholeCostFromRules(
  fields: WholeCostRuleFields,
  basePrice: number
): WholeCostRuleHit | null {
  const base = Number(basePrice);
  if (!Number.isFinite(base) || base <= 0) return null;

  const department = norm(fields.department);
  const design = norm(fields.design);
  const productClass = norm(fields.class);
  const subClass = norm(fields.subClass);
  const deptCompact = compact(department);
  const designCompact = compact(design);

  // 1. Gold UV — Class UV + Design GOLD JEWL/GOLD JEWEL
  if (
    productClass === "UV" &&
    (design === "GOLD JEWL" || design === "GOLD JEWEL" || designCompact === "GOLDJEWL" || designCompact === "GOLDJEWEL")
  ) {
    return finish(base / 1.3, "Gold UV");
  }

  // 2–9. Design rules
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
  if (design === "AANIKA.V" || design === "AANIKA V" || designCompact === "AANIKAV") {
    return finish(base / 8.8, "Aanika V");
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

  // 10. Sub-Class BIRTHSTONE
  if (subClass === "BIRTHSTONE" || compact(subClass) === "BIRTHSTONE") {
    return finish(base / 8.8, "Birthstone Jewelry by subclass");
  }

  // 11. Gold by design
  if (GOLD_JEWL_DESIGNS.has(design) || designCompact === "GOLDJEWL" || designCompact === "GOLDJEWEL") {
    return finish(base / 4, "Gold by design");
  }

  // 12. Gold by department (sheet list + GOLF PNDTS typo)
  if (GOLD_DEPARTMENTS.has(department)) {
    return finish(base / 4, "Gold by department");
  }

  // 13. Tungsten — TUNGS BAND / contains TUNG
  if (department === "TUNGS BAND" || deptCompact.includes("TUNG")) {
    return finish(base * 0.06, "Tungsten");
  }

  // 14. Triton
  if (department === "TRITON" || deptCompact === "TRITON") {
    return finish(base / 4, "Triton");
  }

  // 15. Diamond departments / loose stone
  if (DIAMOND_DEPARTMENTS.has(department)) {
    return finish(base / 8.8, "Diamond departments / loose stone");
  }

  // 16+. Watch brands by Department (POS spellings)
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
