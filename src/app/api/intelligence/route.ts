import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import { buildIntelligenceReport } from "@/lib/intelligence/build-report";
import {
  intelligenceDateBounds,
  intelligenceSeedExists,
  loadIntelligenceRows,
} from "@/lib/intelligence/load-rows";
import { isValidIsoDate } from "@/lib/reports/date-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!intelligenceSeedExists()) {
    return NextResponse.json(
      {
        error: "Intelligence dataset missing",
        hint: "Place sales-customer-jan25-aug26.csv in data/intelligence/",
      },
      { status: 503 }
    );
  }

  const from = req.nextUrl.searchParams.get("from")?.trim() || null;
  const to = req.nextUrl.searchParams.get("to")?.trim() || null;
  const store = req.nextUrl.searchParams.get("store")?.trim() || null;

  if (from && !isValidIsoDate(from)) {
    return NextResponse.json({ error: "from must be YYYY-MM-DD" }, { status: 400 });
  }
  if (to && !isValidIsoDate(to)) {
    return NextResponse.json({ error: "to must be YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const rows = loadIntelligenceRows();
    const bounds = intelligenceDateBounds(rows);
    const report = buildIntelligenceReport(rows, {
      dateFrom: from,
      dateTo: to,
      store,
    });

    if (!report) {
      return NextResponse.json(
        { error: "No rows for selected filters", availableDates: bounds.dates },
        { status: 404 }
      );
    }

    return NextResponse.json({
      report,
      availableDates: bounds.dates,
      availableStores: [...new Set(rows.map((r) => r.storeName).filter(Boolean))].sort(),
      dataset: {
        path: "data/intelligence/sales-customer-jan25-aug26.csv",
        rowCount: rows.length,
        dateRange: bounds,
      },
    });
  } catch (err) {
    console.error("Intelligence API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build report" },
      { status: 500 }
    );
  }
}
