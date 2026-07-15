import { NextRequest, NextResponse } from "next/server";
import { filterExcludedSalesRows } from "@/lib/utils";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { ensureActiveSalesVersion } from "@/lib/sales/refresh/service";
import { isSalesUnifiedIntelligenceEnabled } from "@/lib/sales/flags";
import { readActivePointer, readNormalizedRows } from "@/lib/sales/data/version-store";
import { getLatestReportWithSummary, readReportCsv } from "@/lib/reports/store";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import type { VendorPosRow } from "@/lib/reports/types";
import Papa from "papaparse";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";

function key(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ");
}

function loadRows(): VendorPosRow[] {
  if (isSalesUnifiedIntelligenceEnabled()) {
    const pointer = readActivePointer();
    const versionRows = pointer.activeVersion
      ? readNormalizedRows(pointer.activeVersion)
      : null;
    if (versionRows?.length) return filterExcludedSalesRows(versionRows);
  }
  const latest = getLatestReportWithSummary();
  if (!latest) return [];
  const csv = readReportCsv(latest.meta.id);
  if (!csv) return [];
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return filterExcludedSalesRows(parseVendorPosRows(parsed.data ?? []).rows);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const skuRaw = (sp.get("sku") ?? sp.get("q") ?? "").trim();
  if (!skuRaw) {
    return NextResponse.json({ error: "Enter a SKU or item number." }, { status: 400 });
  }

  const fromParam = sp.get("from")?.trim() ?? "";
  const toParam = sp.get("to")?.trim() ?? "";
  const dateParam = sp.get("date")?.trim() ?? "";
  const from =
    parseReportFilterDate(fromParam) ??
    (dateParam ? parseReportFilterDate(dateParam) : null);
  const to =
    parseReportFilterDate(toParam) ??
    (dateParam ? parseReportFilterDate(dateParam) : null);

  if (fromParam && (!from || !isValidIsoDate(from))) {
    return NextResponse.json({ error: "Invalid from date." }, { status: 400 });
  }
  if (toParam && (!to || !isValidIsoDate(to))) {
    return NextResponse.json({ error: "Invalid to date." }, { status: 400 });
  }

  if (isSalesUnifiedIntelligenceEnabled()) {
    await ensureActiveSalesVersion();
  }

  const needle = key(skuRaw);
  let rows = loadRows().filter((r) => {
    const sku = key(r.sku || "");
    const item = key(r.itemNumber || "");
    const model = key(r.vendorModel || "");
    return sku === needle || item === needle || model === needle;
  });

  if (from && to) {
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    rows = rows.filter((r) => r.date && r.date >= a && r.date <= b);
  }

  if (!rows.length) {
    return NextResponse.json(
      { error: `No sales found for “${skuRaw}” in the current report.`, sku: skuRaw },
      { status: 404 }
    );
  }

  // Prefer exact SKU/item match over vendor-model alias collisions
  const exact = rows.filter(
    (r) => key(r.sku || "") === needle || key(r.itemNumber || "") === needle
  );
  const matchRows = exact.length ? exact : rows;

  const byStore = new Map<
    string,
    { store: string; units: number; revenue: number; cost: number }
  >();
  let units = 0;
  let netRevenue = 0;
  let grossSales = 0;
  let inventoryCost = 0;
  let discountAmount = 0;
  const txns = new Set<string>();
  let imageDir = "";
  let description = "";
  let vendorModel = "";
  let sku = "";
  let itemNumber = "";
  let design = "";
  let department = "";
  let vendor = "";
  let productClass = "";

  for (const r of matchRows) {
    units += r.quantity;
    netRevenue += r.netRevenue;
    grossSales += r.grossSales;
    inventoryCost += r.inventoryCost;
    discountAmount += r.discountAmount;
    if (r.transactionId) txns.add(r.transactionId);
    if (!imageDir && r.imageDir?.trim()) imageDir = r.imageDir.trim();
    if (!description && r.description) description = r.description;
    if (!vendorModel && r.vendorModel) vendorModel = r.vendorModel;
    if (!sku && r.sku) sku = r.sku;
    if (!itemNumber && r.itemNumber) itemNumber = r.itemNumber;
    if (!design && r.design) design = r.design;
    if (!department && r.department) department = r.department;
    if (!vendor && r.vendor) vendor = r.vendor;
    if (!productClass && r.productClass) productClass = r.productClass;

    const store = r.storeName || "—";
    const cur = byStore.get(store) ?? { store, units: 0, revenue: 0, cost: 0 };
    cur.units += r.quantity;
    cur.revenue += r.netRevenue;
    cur.cost += r.inventoryCost;
    byStore.set(store, cur);
  }

  const profit = netRevenue - inventoryCost;
  const marginRate = netRevenue > 0 ? profit / netRevenue : 0;

  const stores = [...byStore.values()].sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    sku: sku || skuRaw,
    itemNumber: itemNumber || sku || skuRaw,
    vendorModel: vendorModel || null,
    description: description || null,
    design: design || null,
    department: department || null,
    vendor: vendor || null,
    productClass: productClass || null,
    units,
    netRevenue,
    grossSales,
    inventoryCost,
    discountAmount,
    profit,
    marginRate,
    avgSale: units > 0 ? netRevenue / units : 0,
    transactions: txns.size,
    lineCount: matchRows.length,
    imageDir: imageDir || null,
    imageUrl: resolveProductImageUrl(imageDir),
    stores,
    dates: [...new Set(matchRows.map((r) => r.date).filter(Boolean))].sort(),
  });
}
