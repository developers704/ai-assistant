import { NextRequest, NextResponse } from "next/server";
import {
  detectHighDiscounts,
  formatHighDiscountsMarkdown,
} from "@/lib/discounting/detect-high-discounts";
import { DEFAULT_DISCOUNTING_ROLES } from "@/lib/discounting/approvers";
import { isValidIsoDate } from "@/lib/reports/date-utils";
import { readSessionFromCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get("date")?.trim() || null;
  const storeParam = req.nextUrl.searchParams.get("store")?.trim() || null;
  const format = req.nextUrl.searchParams.get("format")?.trim() || "json";

  if (dateParam && !isValidIsoDate(dateParam)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    const result = detectHighDiscounts({
      filterDate: dateParam,
      filterStore: storeParam,
      roles: DEFAULT_DISCOUNTING_ROLES,
    });

    if (format === "markdown") {
      return NextResponse.json({
        markdown: formatHighDiscountsMarkdown(result),
        filterDate: result.filterDate,
        count: result.hits.length,
      });
    }

    const stores = [
      ...new Set(result.hits.map((h) => h.store).filter(Boolean)),
    ].sort();

    return NextResponse.json({
      filterDate: result.filterDate,
      availableDates: result.availableDates,
      stores,
      scannedProductLines: result.scannedProductLines,
      skippedNoApprover: result.skippedNoApprover,
      skippedNoPricing: result.skippedNoPricing,
      count: result.hits.length,
      hits: result.hits,
    });
  } catch (err) {
    console.error("discounting API failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to scan discounts" },
      { status: 500 }
    );
  }
}
