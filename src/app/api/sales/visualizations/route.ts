import { NextRequest, NextResponse } from "next/server";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";
import { ensureActiveSalesVersion } from "@/lib/sales/refresh/service";
import { buildSalesVisualizations } from "@/lib/sales/visualizations";

export async function GET(req: NextRequest) {
  await ensureActiveSalesVersion();

  const sp = req.nextUrl.searchParams;
  const dateParam = sp.get("date")?.trim() ?? "";
  const fromParam = sp.get("from")?.trim() ?? "";
  const toParam = sp.get("to")?.trim() ?? "";
  const singleDate = dateParam ? parseReportFilterDate(dateParam) ?? undefined : undefined;
  const fromParsed = fromParam ? parseReportFilterDate(fromParam) ?? undefined : undefined;
  const toParsed = toParam ? parseReportFilterDate(toParam) ?? undefined : undefined;

  if (dateParam && (!singleDate || !isValidIsoDate(singleDate))) {
    return NextResponse.json(
      { error: "Invalid date. Use MM/DD/YY or YYYY-MM-DD." },
      { status: 400 }
    );
  }
  if (fromParam && (!fromParsed || !isValidIsoDate(fromParsed))) {
    return NextResponse.json({ error: "Invalid from date." }, { status: 400 });
  }
  if (toParam && (!toParsed || !isValidIsoDate(toParsed))) {
    return NextResponse.json({ error: "Invalid to date." }, { status: 400 });
  }

  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  if (fromParsed && toParsed) {
    dateFrom = fromParsed <= toParsed ? fromParsed : toParsed;
    dateTo = fromParsed <= toParsed ? toParsed : fromParsed;
  } else if (singleDate) {
    dateFrom = singleDate;
    dateTo = singleDate;
  } else if (fromParsed) {
    dateFrom = fromParsed;
    dateTo = fromParsed;
  }

  const payload = buildSalesVisualizations({
    date: dateFrom && dateTo && dateFrom === dateTo ? dateFrom : undefined,
    dateFrom,
    dateTo,
    store: sp.get("store")?.trim() || undefined,
    department: sp.get("department")?.trim() || undefined,
    design: sp.get("design")?.trim() || undefined,
    vendor: sp.get("vendor")?.trim() || undefined,
    className: sp.get("class")?.trim() || undefined,
  });

  return NextResponse.json(payload);
}
