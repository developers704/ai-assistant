export const STORES = [
  "DBC-GM",
  "DBC-STOCK",
  "VJ-ARDN",
  "VJ-BAKER",
  "VJ-CHAND",
  "VJ-CULVER",
  "VJ-EAST",
  "VJ-FRE",
  "VJ-INLND",
  "VJ-LIV",
  "VJ-MOD",
  "VJ-NORTH",
  "VJ-OAK",
  "VJ-ONT",
  "VJ-PALM",
  "VJ-PB",
  "VJ-ROSE",
  "VJ-S.ANITA",
  "VJ-SAL",
  "VJ-SERRA",
  "VJ-VAL",
  "VJ-VICTOR",
] as const;

export type StoreCode = (typeof STORES)[number];

export interface InventoryItem {
  sku: string;
  description: string;
  vendorModel: string;
  tagPrice: number;
  costPrice: number;
  store: string;
  department: string;
  design: string;
  class: string;
  subClass: string;
  avgWeight: number;
  brand: string;
}

export type ProductCategory =
  | "watch"
  | "diamond_gemstone"
  | "gold"
  | "benchmark"
  | "other";

export type ManagerTier = "dm" | "cm" | "m";

export type PaymentMethod =
  | "cash"
  | "credit_card"
  | "financing"
  | "lease"
  | "affirm";

/** Store financing term plans (shown when payment type is Financing). */
export type FinancingPlan =
  | "6_months"
  | "12_months"
  | "18_months"
  | "24_months"
  | "36_months"
  | "48_months"
  | "60_months";

export interface TierPricing {
  tier: ManagerTier;
  label: string;
  discountPercent: number;
  cashPrice: number;
}

export interface PricingResult {
  category: ProductCategory;
  categoryLabel: string;
  watchBrand?: string;
  goldWeightGrams?: number;
  tagPrice: number;
  tiers: TierPricing[];
  rulesSummary: string;
}
