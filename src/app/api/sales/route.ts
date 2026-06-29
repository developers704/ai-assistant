import { NextResponse } from "next/server";
import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { getLatestReportWithSummary } from "@/lib/reports/store";

export async function GET() {
  const latest = getLatestReportWithSummary();

  if (latest) {
    return NextResponse.json({
      summary: latest.summary,
      report: latest.meta,
      data: [],
      source: "report",
      reportLabel: latest.summary.reportLabel,
      reportDate: latest.summary.reportDate,
      vendorCode: latest.summary.vendorCode,
      reportPeriod: latest.summary.reportPeriod,
    });
  }

  const summary = computeSalesSummary(mockSalesData);
  return NextResponse.json({
    summary: { ...summary, source: "mock" },
    data: mockSalesData,
    source: "mock",
  });
}
