import type { SalesSummary } from "@/types";
import type { ReportPeriod, ReportSummary, VendorPosRow } from "./types";

function parseNumber(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  const s = String(raw).trim().replace(/[$,]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${y}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
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
  const itemCol = findCol(columns, [/^item\s*#?$/, /^item number$/]);
  const qtyCol = findCol(columns, [/^qty$/, /quantity/]);
  const grossCol = findCol(columns, [/sales amount/]);
  const discCol = findCol(columns, [/disc amt/, /discount amt/]);
  const netCol = findCol(columns, [/^total$/]);
  const discRateCol = findCol(columns, [/disc rate/, /discount rate/]);
  const vendorCol = findCol(columns, [/^vendor\s*#?$/, /^vendor$/]);
  const typeCol = findCol(columns, [/^type$/]);

  const rows: VendorPosRow[] = [];
  for (const rec of records) {
    const net = netCol ? parseNumber(rec[netCol]) : 0;
    const gross = grossCol ? parseNumber(rec[grossCol]) : net;
    const qty = qtyCol ? parseNumber(rec[qtyCol]) : 1;
    const store = storeCol ? String(rec[storeCol] ?? "").trim() : "";
    const department = deptCol ? String(rec[deptCol] ?? "").trim() : "";
    const date = dateCol ? normalizeDate(rec[dateCol]) : null;

    if (!store && !department && net === 0 && qty === 0) continue;
    if (typeCol && String(rec[typeCol] ?? "").toLowerCase() === "return" && net < 0) {
      // keep returns — real business data
    }

    rows.push({
      date: date ?? "",
      storeName: store || "Unknown store",
      department: department || "Uncategorized",
      design: designCol ? String(rec[designCol] ?? "").trim() || "—" : "—",
      itemNumber: itemCol ? String(rec[itemCol] ?? "").trim() : "",
      description: descCol ? String(rec[descCol] ?? "").trim() || department : department,
      vendor: vendorCol ? String(rec[vendorCol] ?? "").trim().toUpperCase() : "",
      quantity: qty || 1,
      grossSales: gross,
      discountAmount: discCol ? parseNumber(rec[discCol]) : Math.max(0, gross - net),
      netRevenue: netCol ? net : gross,
      discountRate: discRateCol ? parseNumber(rec[discRateCol]) : 0,
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
  const map = new Map<string, { revenue: number; units: number }>();
  for (const r of rows) {
    const k = key(r);
    if (!k || k === "—") continue;
    const ex = map.get(k) || { revenue: 0, units: 0 };
    map.set(k, { revenue: ex.revenue + value(r), units: ex.units + units(r) });
  }
  return [...map.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function rankProducts(rows: VendorPosRow[], limit = 10) {
  const map = new Map<
    string,
    { name: string; itemNumber?: string; revenue: number; units: number }
  >();

  for (const r of rows) {
    const label = r.description?.trim();
    const itemNumber = r.itemNumber?.trim();
    if (!label && !itemNumber) continue;

    const key = itemNumber ? `item:${itemNumber}` : `desc:${label}`;
    const existing = map.get(key) || {
      name: label || itemNumber || "Unknown item",
      itemNumber: itemNumber || undefined,
      revenue: 0,
      units: 0,
    };

    map.set(key, {
      name: label || existing.name,
      itemNumber: itemNumber || existing.itemNumber,
      revenue: existing.revenue + r.netRevenue,
      units: existing.units + r.quantity,
    });
  }

  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, limit);
}

export function summarizeVendorPos(
  rows: VendorPosRow[],
  opts: {
    period: ReportPeriod;
    vendorCode?: string | null;
    reportId?: string;
    reportLabel?: string;
  }
): { summary: ReportSummary; reportDate: string | null; columns: string[] } {
  const dated = rows.filter((r) => r.date);
  const dates = [...new Set(dated.map((r) => r.date))].sort();
  const dateFrom = dates[0] ?? null;
  const dateTo = dates[dates.length - 1] ?? null;
  const reportDate = dateTo;

  const periodRows =
    opts.period === "daily" && dates.length === 1
      ? rows.filter((r) => r.date === dateTo)
      : rows;

  const compareRows =
    opts.period === "daily" && dates.length === 2
      ? rows.filter((r) => r.date === dates[dates.length - 2])
      : opts.period === "daily" && dates.length > 2
        ? []
        : [];

  const totalRevenue = periodRows.reduce((s, r) => s + r.netRevenue, 0);
  const grossSales = periodRows.reduce((s, r) => s + r.grossSales, 0);
  const discountTotal = periodRows.reduce((s, r) => s + r.discountAmount, 0);
  const totalUnits = periodRows.reduce((s, r) => s + r.quantity, 0);
  const prevRevenue = compareRows.reduce((s, r) => s + r.netRevenue, 0);
  const comparisonPreviousDay =
    opts.period === "daily" && compareRows.length > 0 && prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : 0;

  const topStores = rankMap(
    periodRows,
    (r) => r.storeName,
    (r) => r.netRevenue,
    (r) => r.quantity,
    10
  ).map((s) => {
    const prev = compareRows
      .filter((r) => r.storeName === s.name)
      .reduce((sum, r) => sum + r.netRevenue, 0);
    return {
      name: s.name,
      revenue: s.revenue,
      change: prev > 0 ? ((s.revenue - prev) / prev) * 100 : 0,
    };
  });

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

  const topProducts = rankProducts(periodRows, 10);

  const underperformingStores = topStores.filter((s) => s.change < 0);
  const avgDiscountRate =
    periodRows.length > 0
      ? periodRows.reduce((s, r) => s + (r.discountRate > 1 ? r.discountRate / 100 : r.discountRate), 0) /
        periodRows.length
      : 0;

  const recommendations: string[] = [];
  const vendor = opts.vendorCode || periodRows.find((r) => r.vendor)?.vendor || "Vendor";

  if (opts.period !== "daily" || dates.length <= 1) {
    recommendations.push(
      `${periodLabel(opts.period)} ${vendor} report: ${totalUnits.toLocaleString()} units, ${formatMoney(totalRevenue)} net across ${dates.length || 1} day(s).`
    );
  }
  if (topDesigns[0]) {
    recommendations.push(`${topDesigns[0].name} leads design lines at ${formatMoney(topDesigns[0].revenue)} net.`);
  }
  if (topDepartments[0]) {
    recommendations.push(`Top department: ${topDepartments[0].name} (${formatMoney(topDepartments[0].revenue)}).`);
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
    topProducts,
    underperformingStores,
    recommendations,
  };

  return {
    summary: {
      ...base,
      source: "report",
      reportId: opts.reportId,
      reportLabel: opts.reportLabel,
      reportDate,
      schema: "vendor_pos",
      reportPeriod: opts.period,
      reportCategory: "vendor",
      vendorCode: vendor,
      grossSales,
      discountTotal,
      avgDiscountRate,
      dateRange: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined,
      topDepartments,
      topDesigns,
      transactionCount: periodRows.length,
    },
    reportDate,
    columns: [
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
