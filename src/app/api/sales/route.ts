import { NextRequest, NextResponse } from "next/server";
import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { getLatestReportWithSummary } from "@/lib/reports/store";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dateParam = sp.get("date")?.trim() ?? "";
  const filterDate = dateParam ? parseReportFilterDate(dateParam) : undefined;
  const filterStore = sp.get("store")?.trim() || undefined;
  const filterDepartment = sp.get("department")?.trim() || undefined;
  const filterDesign = sp.get("design")?.trim() || undefined;

  if (dateParam && (!filterDate || !isValidIsoDate(filterDate))) {
    return NextResponse.json({ error: "Invalid date. Use MM/DD/YY or YYYY-MM-DD." }, { status: 400 });
  }

  const latest = getLatestReportWithSummary({
    ...(filterDate ? { filterDate } : {}),
    ...(filterStore ? { filterStore } : {}),
    ...(filterDepartment ? { filterDepartment } : {}),
    ...(filterDesign ? { filterDesign } : {}),
  });

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
      availableDates: latest.availableDates,
      availableStores: latest.availableStores,
      availableDepartments: latest.availableDepartments,
      availableDesigns: latest.availableDesigns,
      filterDate: filterDate ?? null,
      filterStore: filterStore ?? null,
      filterDepartment: filterDepartment ?? null,
      filterDesign: filterDesign ?? null,
    });
  }

  const summary = computeSalesSummary(mockSalesData);
  return NextResponse.json({
    summary: { ...summary, source: "mock" },
    data: mockSalesData,
    source: "mock",
    availableDates: [],
    availableStores: [],
    availableDepartments: [],
    availableDesigns: [],
    filterDate: null,
    filterStore: null,
    filterDepartment: null,
    filterDesign: null,
  });
}
