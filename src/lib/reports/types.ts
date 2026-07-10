import type { SalesSummary } from "@/types";

export type ReportPeriod = "daily" | "monthly" | "quarterly" | "half_yearly" | "yearly" | "custom";
export type ReportCategory = "sales" | "vendor" | "inventory" | "financing" | "custom";
export type ReportSchema = "generic" | "vendor_pos" | "store_sales" | "financing";

export type RankDimension =
  | "store"
  | "department"
  | "vendor"
  | "design"
  | "class"
  | "vendorModel";

export interface VendorPosRow {
  date: string;
  transactionId: string;
  storeName: string;
  department: string;
  design: string;
  itemNumber: string;
  sku: string;
  style: string;
  description: string;
  vendor: string;
  vendorModel: string;
  productClass: string;
  subClass: string;
  quantity: number;
  inventoryCost: number;
  grossSales: number;
  discountAmount: number;
  netRevenue: number;
  margin: number;
  discountRate: number;
  /** Raw Image Dir. value from CSV (e.g. `\229149.jpg`). */
  imageDir: string;
}

export interface StoredReportMeta {
  id: string;
  fileName: string;
  label: string;
  uploadedAt: string;
  reportDate: string | null;
  rowCount: number;
  columns: string[];
  reportPeriod?: ReportPeriod;
  reportCategory?: ReportCategory;
  vendorCode?: string | null;
  schema?: ReportSchema;
  dateRange?: { from: string; to: string };
}

export interface ReportSummary extends SalesSummary {
  source: "report" | "mock";
  reportId?: string;
  reportLabel?: string;
  reportDate?: string | null;
  schema?: ReportSchema;
  reportPeriod?: ReportPeriod;
  reportCategory?: ReportCategory;
  vendorCode?: string;
  grossSales?: number;
  discountTotal?: number;
  avgDiscountRate?: number;
  dateRange?: { from: string; to: string };
  topDepartments?: { name: string; revenue: number; units: number }[];
  topDesigns?: { name: string; revenue: number; units: number }[];
  topVendors?: { name: string; revenue: number; units: number }[];
  topClasses?: { name: string; revenue: number; units: number }[];
  topSubClasses?: { name: string; revenue: number; units: number }[];
  totalInventoryCost?: number;
  totalMargin?: number;
  marginRate?: number;
  transactionCount?: number;
  uniqueTransactions?: number;
  totalProfit?: number;
  paymentMethods?: { name: string; revenue: number; units: number; share: number }[];
  financingProviders?: { name: string; revenue: number; units: number; share: number }[];
  topSalesPeople?: { name: string; revenue: number; units: number }[];
  cashRate?: number;
  creditCardRate?: number;
  financingRate?: number;
}

export interface ReportListResponse {
  reports: StoredReportMeta[];
  latest: StoredReportMeta | null;
}

export interface LatestReportResponse {
  report: StoredReportMeta;
  summary: ReportSummary;
  csv: string;
}
