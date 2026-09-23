import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import { canAccessInventoryMgmt, canSeeRealInventoryCost } from "@/lib/auth/user-permissions";
import { parseMultiParam } from "@/lib/sales/filter-params";
import { getLatestReportMeta } from "@/lib/reports/store";
import { getInventoryMgmtDataset } from "@/lib/inventory/mgmt-cache";
import {
  buildModelStoreBreakdownFromStock,
  queryInventoryMgmtFromBase,
} from "@/lib/inventory/mgmt-engine";
import { isInventoryMgmtStore, isInventoryOnhandStore } from "@/lib/inventory/mgmt-stores";
import { isValidIsoDate } from "@/lib/reports/date-utils";
import { resolveProductImageUrl } from "@/lib/reports/product-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessInventoryMgmt(session.username, session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const meta = getLatestReportMeta();
  const defaultFrom = meta?.dateRange?.from ?? "2025-01-01";
  const defaultTo = meta?.dateRange?.to ?? "2026-09-22";
  const from = sp.get("from")?.trim() || defaultFrom;
  const to = sp.get("to")?.trim() || defaultTo;
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  const dateFrom = from <= to ? from : to;
  const dateTo = from <= to ? to : from;
  const viewParam = sp.get("view")?.trim() || "transfers";
  const view = viewParam === "stock" ? "stock" : viewParam === "model" ? "model" : "transfers";
  const sort = sp.get("sort")?.trim() || (view === "stock" ? "onhand" : "priorityRank");
  const dir =
    sp.get("dir") === "asc" || sp.get("dir") === "desc"
      ? (sp.get("dir") as "asc" | "desc")
      : view === "stock"
        ? "desc"
        : "asc";
  const offset = Number(sp.get("offset") ?? 0) || 0;
  const limit = Number(sp.get("limit") ?? 50) || 50;
  const q = sp.get("q")?.trim() || "";

  const stores = parseMultiParam(sp, "store", "stores").filter((s) =>
    view === "stock" ? isInventoryOnhandStore(s) : isInventoryMgmtStore(s)
  );
  const departments = parseMultiParam(sp, "department", "departments");
  const designs = parseMultiParam(sp, "design", "designs");
  const classes = parseMultiParam(sp, "class", "classes");
  const subclasses = parseMultiParam(sp, "subclass", "subclasses");
  const vendors = parseMultiParam(sp, "vendor", "vendors");

  const dataset = getInventoryMgmtDataset(dateFrom, dateTo);

  if (view === "model") {
    const model = sp.get("model")?.trim() || "";
    return NextResponse.json({
      view: "model",
      vendorModel: model,
      stores: buildModelStoreBreakdownFromStock(dataset.base.stock, model),
      dateFrom,
      dateTo,
    });
  }

  const result = queryInventoryMgmtFromBase(dataset.base, {
    dateFrom,
    dateTo,
    stores,
    departments,
    designs,
    classes,
    subclasses,
    vendors,
    q,
    view,
    sort,
    dir,
    offset,
    limit,
  });

  const showCost = canSeeRealInventoryCost(session.username, session.role);
  const rows = result.rows.map((row) => {
    const costPrice = showCost ? row.costPrice : row.wholesaleCost;
    const imageDir = row.imageDir || "";
    return {
      ...row,
      costPrice,
      wholesaleCost: row.wholesaleCost,
      imageDir,
      imageUrl: resolveProductImageUrl(imageDir),
    };
  });

  return NextResponse.json({
    ...result,
    rows,
    dateFrom,
    dateTo,
    availableDates: dataset.availableDates,
    reportRange: { from: defaultFrom, to: defaultTo },
    showCost,
    costLabel: showCost ? "Cost (Kash)" : "Whole cost",
  });
}
