import type {
  FinancingPlan,
  InventoryItem,
  ManagerTier,
  PaymentMethod,
  PricingResult,
  ProductCategory,
  TierPricing,
} from "./types";

const TIER_LABELS: Record<ManagerTier, string> = {
  dm: "District Manager (DM)",
  cm: "Corporate Manager (CM)",
  m: "Manager (M)",
};

const WATCH_DISCOUNTS: Record<string, Record<ManagerTier, number>> = {
  ROLEX: { dm: 62, cm: 60, m: 60 },
  GUCCI: { dm: 15, cm: 15, m: 15 },
  RADO: { dm: 18, cm: 18, m: 18 },
  LONGINES: { dm: 18, cm: 18, m: 18 },
  MOVADO: { dm: 25, cm: 25, m: 25 },
  BULOVA: { dm: 25, cm: 25, m: 25 },
  "MICHAEL KO": { dm: 25, cm: 25, m: 25 },
};

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

function isGold(item: InventoryItem): boolean {
  const dept = normalizeDept(item.department);
  if (GOLD_DEPTS.some((g) => dept.includes(g) || dept === g)) return true;
  if (/^GOLD JEWL$/i.test(item.design.trim())) return true;
  if (/GOLD/i.test(item.department)) return true;
  return false;
}

/** Gold under/over 20g discounts use AvgWeight column only. */
function getGoldAvgWeightGrams(item: InventoryItem): number {
  return item.avgWeight > 0 ? item.avgWeight : 0;
}

function isBenchmark(item: InventoryItem): boolean {
  return (
    /benchmark/i.test(item.vendorModel) ||
    /benchmark/i.test(item.description)
  );
}

function isWatch(item: InventoryItem): boolean {
  const dept = normalizeDept(item.department);
  if (dept in WATCH_DISCOUNTS) return true;
  if (dept.startsWith("MICHAEL")) return true;
  return dept === "WATCH";
}

function getWatchBrand(item: InventoryItem): string {
  const dept = normalizeDept(item.department);
  if (dept in WATCH_DISCOUNTS) return dept;
  if (dept.startsWith("MICHAEL")) return "MICHAEL KO";
  return dept;
}

function getWatchDiscountPercents(
  watchBrand: string,
  item: InventoryItem
): Record<ManagerTier, number> {
  return (
    WATCH_DISCOUNTS[watchBrand] ??
    WATCH_DISCOUNTS[normalizeDept(item.department)] ?? {
      dm: 0,
      cm: 0,
      m: 0,
    }
  );
}

const FIXED_DESIGN_DISCOUNT_PCT = 20;

const FIXED_DESIGN_LABELS: Record<string, string> = {
  LINKNLOCK: "Link N Lock",
  LOVE: "Love",
  OROVENTI: "Oroventi",
};

function getFixedDesignCollection(item: InventoryItem): string | null {
  const design = item.design.trim().toUpperCase();
  return FIXED_DESIGN_LABELS[design] ?? null;
}

function fixedDesignDiscounts(): Record<ManagerTier, number> {
  return {
    dm: FIXED_DESIGN_DISCOUNT_PCT,
    cm: FIXED_DESIGN_DISCOUNT_PCT,
    m: FIXED_DESIGN_DISCOUNT_PCT,
  };
}

function isGemstone(item: InventoryItem): boolean {
  return /birthstone/i.test(item.subClass);
}

function isDiamond(item: InventoryItem): boolean {
  return /diamond/i.test(item.description);
}

export function classifyProduct(item: InventoryItem): {
  category: ProductCategory;
  categoryLabel: string;
  watchBrand?: string;
  goldWeightGrams?: number;
} {
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

  if (isBenchmark(item)) {
    return {
      category: "benchmark",
      categoryLabel: "Benchmark Gold",
    };
  }

  if (isGemstone(item)) {
    return {
      category: "diamond_gemstone",
      categoryLabel: "Gemstone Jewelry",
    };
  }

  if (isDiamond(item)) {
    return {
      category: "diamond_gemstone",
      categoryLabel: "Diamond Jewelry",
    };
  }

  if (isGold(item)) {
    const goldWeightGrams = getGoldAvgWeightGrams(item);
    return {
      category: "gold",
      categoryLabel: "Gold",
      goldWeightGrams,
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
  watchBrand?: string,
  goldWeightGrams?: number
): Record<ManagerTier, number> {
  if (category === "watch" && watchBrand) {
    return getWatchDiscountPercents(watchBrand, item);
  }

  if (getFixedDesignCollection(item)) {
    return fixedDesignDiscounts();
  }

  if (category === "benchmark") {
    return { dm: 65, cm: 60, m: 55 };
  }

  if (category === "diamond_gemstone" || category === "other") {
    return { dm: 82, cm: 80, m: 77.5 };
  }

  if (category === "gold") {
    const over20 = (goldWeightGrams ?? 0) >= 20;
    if (over20) return { dm: 65, cm: 60, m: 55 };
    return { dm: 58, cm: 55, m: 50 };
  }

  return { dm: 82, cm: 80, m: 77.5 };
}

function buildRulesSummary(
  item: InventoryItem,
  category: ProductCategory,
  watchBrand?: string,
  goldWeightGrams?: number,
  discounts?: Record<ManagerTier, number>
): string {
  const fixedDesign = getFixedDesignCollection(item);
  if (fixedDesign && discounts) {
    return `${fixedDesign} — ${discounts.dm}% off (fixed for DM / CM / M)`;
  }

  if (category === "watch" && watchBrand && discounts) {
    const { dm, cm, m } = discounts;
    if (dm === cm && cm === m) {
      return `${watchBrand} watch — ${dm}% off (DM / CM / M)`;
    }
    return `${watchBrand} watch — DM ${dm}%, CM ${cm}%, M ${m}% off`;
  }
  if (category === "benchmark") {
    return "Benchmark — DM 65%, CM 60%, M 55% off";
  }
  if (category === "diamond_gemstone") {
    return "Diamond / Gemstone — DM 82%, CM 80%, M 77.5% off";
  }
  if (category === "gold") {
    const weight = goldWeightGrams ?? 0;
    const tier = weight >= 20 ? "20g and over" : "under 20g";
    const weightLabel = weight > 0 ? `${weight}g avg weight — ` : "avg weight not set — ";
    return `Gold (${weightLabel}${tier}) — DM ${discounts?.dm}%, CM ${discounts?.cm}%, M ${discounts?.m}% off`;
  }
  return "Standard jewelry — DM 82%, CM 80%, M 77.5% off";
}

export function calculatePricing(item: InventoryItem): PricingResult {
  const { category, categoryLabel, watchBrand, goldWeightGrams } =
    classifyProduct(item);
  const discountPercents = getDiscountPercents(
    item,
    category,
    watchBrand,
    goldWeightGrams
  );

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

export function calculateGrandTotal(
  financedPrice: number,
  commission: number,
  commissionPlus: number
): number {
  return financedPrice + commission + commissionPlus;
}
