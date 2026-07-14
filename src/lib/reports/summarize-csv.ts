import Papa from "papaparse";
import type { SalesSummary } from "@/types";
import { filterExcludedSalesRows } from "@/lib/utils";
import {
  detectReportCategory,
  detectReportPeriod,
  detectVendorCode,
} from "./detect-report";
import type { ReportCategory, ReportPeriod, ReportSummary } from "./types";
import { isFinancingReportFormat, parseFinancingRows, summarizeFinancing } from "./financing-report";
import { isStoreSalesFormat } from "./detect-report";
import { isStoreSalesCsv, isVendorPosFormat, parseVendorPosRows, summarizeVendorPos } from "./vendor-pos";

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
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${y}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function pickColumn(columns: string[], patterns: RegExp[]): string | null {
  for (const col of columns) {
    const lower = col.trim().toLowerCase();
    if (patterns.some((p) => p.test(lower))) return col;
  }
  return null;
}

interface NormalizedRow {
  date: string;
  storeName: string;
  productName: string;
  quantity: number;
  revenue: number;
}

function normalizeGenericRows(records: Record<string, unknown>[]): {
  rows: NormalizedRow[];
  columns: string[];
} {
  if (records.length === 0) return { rows: [], columns: [] };
  const columns = Object.keys(records[0]).map((c) => c.trim());

  const dateCol =
    pickColumn(columns, [/transaction\s*date/, /^date$/, /sale.?date/]) ??
    columns.find((c) => /date/i.test(c)) ??
    null;

  const storeCol =
    pickColumn(columns, [/^store$/, /location/, /branch/]) ??
    columns.find((c) => /store|location/i.test(c)) ??
    null;

  const productCol =
    pickColumn(columns, [/^description$/, /product/, /item/]) ??
    pickColumn(columns, [/department/]) ??
    null;

  const revenueCol =
    pickColumn(columns, [/^total$/, /^revenue$/, /net.?sales/]) ??
    pickColumn(columns, [/sales amount/, /^sales$/]) ??
    null;

  const qtyCol = pickColumn(columns, [/^qty$/, /quantity/]) ?? null;

  const rows: NormalizedRow[] = [];
  for (const rec of records) {
    const date = dateCol ? normalizeDate(rec[dateCol]) : null;
    const revenue = revenueCol ? parseNumber(rec[revenueCol]) : 0;
    const quantity = qtyCol ? parseNumber(rec[qtyCol]) : revenue > 0 ? 1 : 0;
    const storeName = storeCol ? String(rec[storeCol] ?? "").trim() || "Unknown store" : "All stores";
    const productName = productCol
      ? String(rec[productCol] ?? "").trim() || "Unknown item"
      : "Line item";

    if (!date && revenue === 0 && quantity === 0) continue;

    rows.push({
      date: date ?? new Date().toISOString().slice(0, 10),
      storeName,
      productName,
      quantity: quantity || 1,
      revenue,
    });
  }

  return { rows, columns };
}

function buildSummaryForDate(rows: NormalizedRow[], date: string, prevDate: string): SalesSummary {
  const todayData = rows.filter((r) => r.date === date);
  const prevData = rows.filter((r) => r.date === prevDate);

  const totalRevenue = todayData.reduce((s, r) => s + r.revenue, 0);
  const prevRevenue = prevData.reduce((s, r) => s + r.revenue, 0);
  const comparisonPreviousDay =
    prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const storeMap = new Map<string, number>();
  const prevStoreMap = new Map<string, number>();
  todayData.forEach((r) => storeMap.set(r.storeName, (storeMap.get(r.storeName) || 0) + r.revenue));
  prevData.forEach((r) =>
    prevStoreMap.set(r.storeName, (prevStoreMap.get(r.storeName) || 0) + r.revenue)
  );

  const topStores = Array.from(storeMap.entries())
    .map(([name, revenue]) => ({
      name,
      revenue,
      change: prevStoreMap.has(name)
        ? ((revenue - (prevStoreMap.get(name) || 0)) / (prevStoreMap.get(name) || 1)) * 100
        : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const productMap = new Map<string, { revenue: number; units: number }>();
  todayData.forEach((r) => {
    const existing = productMap.get(r.productName) || { revenue: 0, units: 0 };
    productMap.set(r.productName, {
      revenue: existing.revenue + r.revenue,
      units: existing.units + r.quantity,
    });
  });

  const topProducts = Array.from(productMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units);

  const worstStores = [...topStores].sort((a, b) => a.revenue - b.revenue).slice(0, 10);
  const underperformingStores = topStores.filter((s) => s.change < 0);
  const totalUnits = todayData.reduce((s, r) => s + r.quantity, 0);

  const recommendations: string[] = [];
  if (comparisonPreviousDay < 0) {
    recommendations.push("Sales are down vs the previous period in your uploaded report.");
  }
  if (underperformingStores.length > 0) {
    recommendations.push(
      `${underperformingStores[0].name} declined ${Math.abs(underperformingStores[0].change).toFixed(1)}% — review staffing and display.`
    );
  }
  if (topProducts.length > 0) {
    recommendations.push(`${topProducts[0].name} leads revenue in this report.`);
  }

  return {
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
}

function resolveDates(rows: NormalizedRow[]): { date: string; prevDate: string } {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const date = dates[dates.length - 1] ?? new Date().toISOString().split("T")[0];
  const dateIdx = dates.indexOf(date);
  if (dateIdx > 0) {
    return { date, prevDate: dates[dateIdx - 1] };
  }
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return { date, prevDate: d.toISOString().slice(0, 10) };
}

function summarizeGeneric(
  records: Record<string, unknown>[],
  opts: {
    period: ReportPeriod;
    category: ReportCategory;
    fileName: string;
    reportId?: string;
    reportLabel?: string;
  }
): {
  rowCount: number;
  columns: string[];
  reportDate: string | null;
  summary: ReportSummary;
  dateRange?: { from: string; to: string };
  schema: "generic";
} {
  const { rows, columns } = normalizeGenericRows(records);
  if (rows.length === 0) {
    throw new Error("No usable data rows found in the CSV.");
  }

  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const reportDate = dates[dates.length - 1] ?? null;

  let summaryBase: SalesSummary;
  if (opts.period === "daily" && dates.length <= 1) {
    const { date, prevDate } = resolveDates(rows);
    summaryBase = buildSummaryForDate(rows, date, prevDate);
  } else {
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);
    const storeMap = new Map<string, number>();
    rows.forEach((r) => storeMap.set(r.storeName, (storeMap.get(r.storeName) || 0) + r.revenue));
    const topStores = Array.from(storeMap.entries())
      .map(([name, revenue]) => ({ name, revenue, change: 0 }))
      .sort((a, b) => b.revenue - a.revenue);
    const worstStores = [...topStores].sort((a, b) => a.revenue - b.revenue).slice(0, 10);
    const productMap = new Map<string, { revenue: number; units: number }>();
    rows.forEach((r) => {
      const ex = productMap.get(r.productName) || { revenue: 0, units: 0 };
      productMap.set(r.productName, {
        revenue: ex.revenue + r.revenue,
        units: ex.units + r.quantity,
      });
    });
    const topProducts = Array.from(productMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue || b.units - a.units);

    summaryBase = {
      totalRevenue,
      totalTransactions: totalUnits,
      averageOrderValue: totalUnits > 0 ? totalRevenue / totalUnits : 0,
      comparisonPreviousDay: 0,
      comparisonPreviousWeek: 0,
      topStores,
      worstStores,
      topProducts,
      underperformingStores: [],
      recommendations: [`${opts.period} sales report loaded with ${rows.length.toLocaleString()} rows.`],
    };
  }

  return {
    rowCount: rows.length,
    columns,
    reportDate,
    schema: "generic",
    dateRange:
      dates[0] && reportDate ? { from: dates[0], to: reportDate } : undefined,
    summary: {
      ...summaryBase,
      source: "report",
      reportId: opts.reportId,
      reportLabel: opts.reportLabel,
      reportDate,
      schema: "generic",
      reportPeriod: opts.period,
      reportCategory: opts.category,
      dateRange:
        dates[0] && reportDate ? { from: dates[0], to: reportDate } : undefined,
      transactionCount: rows.length,
    },
  };
}

export interface SummarizeOptions {
  reportId?: string;
  reportLabel?: string;
  fileName?: string;
  reportPeriod?: ReportPeriod;
  reportCategory?: ReportCategory;
  /** ISO date YYYY-MM-DD — show metrics for this day only. */
  filterDate?: string;
  filterStore?: string;
  filterDepartment?: string;
  filterDesign?: string;
  filterClass?: string;
  filterVendor?: string;
}

export function summarizeCsvText(
  csvText: string,
  meta?: SummarizeOptions
): {
  rowCount: number;
  columns: string[];
  reportDate: string | null;
  summary: ReportSummary;
  reportPeriod: ReportPeriod;
  reportCategory: ReportCategory;
  vendorCode: string | null;
  schema: "generic" | "vendor_pos" | "store_sales" | "financing";
  dateRange?: { from: string; to: string };
} {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error("Could not parse CSV. Check the file format.");
  }

  const records = parsed.data.filter((row) =>
    Object.values(row).some((v) => v != null && String(v).trim() !== "")
  );

  const fileName = meta?.fileName ?? meta?.reportLabel ?? "report.csv";
  const columns = records.length > 0 ? Object.keys(records[0]).map((c) => c.trim()) : [];
  const reportPeriod = meta?.reportPeriod ?? detectReportPeriod(fileName, meta?.reportLabel);
  const reportCategory = meta?.reportCategory ?? detectReportCategory(fileName, columns);
  const vendorCode = detectVendorCode(fileName, records, columns);

  if (isFinancingReportFormat(columns) || reportCategory === "financing") {
    const { rows } = parseFinancingRows(records);
    if (rows.length === 0) throw new Error("No sales rows found in financing report.");
    const result = summarizeFinancing(rows, {
      period: reportPeriod,
      reportId: meta?.reportId,
      reportLabel: meta?.reportLabel,
      filterDate: meta?.filterDate,
    });
    return {
      rowCount: rows.length,
      columns: result.columns,
      reportDate: result.reportDate,
      summary: result.summary,
      reportPeriod,
      reportCategory: "financing",
      vendorCode: null,
      schema: "financing",
      dateRange: result.summary.dateRange,
    };
  }

  if (isStoreSalesCsv(columns) || isStoreSalesFormat(columns) || reportCategory === "sales") {
    const { rows } = parseVendorPosRows(records);
    if (rows.length === 0) throw new Error("No usable store sales rows found in the CSV.");
    const result = summarizeVendorPos(rows, {
      period: reportPeriod,
      vendorCode: null,
      reportId: meta?.reportId,
      reportLabel: meta?.reportLabel,
      filterDate: meta?.filterDate,
      filterStore: meta?.filterStore,
      filterDepartment: meta?.filterDepartment,
      filterDesign: meta?.filterDesign,
      filterClass: meta?.filterClass,
      filterVendor: meta?.filterVendor,
      schema: "store_sales",
      reportCategory: "sales",
    });
    return {
      rowCount: rows.length,
      columns: result.columns,
      reportDate: result.reportDate,
      summary: result.summary,
      reportPeriod,
      reportCategory: "sales",
      vendorCode: null,
      schema: "store_sales",
      dateRange: result.summary.dateRange,
    };
  }

  if (isVendorPosFormat(columns) || reportCategory === "vendor") {
    const { rows } = parseVendorPosRows(records);
    if (rows.length === 0) throw new Error("No usable vendor sales rows found in the CSV.");
    const result = summarizeVendorPos(rows, {
      period: reportPeriod,
      vendorCode,
      reportId: meta?.reportId,
      reportLabel: meta?.reportLabel,
      filterDate: meta?.filterDate,
      filterStore: meta?.filterStore,
      filterDepartment: meta?.filterDepartment,
      filterDesign: meta?.filterDesign,
      filterClass: meta?.filterClass,
      filterVendor: meta?.filterVendor,
      schema: "vendor_pos",
      reportCategory: "vendor",
    });
    return {
      rowCount: rows.length,
      columns: result.columns,
      reportDate: result.reportDate,
      summary: result.summary,
      reportPeriod,
      reportCategory: "vendor",
      vendorCode: vendorCode ?? result.summary.vendorCode ?? null,
      schema: "vendor_pos",
      dateRange: result.summary.dateRange,
    };
  }

  const generic = summarizeGeneric(records, {
    period: reportPeriod,
    category: reportCategory,
    fileName,
    reportId: meta?.reportId,
    reportLabel: meta?.reportLabel,
  });

  return {
    ...generic,
    reportPeriod,
    reportCategory,
    vendorCode,
  };
}

/** Unique transaction dates in a report CSV (ISO YYYY-MM-DD, sorted). */
export function extractReportDates(csvText: string): string[] {
  return extractReportDimensions(csvText).dates;
}

/** Unique filter values from a report CSV (after excluded-row rules). */
export function extractReportDimensions(csvText: string): {
  dates: string[];
  stores: string[];
  departments: string[];
  designs: string[];
  classes: string[];
  vendors: string[];
} {
  const empty = {
    dates: [] as string[],
    stores: [] as string[],
    departments: [] as string[],
    designs: [] as string[],
    classes: [] as string[],
    vendors: [] as string[],
  };
  try {
    const parsed = Papa.parse<Record<string, unknown>>(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (h) => h.trim(),
    });
    const records = parsed.data.filter((row) =>
      Object.values(row).some((v) => v != null && String(v).trim() !== "")
    );
    if (records.length === 0) return empty;

    const columns = Object.keys(records[0]).map((c) => c.trim());

    if (isFinancingReportFormat(columns)) {
      const { rows } = parseFinancingRows(records);
      return {
        dates: [...new Set(rows.map((r) => r.date).filter(Boolean))].sort(),
        stores: [...new Set(rows.map((r) => r.store).filter(Boolean))].sort(),
        departments: [],
        designs: [],
        classes: [],
        vendors: [],
      };
    }

    if (
      isStoreSalesCsv(columns) ||
      isStoreSalesFormat(columns) ||
      isVendorPosFormat(columns)
    ) {
      const { rows } = parseVendorPosRows(records);
      const kept = filterExcludedSalesRows(rows);
      return {
        dates: [...new Set(kept.map((r) => r.date).filter(Boolean))].sort(),
        stores: [...new Set(kept.map((r) => r.storeName).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        ),
        departments: [...new Set(kept.map((r) => r.department).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        ),
        designs: [...new Set(kept.map((r) => r.design).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        ),
        classes: [...new Set(kept.map((r) => r.productClass).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        ),
        vendors: [...new Set(kept.map((r) => r.vendor).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        ),
      };
    }

    return empty;
  } catch {
    return empty;
  }
}
