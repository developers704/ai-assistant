import { NextRequest, NextResponse } from "next/server";
import { requireHrSalesAccess } from "@/lib/auth/hr-guard";
import { readSessionFromCookies } from "@/lib/auth/session";
import { isValidIsoDate } from "@/lib/reports/date-utils";
import { buildEmployeeCommissionFromSales } from "@/lib/hr/build-employee-commission";
import { AUGUST_COMMISSION_FROM, AUGUST_COMMISSION_TO } from "@/lib/hr/august-2026-commission-data";
import { salespersonForHrCommissionRequest } from "@/lib/hr/hr-self-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireHrSalesAccess();
  if (denied) return denied;

  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const resolved = salespersonForHrCommissionRequest({
    session,
    requested: req.nextUrl.searchParams.get("salesperson")?.trim() ?? "",
  });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const salesperson = resolved.salesperson;
  const fromRaw = req.nextUrl.searchParams.get("from")?.trim() ?? AUGUST_COMMISSION_FROM;
  const toRaw = req.nextUrl.searchParams.get("to")?.trim() ?? AUGUST_COMMISSION_TO;
  const from = isValidIsoDate(fromRaw) ? fromRaw : AUGUST_COMMISSION_FROM;
  const to = isValidIsoDate(toRaw) ? toRaw : AUGUST_COMMISSION_TO;
  const window = from <= to ? { from, to } : { from: to, to: from };

  const commission = buildEmployeeCommissionFromSales({
    salesperson,
    from: window.from,
    to: window.to,
  });
  if (!commission) {
    return NextResponse.json({ error: "Could not resolve salesperson" }, { status: 404 });
  }
  return NextResponse.json({
    from: window.from,
    to: window.to,
    commission,
  });
}
