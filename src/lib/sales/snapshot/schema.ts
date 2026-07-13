import { z } from "zod";

const dateRangeSchema = z.object({
  preset: z.string().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  timezone: z.string().optional(),
});

export const salesFiltersSchema = z.object({
  dateRange: dateRangeSchema.optional(),
  stores: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  departments: z.array(z.string()).optional(),
  designs: z.array(z.string()).optional(),
  vendors: z.array(z.string()).optional(),
  classes: z.array(z.string()).optional(),
  metals: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  skus: z.array(z.string()).optional(),
  vendorModels: z.array(z.string()).optional(),
  salesPeople: z.array(z.string()).optional(),
  transactionIds: z.array(z.string()).optional(),
});

export const salesFilterOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  aliases: z.array(z.string()).optional(),
  rowCount: z.number().optional(),
  netSales: z.number().optional(),
});

export const salesRankingItemSchema = z.object({
  rank: z.number(),
  id: z.string().optional(),
  label: z.string(),
  type: z.enum([
    "store",
    "department",
    "design",
    "vendor",
    "class",
    "metal",
    "product",
    "sku",
    "vendor_model",
    "sales_person",
  ]),
  grossSales: z.number(),
  discounts: z.number(),
  netSales: z.number(),
  units: z.number(),
  transactions: z.number(),
  averageTicket: z.number(),
  estimatedMargin: z.number().nullable(),
  marginRate: z.number().nullable(),
  contributionPercent: z.number(),
});

export const salesTrendPointSchema = z.object({
  period: z.string(),
  from: z.string(),
  to: z.string(),
  grossSales: z.number(),
  netSales: z.number(),
  units: z.number(),
  transactions: z.number(),
  estimatedMargin: z.number().nullable(),
});

export const salesMetricsSchema = z.object({
  grossSales: z.number(),
  discounts: z.number(),
  discountRate: z.number(),
  returns: z.number(),
  netSales: z.number(),
  units: z.number(),
  transactions: z.number(),
  averageTicket: z.number(),
  averageUnitPrice: z.number(),
  estimatedCost: z.number().nullable(),
  estimatedMargin: z.number().nullable(),
  marginRate: z.number().nullable(),
});

export const salesPeriodComparisonSchema = z.object({
  current: salesMetricsSchema,
  previous: salesMetricsSchema,
  change: z.object({
    netSalesAmount: z.number(),
    netSalesPercent: z.number().nullable(),
    unitsAmount: z.number(),
    unitsPercent: z.number().nullable(),
    transactionsAmount: z.number(),
    transactionsPercent: z.number().nullable(),
    marginAmount: z.number().nullable(),
    marginPercent: z.number().nullable(),
  }),
});

export const salesInsightSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  entityType: z.string().optional(),
  entity: z.string().optional(),
  metric: z.string().optional(),
  value: z.number().optional(),
  severity: z.enum(["info", "positive", "warning", "critical"]).optional(),
  confidence: z.number().optional(),
  filters: salesFiltersSchema.optional(),
});

export const salesDashboardSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0"),
  dataVersion: z.string(),
  generatedAt: z.string(),
  refreshedAt: z.string(),
  dataThrough: z.string().nullable(),
  source: z.object({
    fileName: z.string().optional(),
    fileHash: z.string().optional(),
    rowCount: z.number(),
    validRowCount: z.number(),
    rejectedRowCount: z.number(),
    dateRange: z.object({
      from: z.string().nullable(),
      to: z.string().nullable(),
    }),
    warnings: z.array(z.string()),
  }),
  status: z.object({
    state: z.enum(["ready", "processing", "failed", "stale"]),
    isComplete: z.boolean(),
    isValidated: z.boolean(),
    validationErrors: z.array(z.string()),
  }),
  activeFilters: salesFiltersSchema,
  availableFilters: z.object({
    stores: z.array(salesFilterOptionSchema),
    cities: z.array(salesFilterOptionSchema),
    states: z.array(salesFilterOptionSchema),
    regions: z.array(salesFilterOptionSchema),
    departments: z.array(salesFilterOptionSchema),
    designs: z.array(salesFilterOptionSchema),
    vendors: z.array(salesFilterOptionSchema),
    classes: z.array(salesFilterOptionSchema),
    metals: z.array(salesFilterOptionSchema),
    products: z.array(salesFilterOptionSchema),
    skus: z.array(salesFilterOptionSchema),
    vendorModels: z.array(salesFilterOptionSchema),
    salesPeople: z.array(salesFilterOptionSchema),
  }),
  summary: salesMetricsSchema,
  rankings: z.object({
    stores: z.array(salesRankingItemSchema),
    departments: z.array(salesRankingItemSchema),
    designs: z.array(salesRankingItemSchema),
    vendors: z.array(salesRankingItemSchema),
    classes: z.array(salesRankingItemSchema),
    metals: z.array(salesRankingItemSchema),
    products: z.array(salesRankingItemSchema),
    skus: z.array(salesRankingItemSchema),
    vendorModels: z.array(salesRankingItemSchema),
    salesPeople: z.array(salesRankingItemSchema),
  }),
  comparisons: z
    .object({
      previousDay: salesPeriodComparisonSchema.optional(),
      previousWeek: salesPeriodComparisonSchema.optional(),
      previousMonth: salesPeriodComparisonSchema.optional(),
      previousYear: salesPeriodComparisonSchema.optional(),
      samePeriodLastMonth: salesPeriodComparisonSchema.optional(),
      samePeriodLastYear: salesPeriodComparisonSchema.optional(),
    })
    .default({}),
  trends: z.object({
    daily: z.array(salesTrendPointSchema),
    weekly: z.array(salesTrendPointSchema),
    monthly: z.array(salesTrendPointSchema),
  }),
  insights: z.object({
    topPerformers: z.array(salesInsightSchema),
    weakPerformers: z.array(salesInsightSchema),
    highDiscountEntities: z.array(salesInsightSchema),
    lowMarginEntities: z.array(salesInsightSchema),
    highSalesLowMarginEntities: z.array(salesInsightSchema),
    unusualSpikes: z.array(salesInsightSchema),
    unusualDrops: z.array(salesInsightSchema),
    storeOpportunities: z.array(salesInsightSchema),
    vendorOpportunities: z.array(salesInsightSchema),
    designOpportunities: z.array(salesInsightSchema),
  }),
  metricDefinitions: z.record(
    z.string(),
    z.object({
      label: z.string(),
      description: z.string(),
      formula: z.string(),
      format: z.enum(["currency", "number", "percentage"]),
    })
  ),
});

export type SalesDashboardSnapshot = z.infer<typeof salesDashboardSnapshotSchema>;
export type SalesFiltersCanonical = z.infer<typeof salesFiltersSchema>;
export type SalesMetricsCanonical = z.infer<typeof salesMetricsSchema>;
