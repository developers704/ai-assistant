import { NextResponse } from "next/server";
import { loadRankRows } from "@/lib/reports/load-rank-rows";
import { parseMultiParam } from "@/lib/sales/filter-params";
import { buildVendorModelDetail } from "@/lib/sales/vendor-model-detail";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vendorModel = searchParams.get("vendorModel")?.trim() ?? "";
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;
  const date = searchParams.get("date")?.trim() || undefined;
  const id = searchParams.get("id")?.trim() || undefined;
  const stores = parseMultiParam(searchParams, "store", "stores");

  if (!vendorModel) {
    return NextResponse.json({ error: "vendorModel is required" }, { status: 400 });
  }

  let rows = loadRankRows(id);
  if (!rows) {
    return NextResponse.json(
      { error: id ? "Report not found" : "No report available" },
      { status: 404 }
    );
  }

  let dateFrom = from;
  let dateTo = to;
  if (!dateFrom && !dateTo && date) {
    dateFrom = date;
    dateTo = date;
  }

  if (stores.length) {
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
    dateFrom: dateFrom ?? null,
    dateTo: dateTo ?? null,
  });

  if (!detail) {
    return NextResponse.json({ error: "Vendor model not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
