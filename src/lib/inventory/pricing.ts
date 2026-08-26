import type {
  FinancingPlan,
  InventoryItem,
  ManagerTier,
  PaymentMethod,
  PricingResult,
  ProductCategory,
  TierPricing,
} from "./types";
import { fixedWholeCostForSku, skuCostKey, wholeCostFromRules } from "./whole-cost-rules";

const TIER_LABELS: Record<ManagerTier, string> = {
  dm: "District Manager (DM)",
  cm: "Corporate Manager (CM)",
  m: "Manager (M)",
};

const WATCH_DISCOUNTS: Record<string, Record<ManagerTier, number>> = {
  ROLEX: { dm: 62, cm: 60, m: 60 },
  CARTIER: { dm: 62, cm: 60, m: 60 },
  "BRIGHT LINK": { dm: 62, cm: 60, m: 60 },
  // Gucci DM-only raise; CM/M keep prior
  GUCCI: { dm: 30, cm: 15, m: 15 },
  RADO: { dm: 18, cm: 18, m: 18 },
  LONGINES: { dm: 15, cm: 15, m: 15 },
  MOVADO: { dm: 25, cm: 25, m: 25 },
  BULOVA: { dm: 25, cm: 25, m: 25 },
  "MICHAEL KO": { dm: 25, cm: 25, m: 25 },
  "G-SHOCK": { dm: 25, cm: 25, m: 25 },
  "MONT WATCH": { dm: 25, cm: 25, m: 25 },
  TISSOT: { dm: 25, cm: 25, m: 25 },
};

/** Whole gold — one tier for all gold (no under/over 20g split). */
const GOLD_DISCOUNTS: Record<ManagerTier, number> = {
  dm: 65,
  cm: 60,
  m: 55,
};

const BENCHMARK_FAMILY_DISCOUNTS: Record<ManagerTier, number> = {
  dm: 65,
  cm: 60,
  m: 55,
};

const DIAMOND_DISCOUNTS: Record<ManagerTier, number> = {
  dm: 82,
  cm: 80,
  m: 77.5,
};

/** UV / Ultimate Value + diamond uses DIAMOND_DISCOUNTS (except fixed zero-discount SKUs). */

const ZERO_DISCOUNTS: Record<ManagerTier, number> = { dm: 0, cm: 0, m: 0 };

const FIXED_DESIGN_DISCOUNTS: Record<ManagerTier, number> = {
  dm: 20,
  cm: 15,
  m: 10,
};

const FIXED_DESIGN_LABELS: Record<string, string> = {
  LINKNLOCK: "Link N Lock",
  LOVE: "Love",
  OROVENTI: "Oroventi",
};

/** Departments that count as Diamond category (plus "diamond" in description). */
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
  "SOL RING",
]);

/**
 * UV / Ultimate Value + diamond → 0% for these SKUs (same owner list as fixed Whole Cost).
 * Match by leading Item # digits (231618S / 231611Y → 231618 / 231611).
 */
const UV_DIAMOND_ZERO_SKUS = new Set([
  "231611",
  "231614",
  "231616",
  "231618",
  "231620",
  "231622",
  "231624",
  "230768",
  "232736",
]);

const GOLD_DEPTS = [
  "GOLD BANDS",
  "GOLD CHAIN",
  "GOLD HOOPS",
  "GOLD PNDTS",
  "GOLD ID",
  "GOLD RINGS",
];

function normalizeDept(dept: string): string {
  return dept.trim().toUpperCase();
}

function skuBase(sku: string): string {
  return sku.trim().toUpperCase().split(/[-\s]/)[0] ?? "";
}

function textBlob(item: InventoryItem): string {
  return [
    item.description,
    item.vendorModel,
    item.design,
    item.department,
    item.class,
    item.brand,
  ].join(" ");
}

function isGShock(item: InventoryItem): boolean {
  return /g[\s-]?shock/i.test(textBlob(item));
}

function isGold(item: InventoryItem): boolean {
  const dept = normalizeDept(item.department);
  if (GOLD_DEPTS.some((g) => dept.includes(g) || dept === g)) return true;
  const design = item.design.trim().toUpperCase();
  if (design === "GOLD JEWL" || design === "GOLD JEWEL" || design === "GOLD BANDS") {
    return true;
  }
  if (/GOLD/i.test(item.department)) return true;
  return false;
}

/** Gold weight still shown in UI; discounts no longer split on it. */
function getGoldAvgWeightGrams(item: InventoryItem): number {
  return item.avgWeight > 0 ? item.avgWeight : 0;
}

function getBenchmarkFamilyLabel(item: InventoryItem): string | null {
  const blob = textBlob(item);
  if (/benchmark/i.test(blob)) return "Benchmark";
  if (/triton/i.test(blob)) return "Triton";
  if (/tungsten/i.test(blob)) return "Tungsten";
  return null;
}

/** Map POS department → WATCH_DISCOUNTS key (Mont / Bright Link aliases). */
function resolveWatchDiscountKey(department: string): string | null {
  const d = normalizeDept(department);
  if (!d) return null;
  if (d in WATCH_DISCOUNTS) return d;
  if (d.startsWith("MICHAEL")) return "MICHAEL KO";
  const compact = d.replace(/[^A-Z0-9]/g, "");
  if (compact === "BRIGHTLINK" || (compact.includes("BRIGHT") && compact.includes("LINK"))) {
    return "BRIGHT LINK";
  }
  if (
    d.startsWith("MONT ") ||
    compact.startsWith("MONT") ||
    compact.includes("MONTBLANC") ||
    compact.includes("MONTBLANK")
  ) {
    return "MONT WATCH";
  }
  return null;
}

function isWatch(item: InventoryItem): boolean {
  if (isGShock(item)) return true;
  if (resolveWatchDiscountKey(item.department)) return true;
  return normalizeDept(item.department) === "WATCH";
}

function getWatchBrand(item: InventoryItem): string {
  if (isGShock(item)) return "G-SHOCK";
  return resolveWatchDiscountKey(item.department) ?? normalizeDept(item.department);
}

function getWatchDiscountPercents(
  watchBrand: string,
  item: InventoryItem
): Record<ManagerTier, number> {
  const key =
    (watchBrand in WATCH_DISCOUNTS ? watchBrand : null) ??
    resolveWatchDiscountKey(item.department);
  return (
    (key ? WATCH_DISCOUNTS[key] : undefined) ?? {
      dm: 0,
      cm: 0,
      m: 0,
    }
  );
}

function getFixedDesignCollection(item: InventoryItem): string | null {
  const design = item.design.trim().toUpperCase();
  return FIXED_DESIGN_LABELS[design] ?? null;
}

function isGemstone(item: InventoryItem): boolean {
  return /birthstone/i.test(item.subClass);
}

function hasUvOrUltimateValue(item: InventoryItem): boolean {
  if (/^UV$/i.test(item.class.trim())) return true;
  const desc = item.description ?? "";
  return /\buv\b/i.test(desc) || /ultimate\s*value/i.test(desc);
}

/**
 * DM Cost Price:
 * 1) Fixed SKU Whole Cost (owner list)
 * 2) Sheet formula on Tag Price when a rule matches
 * 3) Else inventory Whole Cost if filled
 * 4) Else Individual Cost Value
 */
export function getVisibleDmCostPrice(item: InventoryItem): number {
  const fixed = fixedWholeCostForSku(item.sku);
  if (fixed != null) return fixed;

  const tag = Number(item.tagPrice) || 0;
  if (tag > 0) {
    const fromRules = wholeCostFromRules(
      {
        department: item.department,
        design: item.design,
        class: item.class,
        subClass: item.subClass,
        description: item.description,
        sku: item.sku,
      },
      tag
    );
    if (fromRules != null && fromRules > 0) return fromRules;
  }

  const wholesale = Number(item.wholesaleCost) || 0;
  if (wholesale > 0) return wholesale;

  return Number(item.costPrice) || 0;
}

function isUvGoldJewelZeroDiscount(item: InventoryItem): boolean {
  return (
    /^UV$/i.test(item.class.trim()) && /^GOLD JEWL$/i.test(item.design.trim())
  );
}

function isDiamondCategory(item: InventoryItem): boolean {
  if (/diamond/i.test(item.description ?? "")) return true;
  return DIAMOND_DEPARTMENTS.has(normalizeDept(item.department));
}

function isUvDiamondSpecial(item: InventoryItem): boolean {
  // GOLD JEWL / GOLD JEWEL is gold pricing — never diamond UV 82% path
  const design = item.design.trim().toUpperCase();
  if (design === "GOLD JEWL" || design === "GOLD JEWEL" || design === "GOLD BANDS") {
    return false;
  }
  return hasUvOrUltimateValue(item) && isDiamondCategory(item);
}

function isUvDiamondZeroSku(item: InventoryItem): boolean {
  return UV_DIAMOND_ZERO_SKUS.has(skuCostKey(item.sku));
}

export function classifyProduct(item: InventoryItem): {
  category: ProductCategory;
  categoryLabel: string;
  watchBrand?: string;
  goldWeightGrams?: number;
} {
  if (isUvGoldJewelZeroDiscount(item)) {
    return { category: "other", categoryLabel: "UV Gold Jewel" };
  }

  if (isUvDiamondSpecial(item)) {
    return {
      category: "diamond_gemstone",
      categoryLabel: isUvDiamondZeroSku(item)
        ? "UV / Ultimate Value Diamond (no discount)"
        : "UV / Ultimate Value Diamond",
    };
  }

  if (isWatch(item)) {
    return {
      category: "watch",
      categoryLabel: "Watch",
      watchBrand: getWatchBrand(item),
    };
  }

  const fixedDesign = getFixedDesignCollection(item);
  if (fixedDesign) {
    return {
      category: "other",
      categoryLabel: fixedDesign,
    };
  }

  const metalBrand = getBenchmarkFamilyLabel(item);
  if (metalBrand) {
    return {
      category: "benchmark",
      categoryLabel: metalBrand,
    };
  }

  // Any GOLD JEWL / GOLD JEWEL / gold dept → gold discounts (65/60/55),
  // before gemstone / diamond dept (GENTS RING, LADYS RING, …).
  if (isGold(item)) {
    return {
      category: "gold",
      categoryLabel: "Gold",
      goldWeightGrams: getGoldAvgWeightGrams(item),
    };
  }

  if (isGemstone(item)) {
    return {
      category: "diamond_gemstone",
      categoryLabel: "Gemstone Jewelry",
    };
  }

  if (isDiamondCategory(item)) {
    return {
      category: "diamond_gemstone",
      categoryLabel: "Diamond Jewelry",
    };
  }

  return {
    category: "other",
    categoryLabel: "Jewelry",
  };
}

function getDiscountPercents(
  item: InventoryItem,
  category: ProductCategory,
  watchBrand?: string
): Record<ManagerTier, number> {
  if (isUvGoldJewelZeroDiscount(item)) {
    return ZERO_DISCOUNTS;
  }

  if (isUvDiamondSpecial(item)) {
    return isUvDiamondZeroSku(item) ? ZERO_DISCOUNTS : DIAMOND_DISCOUNTS;
  }

  if (category === "watch" && watchBrand) {
    return getWatchDiscountPercents(watchBrand, item);
  }

  if (getFixedDesignCollection(item)) {
    return FIXED_DESIGN_DISCOUNTS;
  }

  if (category === "benchmark") {
    return BENCHMARK_FAMILY_DISCOUNTS;
  }

  if (category === "diamond_gemstone" || category === "other") {
    return DIAMOND_DISCOUNTS;
  }

  if (category === "gold") {
    return GOLD_DISCOUNTS;
  }

  return DIAMOND_DISCOUNTS;
}

function formatTierSummary(discounts: Record<ManagerTier, number>): string {
  const { dm, cm, m } = discounts;
  if (dm === cm && cm === m) return `${dm}% off (DM / CM / M)`;
  return `DM ${dm}%, CM ${cm}%, M ${m}% off`;
}

function buildRulesSummary(
  item: InventoryItem,
  category: ProductCategory,
  watchBrand?: string,
  goldWeightGrams?: number,
  discounts?: Record<ManagerTier, number>
): string {
  if (!discounts) return "";

  if (isUvGoldJewelZeroDiscount(item)) {
    return "Class UV + Design GOLD JEWL — 0% discount";
  }

  if (isUvDiamondSpecial(item)) {
    if (isUvDiamondZeroSku(item)) {
      return `UV / Ultimate Value + diamond (SKU ${skuCostKey(item.sku)}) — 0% discount`;
    }
    return `UV / Ultimate Value + diamond — ${formatTierSummary(discounts)}`;
  }

  const fixedDesign = getFixedDesignCollection(item);
  if (fixedDesign) {
    return `${fixedDesign} — ${formatTierSummary(discounts)}`;
  }

  if (category === "watch" && watchBrand) {
    return `${watchBrand} watch — ${formatTierSummary(discounts)}`;
  }

  if (category === "benchmark") {
    const label = getBenchmarkFamilyLabel(item) ?? "Benchmark";
    return `${label} — ${formatTierSummary(discounts)}`;
  }

  if (category === "diamond_gemstone") {
    return `Diamond / Gemstone — ${formatTierSummary(discounts)}`;
  }

  if (category === "gold") {
    const weight = goldWeightGrams ?? 0;
    const weightLabel =
      weight > 0 ? `${weight}g avg weight — ` : "avg weight not set — ";
    return `Gold (${weightLabel}whole gold) — ${formatTierSummary(discounts)}`;
  }

  return `Standard jewelry — ${formatTierSummary(discounts)}`;
}

export function calculatePricing(item: InventoryItem): PricingResult {
  const { category, categoryLabel, watchBrand, goldWeightGrams } =
    classifyProduct(item);
  const discountPercents = getDiscountPercents(item, category, watchBrand);

  const tiers: TierPricing[] = (["dm", "cm", "m"] as ManagerTier[]).map(
    (tier) => {
      const discountPercent = discountPercents[tier];
      return {
        tier,
        label: TIER_LABELS[tier],
        discountPercent,
        cashPrice: item.tagPrice * (1 - discountPercent / 100),
      };
    }
  );

  return {
    category,
    categoryLabel,
    watchBrand,
    goldWeightGrams,
    tagPrice: item.tagPrice,
    tiers,
    rulesSummary: buildRulesSummary(
      item,
      category,
      watchBrand,
      goldWeightGrams,
      discountPercents
    ),
  };
}

/** Allowed off-tag % for a manager tier (single source: same rules as calculator). */
export function getAllowedDiscountPercent(
  item: InventoryItem,
  tier: ManagerTier
): number {
  const pricing = calculatePricing(item);
  return pricing.tiers.find((t) => t.tier === tier)?.discountPercent ?? 0;
}

export const CREDIT_CARD_SURCHARGE_PERCENT = 3.5;

export const FINANCING_PLAN_SURCHARGES: Record<FinancingPlan, number> = {
  "6_months": 3.5,
  "12_months": 7,
  "18_months": 12,
  "24_months": 18,
  "36_months": 22,
  "48_months": 28,
  "60_months": 32,
};

export const FINANCING_PLAN_LABELS: Record<FinancingPlan, string> = {
  "6_months": "06 Months No Interest — 3.5%",
  "12_months": "12 Months No Interest — 7%",
  "18_months": "18 Months No Interest — 12%",
  "24_months": "24 Months No Interest — 18%",
  "36_months": "36 Months No Interest — 22%",
  "48_months": "48 Months No Interest — 28%",
  "60_months": "60 Months No Interest — 32%",
};

/** Progressive / Acima / UOwn / Kefene — fixed 5%. */
export const LEASE_SURCHARGE_PERCENT = 5;

export const AFFIRM_SURCHARGE_PERCENT = 12;

export function calculateFinancedPrice(
  cashPrice: number,
  paymentMethod: PaymentMethod,
  financingPlan: FinancingPlan
): { surchargePercent: number; financedPrice: number } {
  if (paymentMethod === "cash") {
    return { surchargePercent: 0, financedPrice: cashPrice };
  }

  let surchargePercent = 0;
  if (paymentMethod === "credit_card") {
    surchargePercent = CREDIT_CARD_SURCHARGE_PERCENT;
  } else if (paymentMethod === "financing") {
    surchargePercent = FINANCING_PLAN_SURCHARGES[financingPlan];
  } else if (paymentMethod === "lease") {
    surchargePercent = LEASE_SURCHARGE_PERCENT;
  } else if (paymentMethod === "affirm") {
    surchargePercent = AFFIRM_SURCHARGE_PERCENT;
  }

  return {
    surchargePercent,
    financedPrice: cashPrice * (1 + surchargePercent / 100),
  };
}

export type CommissionMode = "regular" | "goal";

export const COMMISSION_RATES: Record<CommissionMode, number> = {
  regular: 4.25,
  goal: 8.5,
};

export const COMMISSION_MODE_LABELS: Record<CommissionMode, string> = {
  regular: "Regular commission — 4.25%",
  goal: "Goal commission — 8.5%",
};

/** Full final = financed/cash price + selected commission %. */
export function calculateGrandTotal(
  financedPrice: number,
  commissionPercent: number
): number {
  return financedPrice * (1 + commissionPercent / 100);
}

export function commissionDollars(
  financedPrice: number,
  commissionPercent: number
): number {
  return financedPrice * (commissionPercent / 100);
}

/** Fixed add-ons on whole cost for customer-offer profit floor. */
export const CUSTOMER_OFFER_TAX_PERCENT = 10;
export const CUSTOMER_OFFER_COMMISSION_PERCENT = 5;

export interface CustomerOfferResult {
  wholeCost: number;
  tax: number;
  commission: number;
  floor: number;
  customerOffer: number;
  profit: number;
  isLoss: boolean;
}

/** Floor = whole cost + 10% tax + 5% commission (each on whole cost, not compounded). */
export function calculateCustomerOfferProfit(
  wholeCost: number,
  customerOffer: number
): CustomerOfferResult {
  const safeWhole = Math.max(0, wholeCost);
  const safeOffer = Math.max(0, customerOffer);
  const tax = safeWhole * (CUSTOMER_OFFER_TAX_PERCENT / 100);
  const commission = safeWhole * (CUSTOMER_OFFER_COMMISSION_PERCENT / 100);
  const floor = safeWhole + tax + commission;
  const profit = safeOffer - floor;
  return {
    wholeCost: safeWhole,
    tax,
    commission,
    floor,
    customerOffer: safeOffer,
    profit,
    isLoss: profit < 0,
  };
}
