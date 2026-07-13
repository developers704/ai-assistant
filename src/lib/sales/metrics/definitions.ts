/**
 * Canonical sales metric registry — single source of truth for formulas.
 * All dashboard / chat / voice / analyst consumers must use these definitions
 * via summarizeRows() / querySales() — never re-implement in UI or the LLM.
 */

export type SalesMetricFormat = "currency" | "number" | "percentage";

export interface SalesMetricDefinition {
  id: string;
  label: string;
  description: string;
  formula: string;
  format: SalesMetricFormat;
  requiredFields: string[];
  nullBehavior: string;
  aggregation: "sum" | "ratio" | "derived";
}

export const SALES_METRICS = {
  gross_sales: {
    id: "gross_sales",
    label: "Gross Sales",
    description: "Sum of sales amount before discounts and returns",
    formula: "Σ grossSales",
    format: "currency" as const,
    requiredFields: ["grossSales"],
    nullBehavior: "Treat missing as 0",
    aggregation: "sum" as const,
  },
  discounts: {
    id: "discounts",
    label: "Discounts",
    description: "Sum of discount amounts",
    formula: "Σ discountAmount",
    format: "currency" as const,
    requiredFields: ["discountAmount"],
    nullBehavior: "Treat missing as 0",
    aggregation: "sum" as const,
  },
  discount_rate: {
    id: "discount_rate",
    label: "Discount Rate",
    description: "Discounts as a share of gross sales",
    formula: "discounts / gross_sales",
    format: "percentage" as const,
    requiredFields: ["discountAmount", "grossSales"],
    nullBehavior: "0 when gross_sales is 0",
    aggregation: "ratio" as const,
  },
  returns: {
    id: "returns",
    label: "Returns",
    description: "Return amounts (negative net lines when present)",
    formula: "Σ abs(netRevenue) where quantity < 0 or netRevenue < 0",
    format: "currency" as const,
    requiredFields: ["netRevenue", "quantity"],
    nullBehavior: "0 when not tracked separately",
    aggregation: "sum" as const,
  },
  net_sales: {
    id: "net_sales",
    label: "Net Sales",
    description: "Sales after discounts (CSV Total column)",
    formula: "Σ netRevenue",
    format: "currency" as const,
    requiredFields: ["netRevenue"],
    nullBehavior: "Treat missing as 0",
    aggregation: "sum" as const,
  },
  units: {
    id: "units",
    label: "Units",
    description: "Total quantity sold",
    formula: "Σ quantity",
    format: "number" as const,
    requiredFields: ["quantity"],
    nullBehavior: "Treat missing as 0",
    aggregation: "sum" as const,
  },
  transactions: {
    id: "transactions",
    label: "Transactions",
    description: "Distinct transaction IDs in the filtered set",
    formula: "COUNT DISTINCT transactionId",
    format: "number" as const,
    requiredFields: ["transactionId"],
    nullBehavior: "Fall back to row count when transactionId missing",
    aggregation: "derived" as const,
  },
  average_ticket: {
    id: "average_ticket",
    label: "Average Ticket",
    description: "Net sales divided by distinct transactions",
    formula: "net_sales / transactions",
    format: "currency" as const,
    requiredFields: ["netRevenue", "transactionId"],
    nullBehavior: "0 when transactions is 0",
    aggregation: "ratio" as const,
  },
  average_unit_price: {
    id: "average_unit_price",
    label: "Average Unit Price",
    description: "Net sales divided by units",
    formula: "net_sales / units",
    format: "currency" as const,
    requiredFields: ["netRevenue", "quantity"],
    nullBehavior: "0 when units is 0",
    aggregation: "ratio" as const,
  },
  estimated_cost: {
    id: "estimated_cost",
    label: "Estimated Cost",
    description: "Sum of inventory / product cost from the report",
    formula: "Σ inventoryCost",
    format: "currency" as const,
    requiredFields: ["inventoryCost"],
    nullBehavior: "null when cost column absent; never treat as exact",
    aggregation: "sum" as const,
  },
  estimated_margin: {
    id: "estimated_margin",
    label: "Estimated Margin",
    description: "Net sales minus estimated product cost",
    formula: "net_sales - estimated_cost",
    format: "currency" as const,
    requiredFields: ["netRevenue", "inventoryCost"],
    nullBehavior: "null when cost is missing (not zero)",
    aggregation: "derived" as const,
  },
  margin_rate: {
    id: "margin_rate",
    label: "Margin Rate",
    description: "Estimated margin as a share of net sales",
    formula: "estimated_margin / net_sales",
    format: "percentage" as const,
    requiredFields: ["netRevenue", "inventoryCost"],
    nullBehavior: "null when cost missing; 0 when net_sales is 0",
    aggregation: "ratio" as const,
  },
} as const satisfies Record<string, SalesMetricDefinition>;

export type SalesMetricId = keyof typeof SALES_METRICS;

export function metricDefinitionsRecord(): Record<
  string,
  { label: string; description: string; formula: string; format: SalesMetricFormat }
> {
  return Object.fromEntries(
    Object.values(SALES_METRICS).map((m) => [
      m.id,
      {
        label: m.label,
        description: m.description,
        formula: m.formula,
        format: m.format,
      },
    ])
  );
}
