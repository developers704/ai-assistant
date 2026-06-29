import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { getLatestReportWithSummary } from "@/lib/reports/store";
import type { ReportSummary } from "@/lib/reports/types";
import type { SalesSummary } from "@/types";

export function getAssistantSalesSummary(): {
  summary: SalesSummary | ReportSummary;
  source: "report" | "mock";
  label?: string;
  vendorCode?: string;
} {
  const latest = getLatestReportWithSummary();
  if (latest) {
    return {
      summary: latest.summary,
      source: "report",
      label: latest.meta.label,
      vendorCode: latest.summary.vendorCode ?? latest.meta.vendorCode ?? undefined,
    };
  }
  return { summary: computeSalesSummary(mockSalesData), source: "mock" };
}
