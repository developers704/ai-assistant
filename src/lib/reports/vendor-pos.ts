import type { SalesSummary } from "@/types";
import { filterExcludedSalesRows, isExcludedSalesRow } from "@/lib/utils";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";
import { skuLinesForModel } from "@/lib/sales/sales-aggregate";
import { creditSalespersonRows } from "@/lib/sales/salesperson-credit";
import type { ReportPeriod, ReportSummary, VendorPosRow } from "./types";

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseNumber(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  const s = String(raw).trim().replace(/[$,]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  // Excel/JS Date objects — use UTC calendar day to avoid TZ day-shift.
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getUTCFullYear()}-${String(raw.getUTCMonth() + 1).padStart(2, "0")}-${String(raw.getUTCDate()).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  const parsed = parseReportFilterDate(s);
  if (parsed && isValidIsoDate(parsed)) return parsed;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const iso = s.slice(0, 10);
    return isValidIsoDate(iso) ? iso : null;
  }
  // Do not use `new Date(s)` — locale/TZ parsing swaps MDY and shifts days.
  return null;
}

function findCol(columns: string[], patterns: RegExp[]): string | null {
  for (const col of columns) {
    const t = col.trim().toLowerCase();
    if (patterns.some((p) => p.test(t))) return col;
  }
  return null;
}

export function isVendorPosFormat(columns: string[]): boolean {
  const lower = columns.map((c) => c.trim().toLowerCase());
  return (
    lower.some((c) => c === "total") &&
    lower.some((c) => c.includes("department")) &&
    (lower.some((c) => c.startsWith("vendor")) || lower.includes("store"))
  );
}

export function isStoreSalesCsv(columns: string[]): boolean {
  const lower = columns.map((c) => c.trim().toLowerCase());
  const hasProductId = lower.some((c) => c.includes("sku") || /^item\s*#?$/.test(c));
  return (
    lower.some((c) => c.includes("transaction") && c.includes("#")) &&
    hasProductId &&
    lower.some((c) => c === "store") &&
    lower.some((c) => c === "total")
  );
}

export function parseVendorPosRows(records: Record<string, unknown>[]): {
  rows: VendorPosRow[];
  columns: string[];
} {
  if (records.length === 0) return { rows: [], columns: [] };

  const columns = Object.keys(records[0]).map((c) => c.trim());
  const dateCol = findCol(columns, [/transaction\s*date/, /^date$/]) ?? findCol(columns, [/date/]);
  const storeCol = findCol(columns, [/^store$/]);
  const deptCol = findCol(columns, [/^department$/]);
  const designCol = findCol(columns, [/^design$/]);
  const descCol = findCol(columns, [/^description$/]);
  // Umair / POS variants: "Item  #", "SKU  #", or "SKU #"
  const itemCol = findCol(columns, [/^item\s*#?$/, /^item number$/]);
  const skuCol = findCol(columns, [/^sku\s*#?$/]);
  const styleCol = findCol(columns, [/^style\s*#?$/]);
  const txnCol = findCol(columns, [/transaction\s*#/, /^transaction id$/]);
  const qtyCol = findCol(columns, [/^qty$/, /quantity/]);
  const grossCol = findCol(columns, [/sales amount/]);
  const discCol = findCol(columns, [/disc amt/, /discount amt/]);
  const netCol = findCol(columns, [/^total$/]);
  const invCostCol = findCol(columns, [/inventory cost/]);
  const classCol = findCol(columns, [/^class$/]);
  const subClassCol = findCol(columns, [/sub-class/, /sub class/]);
  const discRateCol = findCol(columns, [/disc rate/, /discount rate/]);
  const vendorCol = findCol(columns, [/^vendor\s*name$/, /^vendor\s*#?$/, /^vendor$/]);
  // Umair export uses "VendorModel1"; standard feeds use "Vendor Model"
  const vendorModelCol = findCol(columns, [
    /^vendor\s*model\s*1?$/,
    /^vendormodel1?$/,
    /^vendor\s*model$/,
  ]);
  const imageDirCol = findCol(columns, [/^image\s*dir\.?$/, /^image\s*directory$/, /^image$/]);
  const salespersonsCol = findCol(columns, [/^sales\s*persons?$/]);
  const typeCol = findCol(columns, [/^type$/]);

  const rows: VendorPosRow[] = [];
  for (const rec of records) {
    const net = netCol ? parseNumber(rec[netCol]) : 0;
    const gross = grossCol ? parseNumber(rec[grossCol]) : net;
    const qty = qtyCol ? parseNumber(rec[qtyCol]) : 1;
    const inventoryCost = invCostCol ? parseNumber(rec[invCostCol]) : 0;
    const store = storeCol ? String(rec[storeCol] ?? "").trim() : "";
    const department = deptCol ? String(rec[deptCol] ?? "").trim() : "";
    const date = dateCol ? normalizeDate(rec[dateCol]) : null;
    const txnId = txnCol ? String(rec[txnCol] ?? "").trim() : "";
    const rawItem = itemCol ? String(rec[itemCol] ?? "").trim() : "";
    const rawSku = skuCol ? String(rec[skuCol] ?? "").trim() : "";
    // Either column is the product id — keep both fields populated for lookups / Top 20
    const sku = rawSku || rawItem;
    const itemNumber = rawItem || rawSku;
    const margin = net - inventoryCost;

    if (!store && !department && net === 0 && qty === 0) continue;
    if (!date && !txnId && !store) continue;
    if (typeCol && String(rec[typeCol] ?? "").toLowerCase() === "return" && net < 0) {
      // keep returns — real business data
    }

    rows.push({
      date: date ?? "",
      transactionId: txnId,
      storeName: store || "Unknown store",
      // Keep blank — excluded later by filterExcludedSalesRows (do not invent "Uncategorized")
      department,
      design: designCol ? String(rec[designCol] ?? "").trim() : "",
      itemNumber,
      sku,
      style: styleCol ? String(rec[styleCol] ?? "").trim() : "",
      description: descCol ? String(rec[descCol] ?? "").trim() || department : department,
      vendor: vendorCol ? String(rec[vendorCol] ?? "").trim().toUpperCase() : "",
      vendorModel: vendorModelCol ? String(rec[vendorModelCol] ?? "").trim() : "",
      productClass: classCol ? String(rec[classCol] ?? "").trim() : "",
      subClass: subClassCol ? String(rec[subClassCol] ?? "").trim() : "",
      quantity: qty === 0 || qty == null || Number.isNaN(qty) ? 1 : qty,
      inventoryCost,
      grossSales: gross,
      discountAmount: discCol ? parseNumber(rec[discCol]) : Math.max(0, gross - net),
      netRevenue: netCol ? net : gross,
      margin,
      discountRate: discRateCol ? parseNumber(rec[discRateCol]) : 0,
      imageDir: imageDirCol ? String(rec[imageDirCol] ?? "").trim() : "",
      salespersons: salespersonsCol
        ? String(rec[salespersonsCol] ?? "").trim()
        : undefined,
    });
  }

  return { rows, columns };
}

function rankMap(
  rows: VendorPosRow[],
  key: (r: VendorPosRow) => string,
  value: (r: VendorPosRow) => number,
  units: (r: VendorPosRow) => number,
  limit = 8
) {
  const map = new Map<
    string,
    { revenue: number; units: number; imageDir?: string; imageRevenue: number }
  >();
  for (const r of rows) {
    const k = key(r).trim();
    if (!k || k === "—") continue;
    const ex = map.get(k) || { revenue: 0, units: 0, imageRevenue: -1 };
    const next = {
      revenue: ex.revenue + value(r),
      units: ex.units + units(r),
      imageDir: ex.imageDir,
      imageRevenue: ex.imageRevenue,
    };
    // Keep image from the highest-revenue line that has an Image Dir.
    const dir = r.imageDir?.trim();
    if (dir && r.netRevenue > next.imageRevenue) {
      next.imageDir = dir;
      next.imageRevenue = r.netRevenue;
    }
    map.set(k, next);
  }
  return [...map.entries()]
    .map(([name, stats]) => ({
      name,
      revenue: stats.revenue,
      units: stats.units,
      imageDir: stats.imageDir,
      imageUrl: resolveProductImageUrl(stats.imageDir) ?? undefined,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/** All vendor models for display — sorted by qty then revenue (includes SKU + store breakdown). */
function rankProducts(rows: VendorPosRow[], limit?: number | null) {
  const map = new Map<
    string,
    {
      name: string;
      itemNumber?: string;
      vendorModel?: string;
      imageDir?: string;
      revenue: number;
      units: number;
      margin: number;
      rows: VendorPosRow[];
    }
  >();

  for (const r of rows) {
    if (isExcludedSalesRow(r)) continue;

    const sku = r.sku?.trim() ?? "";
    const itemNumber = sku || r.itemNumber?.trim() || "";
    const vendorModel = r.vendorModel?.trim() || "";
    const key = vendorModel
      ? `model:${vendorModel.toUpperCase()}`
      : itemNumber
        ? `item:${itemNumber}`
        : "";
    if (!key) continue;

    const label = r.description?.trim();
    const existing = map.get(key) || {
      name: label || vendorModel || itemNumber || "Unknown item",
      itemNumber: itemNumber || undefined,
      vendorModel: vendorModel || undefined,
      imageDir: r.imageDir?.trim() || undefined,
      revenue: 0,
      units: 0,
      margin: 0,
      rows: [],
    };
    existing.rows.push(r);

    map.set(key, {
      name: label || existing.name,
      itemNumber: existing.itemNumber || itemNumber || undefined,
      vendorModel: vendorModel || existing.vendorModel,
      imageDir: existing.imageDir || r.imageDir?.trim() || undefined,
      revenue: existing.revenue + r.netRevenue,
      units: existing.units + r.quantity,
      margin: existing.margin + r.margin,
      rows: existing.rows,
    });
  }

  const ranked = [...map.values()].sort(
    (a, b) => b.units - a.units || b.revenue - a.revenue
  );
  const sliced =
    limit == null || limit <= 0 ? ranked : ranked.slice(0, limit);

  return sliced.map(({ rows: modelRows, ...p }) => {
    const skus = skuLinesForModel(modelRows);
    return {
      ...p,
      skus: skus.length ? skus : undefined,
      marginRate: p.revenue > 0 ? p.margin / p.revenue : 0,
      imageUrl: resolveProductImageUrl(p.imageDir),
    };
  });
}

export function summarizeVendorPos(
  rows: VendorPosRow[],
  opts: {
    period: ReportPeriod;
    vendorCode?: string | null;
    reportId?: string;
    reportLabel?: string;
    filterDate?: string;
    /** Inclusive ISO range (overrides single filterDate when both set). */
    filterDateFrom?: string;
    filterDateTo?: string;
    filterStore?: string;
    filterStores?: string[];
    filterDepartment?: string;
    filterDepartments?: string[];
    filterDesign?: string;
    filterDesigns?: string[];
    filterClass?: string;
    filterClasses?: string[];
    filterVendor?: string;
    filterVendors?: string[];
    schema?: "vendor_pos" | "store_sales";
    reportCategory?: import("./types").ReportCategory;
  }
): { summary: ReportSummary; reportDate: string | null; columns: string[] } {
  const dated = rows.filter((r) => r.date);
  const dates = [...new Set(dated.map((r) => r.date))].sort();
  const dateFrom = dates[0] ?? null;
  const dateTo = dates[dates.length - 1] ?? null;
  const reportDate = opts.filterDate ?? dateTo;

  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/\s+/g, " ");

  let periodRows = filterExcludedSalesRows(rows);
  let compareRows: VendorPosRow[] = [];

  const rangeFrom = opts.filterDateFrom;
  const rangeTo = opts.filterDateTo;
  const hasRange =
    Boolean(rangeFrom && rangeTo && isValidIsoDate(rangeFrom) && isValidIsoDate(rangeTo));

  if (hasRange && rangeFrom && rangeTo) {
    const from = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
    const to = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
    periodRows = periodRows.filter((r) => r.date && r.date >= from && r.date <= to);
    // Prior period of equal length for % change when possible
    const spanDays =
      Math.round(
        (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000
      ) + 1;
    const prevEnd = shiftIso(from, -1);
    const prevStart = shiftIso(prevEnd, -(spanDays - 1));
    compareRows = filterExcludedSalesRows(rows).filter(
      (r) => r.date && r.date >= prevStart && r.date <= prevEnd
    );
  } else if (opts.filterDate) {
    periodRows = periodRows.filter((r) => r.date === opts.filterDate);
    const idx = dates.indexOf(opts.filterDate);
    if (idx > 0) {
      compareRows = filterExcludedSalesRows(rows).filter((r) => r.date === dates[idx - 1]);
    }
  } else if (opts.period === "daily" && dates.length === 1) {
    periodRows = periodRows.filter((r) => r.date === dateTo);
  } else if (opts.period === "daily" && dates.length === 2) {
    compareRows = filterExcludedSalesRows(rows).filter(
      (r) => r.date === dates[dates.length - 2]
    );
  }

  const storeList =
    opts.filterStores?.length
      ? opts.filterStores
      : opts.filterStore
        ? [opts.filterStore]
        : [];
  const deptList =
    opts.filterDepartments?.length
      ? opts.filterDepartments
      : opts.filterDepartment
        ? [opts.filterDepartment]
        : [];
  const designList =
    opts.filterDesigns?.length
      ? opts.filterDesigns
      : opts.filterDesign
        ? [opts.filterDesign]
        : [];
  const vendorList =
    opts.filterVendors?.length
      ? opts.filterVendors
      : opts.filterVendor
        ? [opts.filterVendor]
        : [];
  const classList =
    opts.filterClasses?.length
      ? opts.filterClasses
      : opts.filterClass
        ? [opts.filterClass]
        : [];

  if (storeList.length) {
    const set = new Set(storeList.map(norm));
    periodRows = periodRows.filter((r) => set.has(norm(r.storeName)));
    compareRows = compareRows.filter((r) => set.has(norm(r.storeName)));
  }
  if (deptList.length) {
    const set = new Set(deptList.map(norm));
    periodRows = periodRows.filter((r) => set.has(norm(r.department)));
    compareRows = compareRows.filter((r) => set.has(norm(r.department)));
  }
  if (designList.length) {
    const set = new Set(designList.map(norm));
    periodRows = periodRows.filter((r) => set.has(norm(r.design)));
    compareRows = compareRows.filter((r) => set.has(norm(r.design)));
  }
  if (vendorList.length) {
    const set = new Set(vendorList.map(norm));
    periodRows = periodRows.filter((r) => set.has(norm(r.vendor)));
    compareRows = compareRows.filter((r) => set.has(norm(r.vendor)));
  }
  if (classList.length) {
    const set = new Set(classList.map(norm));
    periodRows = periodRows.filter((r) => set.has(norm(r.productClass)));
    compareRows = compareRows.filter((r) => set.has(norm(r.productClass)));
  }

  const totalRevenue = periodRows.reduce((s, r) => s + r.netRevenue, 0);
  const grossSales = periodRows.reduce((s, r) => s + r.grossSales, 0);
  const discountTotal = periodRows.reduce((s, r) => s + r.discountAmount, 0);
  const totalUnits = periodRows.reduce((s, r) => s + r.quantity, 0);
  const totalInventoryCost = periodRows.reduce((s, r) => s + r.inventoryCost, 0);
  const totalMargin = periodRows.reduce((s, r) => s + r.margin, 0);
  const marginRate = totalRevenue > 0 ? totalMargin / totalRevenue : 0;
  const uniqueTransactions = new Set(
    periodRows.map((r) => r.transactionId).filter(Boolean)
  ).size;
  const prevRevenue = compareRows.reduce((s, r) => s + r.netRevenue, 0);
  const comparisonPreviousDay =
    compareRows.length > 0 && prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : 0;

  const storeChange = (storeName: string, revenue: number) => {
    const prev = compareRows
      .filter((r) => r.storeName === storeName)
      .reduce((sum, r) => sum + r.netRevenue, 0);
    return prev > 0 ? ((revenue - prev) / prev) * 100 : 0;
  };

  const allStoresRanked = rankMap(
    periodRows,
    (r) => r.storeName,
    (r) => r.netRevenue,
    (r) => r.quantity,
    500
  );

  // Full list highest → lowest for Store Performance (single scroll).
  const topStores = allStoresRanked.map((s) => ({
    name: s.name,
    revenue: s.revenue,
    change: storeChange(s.name, s.revenue),
    imageDir: s.imageDir,
    imageUrl: s.imageUrl,
  }));

  const worstStores = [...allStoresRanked]
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, 10)
    .map((s) => ({
      name: s.name,
      revenue: s.revenue,
      change: storeChange(s.name, s.revenue),
      imageDir: s.imageDir,
      imageUrl: s.imageUrl,
    }));

  const topDepartments = rankMap(
    periodRows,
    (r) => r.department,
    (r) => r.netRevenue,
    (r) => r.quantity
  );

  const topDesigns = rankMap(
    periodRows,
    (r) => r.design,
    (r) => r.netRevenue,
    (r) => r.quantity
  );

  const topVendors = rankMap(
    periodRows,
    (r) => r.vendor,
    (r) => r.netRevenue,
    (r) => r.quantity
  );

  const topClasses = rankMap(
    periodRows,
    (r) => r.productClass,
    (r) => r.netRevenue,
    (r) => r.quantity
  );

  const topSubClasses = rankMap(
    periodRows,
    (r) => r.subClass,
    (r) => r.netRevenue,
    (r) => r.quantity
  );

  const topProducts = rankProducts(periodRows);

  const topSalesPeople = creditSalespersonRows(periodRows)
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      code: p.code,
      revenue: p.netSales,
      units: p.units,
    }));

  const underperformingStores = topStores.filter((s) => s.change < 0);
  const avgDiscountRate =
    periodRows.length > 0
      ? periodRows.reduce((s, r) => s + (r.discountRate > 1 ? r.discountRate / 100 : r.discountRate), 0) /
        periodRows.length
      : 0;

  const recommendations: string[] = [];
  const isStoreSales = opts.schema === "store_sales" || opts.reportCategory === "sales";
  const vendor = opts.vendorCode || periodRows.find((r) => r.vendor)?.vendor || "Vendor";

  if (isStoreSales) {
    recommendations.push(
      `Store sales: ${formatMoney(totalRevenue)} net across ${uniqueTransactions || periodRows.length} transactions, ${totalUnits.toLocaleString()} units.`
    );
  } else if (opts.period !== "daily" || dates.length <= 1) {
    recommendations.push(
      `${periodLabel(opts.period)} ${vendor} report: ${totalUnits.toLocaleString()} units, ${formatMoney(totalRevenue)} net across ${dates.length || 1} day(s).`
    );
  }
  if (topStores[0]) {
    recommendations.push(`Top store: ${topStores[0].name} at ${formatMoney(topStores[0].revenue)} net.`);
  }
  if (topDesigns[0]) {
    recommendations.push(`${topDesigns[0].name} leads design lines at ${formatMoney(topDesigns[0].revenue)} net.`);
  }
  if (topDepartments[0]) {
    recommendations.push(`Top department: ${topDepartments[0].name} (${formatMoney(topDepartments[0].revenue)}).`);
  }
  if (topVendors[0] && isStoreSales) {
    recommendations.push(`Top vendor: ${topVendors[0].name} (${formatMoney(topVendors[0].revenue)}).`);
  }
  if (topSalesPeople[0] && isStoreSales) {
    recommendations.push(
      `Top salesperson: ${topSalesPeople[0].name} (${formatMoney(topSalesPeople[0].revenue)} credited).`
    );
  }
  if (discountTotal > 0) {
    recommendations.push(
      `Total discounts: ${formatMoney(discountTotal)} (${((discountTotal / grossSales) * 100 || 0).toFixed(1)}% of gross).`
    );
  }
  if (underperformingStores.length > 0 && opts.period === "daily" && compareRows.length > 0) {
    recommendations.push(`${underperformingStores[0].name} is down vs prior day in this file.`);
  }

  const base: SalesSummary = {
    totalRevenue,
    totalTransactions: totalUnits,
    averageOrderValue: totalUnits > 0 ? totalRevenue / totalUnits : 0,
    comparisonPreviousDay,
    comparisonPreviousWeek: 0,
    topStores,
    worstStores,
    topProducts,
    underperformingStores,
    recommendations,
  };

  const schema = opts.schema ?? "vendor_pos";
  const category = opts.reportCategory ?? (schema === "store_sales" ? "sales" : "vendor");

  return {
    summary: {
      ...base,
      source: "report",
      reportId: opts.reportId,
      reportLabel: opts.reportLabel,
      reportDate,
      schema,
      reportPeriod: opts.period,
      reportCategory: category,
      vendorCode: isStoreSales ? undefined : vendor,
      grossSales,
      discountTotal,
      avgDiscountRate,
      totalInventoryCost,
      totalMargin,
      marginRate,
      uniqueTransactions: uniqueTransactions || periodRows.length,
      dateRange:
        opts.filterDate
          ? { from: opts.filterDate, to: opts.filterDate }
          : dateFrom && dateTo
            ? { from: dateFrom, to: dateTo }
            : undefined,
      topDepartments,
      topDesigns,
      topVendors,
      topClasses,
      topSubClasses,
      topSalesPeople,
      transactionCount: periodRows.length,
    },
    reportDate,
    columns: isStoreSales
      ? [
          "Transaction #",
          "Transaction Date",
          "SKU #",
          "Style #",
          "Description",
          "Vendor Model",
          "Vendor Name",
          "Store",
          "Department",
          "Design",
          "Class",
          "Sub-Class",
          "Qty",
          "Inventory Cost",
          "Sales Amount",
          "Disc Amt",
          "Total",
          "Image Dir.",
        ]
      : [
          "Transaction Date",
          "Store",
          "Department",
          "Design",
          "Description",
          "Qty",
          "Sales Amount",
          "Disc Amt",
          "Total",
          "Vendor #",
        ],
  };
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function periodLabel(period: ReportPeriod): string {
  switch (period) {
    case "daily":
      return "Daily";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "half_yearly":
      return "Half-yearly";
    case "yearly":
      return "Yearly";
    default:
      return "Period";
  }
}
