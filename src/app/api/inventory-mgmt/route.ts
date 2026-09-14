import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import { getPermissionMapForUser } from "@/lib/auth/user-permissions-store";
import { canSeeRealInventoryCost } from "@/lib/auth/user-permissions";
import { parseMultiParam } from "@/lib/sales/filter-params";
import { filterRows } from "@/lib/sales/sales-aggregate";
import { loadRankRows } from "@/lib/reports/load-rank-rows";
import { getLatestReportMeta } from "@/lib/reports/store";
import { listInventoryItems } from "@/lib/inventory/store";
import { queryInventoryMgmt } from "@/lib/inventory/mgmt-engine";
import { isInventoryMgmtStore, listInventoryMgmtStores } from "@/lib/inventory/mgmt-stores";
import { isValidIsoDate } from "@/lib/reports/date-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    const map = getPermissionMapForUser(session.username, session.role);
    if (!map.sales_dashboard) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const sp = req.nextUrl.searchParams;
  const meta = getLatestReportMeta();
  const defaultTo = meta?.dateRange?.to ?? "2026-09-13";
  const from = sp.get("from")?.trim() || "2025-01-01";
  const to = sp.get("to")?.trim() || defaultTo;
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  const dateFrom = from <= to ? from : to;
  const dateTo = from <= to ? to : from;
  const view = sp.get("view") === "stock" ? "stock" : "transfers";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const sort = sp.get("sort")?.trim() || (view === "stock" ? "onhand" : "soldQty");
  const offset = Number(sp.get("offset") ?? 0) || 0;
  const limit = Number(sp.get("limit") ?? 50) || 50;
  const q = sp.get("q")?.trim() || "";

  const stores = parseMultiParam(sp, "store", "stores").filter(isInventoryMgmtStore);
  const departments = parseMultiParam(sp, "department", "departments");
  const designs = parseMultiParam(sp, "design", "designs");
  const classes = parseMultiParam(sp, "class", "classes");
  const subclasses = parseMultiParam(sp, "subclass", "subclasses");
  const vendors = parseMultiParam(sp, "vendor", "vendors");

  const sales = filterRows(loadRankRows() ?? [], {
    dateFrom,
    dateTo,
    stores: stores.length ? stores : listInventoryMgmtStores().map((s) => s.store),
    departments,
    designs,
    classes,
    subclasses,
    vendors,
  });
  const items = listInventoryItems().filter((item) => isInventoryMgmtStore(item.store));

  const result = queryInventoryMgmt(sales, items, {
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
    return { ...row, costPrice, wholesaleCost: row.wholesaleCost };
  });

  return NextResponse.json({
    ...result,
    rows,
    dateFrom,
    dateTo,
    showCost,
    costLabel: showCost ? "Cost (Kash)" : "Whole cost",
  });
}
