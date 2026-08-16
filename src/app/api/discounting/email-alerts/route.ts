import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import { isGoogleConnected } from "@/lib/google/token-store";
import { sendDiscountingEmailAlerts } from "@/lib/discounting/email-alerts";
import { isValidIsoDate } from "@/lib/reports/date-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleConnected()) {
    return NextResponse.json(
      {
        error:
          "Gmail is not connected in this app process. Open Settings and connect Google, then retry.",
      },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    date?: string;
    dryRun?: boolean;
    transactionId?: string;
    sku?: string;
  };
  const date = body.date?.trim() || null;
  if (date && !isValidIsoDate(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const results = await sendDiscountingEmailAlerts({
    filterDate: date,
    dryRun: body.dryRun === true,
    transactionId: body.transactionId?.trim() || null,
    sku: body.sku?.trim() || null,
  });

  return NextResponse.json({
    dryRun: body.dryRun === true,
    googleConnected: true,
    results,
  });
}
