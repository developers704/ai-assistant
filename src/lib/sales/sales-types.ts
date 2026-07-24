/** Shared Sales Intelligence types — deterministic query engine for chat, voice, dashboard, analyst. */

export type SalesDateRangeType =
  | "today"
  | "yesterday"
  | "day_before_yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "year_to_date"
  | "last_year"
  | "past_7_days"
  | "past_30_days"
  | "all_dates"
  | "custom"
  | "last_7_days"
  | "previous_business_day";

export type SalesMetric =
  | "net_sales"
  | "gross_sales"
  | "discounts"
  | "discount_rate"
  | "units_sold"
  | "transactions"
  | "estimated_margin"
  | "margin_rate"
  | "average_ticket"
  | "average_unit_price";

export type SalesGroupBy =
  | "date"
  | "store"
  | "department"
  | "design"
  | "vendor"
  | "class"
  | "product"
  | "sku"
  | "vendor_model"
  | "salesperson";

export type SalesEntityType =
  | "store"
  | "department"
  | "design"
  | "vendor"
  | "class"
  | "product";

export type SalesComparisonMode =
  | "compare_entities"
  | "compare_periods"
  | "compare_to_previous_period"
  | "compare_to_average";

export interface SalesDateRangeInput {
  type?: SalesDateRangeType;
  startDate?: string;
  endDate?: string;
}

export interface SalesResolvedDateRange {
  type: SalesDateRangeType | "report_all";
  startDate: string | null;
  endDate: string | null;
  label: string;
  dates: string[];
}

export interface SalesQueryFilters {
  stores: string[];
  cities: string[];
  states: string[];
  regions: string[];
  departments: string[];
  designs: string[];
  vendors: string[];
  classes: string[];
  products: string[];
  skus: string[];
  vendorModels: string[];
}

export interface SalesQueryInput {
  dateRange?: SalesDateRangeInput;
  stores?: string[];
  cities?: string[];
  states?: string[];
  regions?: string[];
  departments?: string[];
  designs?: string[];
  vendors?: string[];
  classes?: string[];
  products?: string[];
  skus?: string[];
  vendorModels?: string[];
  metrics?: SalesMetric[];
  groupBy?: SalesGroupBy[];
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  limit?: number;
  comparison?: {
    mode?: SalesComparisonMode;
    entityType?: SalesEntityType;
    entities?: string[];
    currentPeriod?: { startDate: string; endDate: string };
    previousPeriod?: { startDate: string; endDate: string };
  };
  include?: {
    summary?: boolean;
    breakdown?: boolean;
    topStores?: boolean;
    lowestStores?: boolean;
    topDepartments?: boolean;
    topDesigns?: boolean;
    topVendors?: boolean;
    topClasses?: boolean;
    topProducts?: boolean;
    topVendorModels?: boolean;
    topSalesPeople?: boolean;
    trends?: boolean;
  };
  display?: {
    navigateToSales?: boolean;
    applyDashboardFilters?: boolean;
    openDetailPanel?: boolean;
    detailType?: SalesEntityType;
    detailValue?: string;
  };
  /** Original user utterance — used for NL entity/date extraction when structured fields are sparse. */
  userMessage?: string;
  /** When true, ignore previous sales memory and start fresh. */
  resetContext?: boolean;
  /**
   * When true, treat store/department/design/vendor/class filters as exact
   * UI values (no chat/voice fuzzy matching). Used by the Sales Dashboard.
   */
  exactFilters?: boolean;
}

export interface SalesMetricSummary {
  netSales: number | null;
  grossSales: number | null;
  discounts: number | null;
  discountRate: number | null;
  unitsSold: number | null;
  transactions: number | null;
  estimatedMargin: number | null;
  marginRate: number | null;
  averageTicket: number | null;
  averageUnitPrice: number | null;
}

/** Per-store units for a SKU under a vendor model. */
export interface VendorModelSkuStoreLine {
  name: string;
  units: number;
}

/** SKUs that contributed to a vendor-model ranking row. */
export interface VendorModelSkuLine {
  sku: string;
  units: number;
  revenue: number;
  margin?: number;
  /** Profit margin = margin / revenue (0–1) */
  marginRate?: number;
  /** Per-store units sold for this SKU under the parent model / filter slice */
  stores?: VendorModelSkuStoreLine[];
}

export interface SalesBreakdownRow {
  name: string;
  /** POS code when grouping by salesperson. */
  code?: string;
  netSales: number;
  grossSales: number;
  discounts: number;
  unitsSold: number;
  transactions: number;
  estimatedMargin: number;
  share?: number;
  imageUrl?: string | null;
  sku?: string;
  vendorModel?: string;
  description?: string;
  /** Distinct SKUs sold under this vendor model (Top Vendor Models). */
  skus?: VendorModelSkuLine[];
}

export interface SalesClarification {
  field: keyof SalesQueryFilters | "dateRange" | "entity";
  message: string;
  options: string[];
}

export interface SalesDashboardState {
  route: "/sales";
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  stores: string[];
  departments: string[];
  designs: string[];
  vendors: string[];
  classes: string[];
  selectedDetail?: {
    type: SalesEntityType;
    value: string;
  } | null;
}

export interface SalesComparisonResult {
  left: { label: string; summary: SalesMetricSummary; topDepartment?: string; topDesign?: string; topVendor?: string; topVendorModel?: string };
  right: { label: string; summary: SalesMetricSummary; topDepartment?: string; topDesign?: string; topVendor?: string; topVendorModel?: string };
  differences: Partial<Record<keyof SalesMetricSummary, number | null>>;
  percentageChanges: Partial<Record<keyof SalesMetricSummary, number | null>>;
  winnerByMetric: Partial<Record<keyof SalesMetricSummary, string | null>>;
}

export interface SalesQueryResult {
  ok: boolean;
  query: {
    resolvedDateRange: SalesResolvedDateRange;
    filters: SalesQueryFilters;
    metrics: SalesMetric[];
    groupBy: SalesGroupBy[];
    comparison?: SalesQueryInput["comparison"];
  };
  availability: {
    reportName: string | null;
    reportStartDate: string | null;
    reportEndDate: string | null;
    requestedRangeAvailable: boolean;
    matchingRowCount: number;
  };
  summary: SalesMetricSummary | null;
  breakdowns?: {
    byStore?: SalesBreakdownRow[];
    byDepartment?: SalesBreakdownRow[];
    byDesign?: SalesBreakdownRow[];
    byVendor?: SalesBreakdownRow[];
    byClass?: SalesBreakdownRow[];
    byProduct?: SalesBreakdownRow[];
    bySku?: SalesBreakdownRow[];
    byVendorModel?: SalesBreakdownRow[];
    byDate?: SalesBreakdownRow[];
    bySalesperson?: SalesBreakdownRow[];
  };
  rankings?: {
    topStores?: SalesBreakdownRow[];
    lowestStores?: SalesBreakdownRow[];
    topDepartments?: SalesBreakdownRow[];
    topDesigns?: SalesBreakdownRow[];
    topVendors?: SalesBreakdownRow[];
    topClasses?: SalesBreakdownRow[];
    topProducts?: SalesBreakdownRow[];
    topVendorModels?: SalesBreakdownRow[];
    topSalesPeople?: SalesBreakdownRow[];
  };
  comparison?: SalesComparisonResult;
  dashboardState?: SalesDashboardState;
  clarification?: SalesClarification;
  spokenAnswer: string;
  textAnswer: string;
  warnings?: string[];
  error?: string;
  /** Active sales intelligence version + freshness (unified path). */
  freshness?: {
    dataVersion: string | null;
    dataThrough: string | null;
    refreshedAt: string | null;
    source?: string | null;
  };
  coverage?: {
    complete: boolean;
    requestedFrom?: string | null;
    requestedTo?: string | null;
    availableFrom?: string | null;
    availableTo?: string | null;
    warning?: string;
  };
}

export interface SalesWorkingMemoryState {
  lastSalesQuery?: SalesQueryInput;
  lastDateRange?: SalesResolvedDateRange;
  lastStores?: string[];
  lastDepartments?: string[];
  lastDesigns?: string[];
  lastVendors?: string[];
  lastClasses?: string[];
  lastMetrics?: SalesMetric[];
  lastGroupBy?: SalesGroupBy[];
  lastComparison?: SalesQueryInput["comparison"];
  lastSelectedEntity?: { type: SalesEntityType; value: string };
  lastSalesResultSummary?: string;
  lastDashboardState?: SalesDashboardState;
  updatedAt?: string;
}

export interface EntityIndex {
  stores: string[];
  departments: string[];
  designs: string[];
  vendors: string[];
  classes: string[];
  skus: string[];
  vendorModels: string[];
  products: string[];
  dates: string[];
}
