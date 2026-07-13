import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { querySales } from "@/lib/sales/query-sales";
import { ensureActiveSalesVersion } from "@/lib/sales/refresh/service";

const querySchema = z.object({
  user_message: z.string().optional(),
  userMessage: z.string().optional(),
  date_type: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  stores: z.array(z.string()).optional(),
  departments: z.array(z.string()).optional(),
  designs: z.array(z.string()).optional(),
  vendors: z.array(z.string()).optional(),
  classes: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
  groupBy: z.array(z.string()).optional(),
  limit: z.number().optional(),
  navigate: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  await ensureActiveSalesVersion();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Body must be JSON." } },
      { status: 400 }
    );
  }

  const parsed = querySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_BODY", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const b = parsed.data;
  const result = await querySales({
    userMessage: b.user_message ?? b.userMessage,
    dateRange: b.date_type || b.start_date
      ? {
          type: (b.date_type as "custom") || "custom",
          startDate: b.start_date,
          endDate: b.end_date,
        }
      : undefined,
    stores: b.stores,
    departments: b.departments,
    designs: b.designs,
    vendors: b.vendors,
    classes: b.classes,
    metrics: b.metrics as never,
    groupBy: b.groupBy as never,
    limit: b.limit,
    display: b.navigate
      ? { navigateToSales: true, applyDashboardFilters: true }
      : undefined,
  });

  return NextResponse.json({
    ok: result.ok,
    dataVersion: result.freshness?.dataVersion ?? null,
    dataThrough: result.freshness?.dataThrough ?? null,
    appliedFilters: result.query.filters,
    resolvedDateRange: result.query.resolvedDateRange,
    summary: result.summary,
    rankings: result.rankings,
    breakdowns: result.breakdowns,
    comparison: result.comparison,
    coverage: result.coverage,
    freshness: result.freshness,
    warnings: result.warnings,
    textAnswer: result.textAnswer,
    spokenAnswer: result.spokenAnswer,
    dashboardState: result.dashboardState,
    clarification: result.clarification,
    error: result.error,
  });
}
