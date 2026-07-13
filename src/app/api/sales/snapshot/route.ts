import { NextRequest, NextResponse } from "next/server";
import {
  compactSnapshotSummary,
  buildSalesDashboardSnapshot,
} from "@/lib/sales/snapshot/builder";
import {
  readActiveSnapshot,
  readNormalizedRows,
  readActivePointer,
} from "@/lib/sales/data/version-store";
import { ensureActiveSalesVersion } from "@/lib/sales/refresh/service";

export async function GET(req: NextRequest) {
  await ensureActiveSalesVersion();
  const full = req.nextUrl.searchParams.get("full") === "1";
  let snapshot = readActiveSnapshot();

  if (!snapshot) {
    const rows = readNormalizedRows();
    const version = readActivePointer().activeVersion ?? "adhoc";
    if (rows?.length) {
      snapshot = buildSalesDashboardSnapshot({ dataVersion: version, rows });
    }
  }

  if (!snapshot) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_SNAPSHOT", message: "No sales snapshot is available." } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    snapshot: full ? snapshot : compactSnapshotSummary(snapshot),
  });
}
