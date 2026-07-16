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
import {
  groupSalesLookupVariants,
  resolveSalesLookupRows,
} from "@/lib/sales/sku-lookup";

function parseCsvRows(csv: string): VendorPosRow[] {
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return filterExcludedSalesRows(parseVendorPosRows(parsed.data ?? []).rows);
}

function loadRows(): VendorPosRow[] {
  const latest = getLatestReportWithSummary();
  const fromCsv = (): VendorPosRow[] => {
    if (!latest) return [];
    const csv = readReportCsv(latest.meta.id);
    if (!csv) return [];
    return parseCsvRows(csv);
  };

  if (isSalesUnifiedIntelligenceEnabled()) {
    const pointer = readActivePointer();
    const versionRows = pointer.activeVersion
      ? readNormalizedRows(pointer.activeVersion)
      : null;
    if (versionRows?.length) {
      // Stale/test caches (e.g. 4 fixture rows) must not shadow the real report.
      const reportRows = latest?.meta.rowCount ?? 0;
      if (reportRows > 0 && versionRows.length < Math.max(50, reportRows * 0.25)) {
        return fromCsv();
      }
      return filterExcludedSalesRows(versionRows);
    }
  }
  return fromCsv();
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

  let scoped = loadRows();
  if (from && to) {
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    scoped = scoped.filter((r) => r.date && r.date >= a && r.date <= b);
  }

  const { matchRows, matchType } = resolveSalesLookupRows(scoped, skuRaw);

  if (!matchRows.length) {
    return NextResponse.json(
      { error: `No sales found for “${skuRaw}” in the current report.`, sku: skuRaw },
      { status: 404 }
    );
  }

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
  let style = "";
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
    if (!style && r.style) style = r.style;
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
  const variants = groupSalesLookupVariants(matchRows);
  const stores = [...byStore.values()].sort((a, b) => b.revenue - a.revenue);

  // For model-level lookups, surface the model as the primary id (matches Top 20 label).
  const displaySku =
    matchType === "vendorModel"
      ? vendorModel || skuRaw
      : matchType === "style"
        ? style || skuRaw
        : sku || itemNumber || skuRaw;

  return NextResponse.json({
    sku: displaySku,
    itemNumber: itemNumber || sku || skuRaw,
    style: style || null,
    vendorModel: vendorModel || null,
    description: description || null,
    design: design || null,
    department: department || null,
    vendor: vendor || null,
    productClass: productClass || null,
    matchType,
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
    variants: variants.length > 1 ? variants : [],
    dates: [...new Set(matchRows.map((r) => r.date).filter(Boolean))].sort(),
  });
}
