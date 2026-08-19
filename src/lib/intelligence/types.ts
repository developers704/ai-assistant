import type { ForecastPoint } from "@/lib/analyst/types";

export type IntelligenceRow = {
  date: string;
  transactionId: string;
  storeName: string;
  sku: string;
  itemNumber: string;
  style: string;
  description: string;
  vendorModel: string;
  vendor: string;
  department: string;
  design: string;
  productClass: string;
  subClass: string;
  quantity: number;
  inventoryCost: number;
  grossSales: number;
  discountAmount: number;
  netRevenue: number;
  salespersons: string;
  customerFirstName: string;
  customerLastName: string;
  customerCity: string;
  customerState: string;
  customerZip: string;
  customerStreet: string;
  customerEmail: string;
  customerPhone: string;
  customerId: string;
};

export type RankedMetric = {
  id: string;
  label: string;
  netSales: number;
  units: number;
  transactions: number;
  avgTicket: number;
  discountPct: number;
  sharePct: number;
  indexVsChain?: number;
};

export type StoreDeptDesignCell = {
  store: string;
  department: string;
  design: string;
  netSales: number;
  units: number;
  indexVsChain: number;
};

export type SalespersonSpecialty = {
  code: string;
  name: string;
  netSales: number;
  units: number;
  avgTicket: number;
  topDepartment: string;
  topDesign: string;
  deptIndex: number;
};

export type CustomerDemographic = {
  zip: string;
  city: string;
  netSales: number;
  customers: number;
  transactions: number;
  avgTicket: number;
};

export type RetentionStats = {
  uniqueCustomers: number;
  repeatCustomers: number;
  repeatRatePct: number;
  avgVisitsPerCustomer: number;
  avgDaysBetweenVisits: number | null;
};

export type ProductInsight = {
  vendorModel: string;
  sku: string;
  department: string;
  design: string;
  netSales: number;
  units: number;
  onHand: number | null;
  sellThroughPct: number | null;
};

export type IntelligenceIssue = {
  severity: "high" | "medium" | "low";
  category: string;
  title: string;
  detail: string;
  solution: string;
  store?: string;
  metric?: string;
};

export type IntelligenceReport = {
  generatedAt: string;
  filter: { dateFrom: string; dateTo: string; store: string | null };
  dateRange: { from: string; to: string };
  rowCount: number;
  summary: {
    netSales: number;
    grossSales: number;
    discountPct: number;
    units: number;
    transactions: number;
    avgTicket: number;
    yoyNetPct: number | null;
    yoyLabel: string;
    storeCount: number;
    customerCount: number;
  };
  stores: RankedMetric[];
  departments: RankedMetric[];
  designs: RankedMetric[];
  /** Store × department — index vs chain avg (100 = average). */
  storeByDepartment: StoreDeptDesignCell[];
  /** Store × design — index vs chain avg. */
  storeByDesign: StoreDeptDesignCell[];
  /** Best store per department (highest index). */
  bestStoreByDepartment: Array<{ department: string; store: string; index: number; netSales: number }>;
  /** Best store per design. */
  bestStoreByDesign: Array<{ design: string; store: string; index: number; netSales: number }>;
  salespersons: SalespersonSpecialty[];
  customers: {
    retention: RetentionStats;
    topZips: CustomerDemographic[];
    topCities: CustomerDemographic[];
    crossStoreShoppers: number;
  };
  products: {
    topModels: ProductInsight[];
    slowMovers: ProductInsight[];
  };
  forecast: {
    monthly: ForecastPoint[];
    projectedMonthNet: number | null;
    trendPct: number | null;
  };
  issues: IntelligenceIssue[];
  brief: string;
};
