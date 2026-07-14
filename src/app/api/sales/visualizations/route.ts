import { NextRequest, NextResponse } from "next/server";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";
import { ensureActiveSalesVersion } from "@/lib/sales/refresh/service";
import { buildSalesVisualizations } from "@/lib/sales/visualizations";

export async function GET(req: NextRequest) {
  await ensureActiveSalesVersion();

  const sp = req.nextUrl.searchParams;
  const dateParam = sp.get("date")?.trim() ?? "";
  const filterDate = dateParam ? parseReportFilterDate(dateParam) ?? undefined : undefined;

  if (dateParam && (!filterDate || !isValidIsoDate(filterDate))) {
    return NextResponse.json(
      { error: "Invalid date. Use MM/DD/YY or YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const payload = buildSalesVisualizations({
    date: filterDate,
    store: sp.get("store")?.trim() || undefined,
    department: sp.get("department")?.trim() || undefined,
    design: sp.get("design")?.trim() || undefined,
    vendor: sp.get("vendor")?.trim() || undefined,
    className: sp.get("class")?.trim() || undefined,
  });

  return NextResponse.json(payload);
}
