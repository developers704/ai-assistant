import { NextResponse } from "next/server";
import { loadRankRows } from "@/lib/reports/load-rank-rows";
import { parseMultiParam } from "@/lib/sales/filter-params";
import { buildVendorModelDetail } from "@/lib/sales/vendor-model-detail";
import { readSessionFromCookies } from "@/lib/auth/session";
import { scopeStoresForUser } from "@/lib/auth/scope-stores";
import { showsAllSoldInTopVendorModels } from "@/lib/auth/user-permissions";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const vendorModel = searchParams.get("vendorModel")?.trim() ?? "";
  const id = searchParams.get("id")?.trim() || undefined;
  const dateFrom = searchParams.get("dateFrom")?.trim().slice(0, 10) || null;
  const dateTo = searchParams.get("dateTo")?.trim().slice(0, 10) || null;
  const requested = parseMultiParam(searchParams, "store", "stores");
  const { stores } = scopeStoresForUser(session, requested);

  if (!vendorModel) {
    return NextResponse.json({ error: "vendorModel is required" }, { status: 400 });
  }

  const fullCsv = showsAllSoldInTopVendorModels(session.username);
  let rows = loadRankRows(id, { skipSalesExclusions: fullCsv });
  if (!rows) {
    return NextResponse.json(
      { error: id ? "Report not found" : "No report available" },
      { status: 404 }
    );
  }

  // Trend scoped to DM stores (admin = all) + optional dashboard date range.
  if (stores?.length) {
    const storeSet = new Set(
      stores.map((s) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[\u2010-\u2015\u2212]/g, "-")
          .replace(/\s+/g, " ")
      )
    );
    rows = rows.filter((r) =>
      storeSet.has(
        (r.storeName || "")
          .trim()
          .toLowerCase()
          .replace(/[\u2010-\u2015\u2212]/g, "-")
          .replace(/\s+/g, " ")
      )
    );
  }

  const detail = buildVendorModelDetail(rows, vendorModel, {
    dateFrom,
    dateTo,
    includeHiddenTopModels: fullCsv,
  });

  if (!detail) {
    return NextResponse.json({ error: "Vendor model not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
