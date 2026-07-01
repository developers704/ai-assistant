import type { SalesSummary } from "@/types";

export type ReportPeriod = "daily" | "monthly" | "quarterly" | "half_yearly" | "yearly" | "custom";
export type ReportCategory = "sales" | "vendor" | "inventory" | "financing" | "custom";
export type ReportSchema = "generic" | "vendor_pos" | "financing";

export interface VendorPosRow {
  date: string;
  storeName: string;
  department: string;
  design: string;
  itemNumber: string;
  description: string;
  vendor: string;
  quantity: number;
  grossSales: number;
  discountAmount: number;
  netRevenue: number;
  discountRate: number;
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
  transactionCount?: number;
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
