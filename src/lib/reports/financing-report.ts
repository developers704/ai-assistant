import type { SalesSummary } from "@/types";
import type { ReportPeriod, ReportSummary } from "./types";

export interface FinancingRow {
  date: string;
  store: string;
  transactionId: string;
  type: string;
  payMethod: string;
  payCode: string;
  paymentChannel: string;
  financingProvider: string;
  netAmount: number;
  profit: number;
  salesPerson: string;
  customerName: string;
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

export function isFinancingReportFormat(columns: string[]): boolean {
  const lower = columns.map((c) => c.trim().toLowerCase());
  return (
    lower.some((c) => c === "pay method" || c.includes("pay method")) &&
    lower.some((c) => c.includes("transaction date")) &&
    (lower.some((c) => c.includes("net amt")) ||
      lower.some((c) => c === "total") ||
      lower.some((c) => c.includes("payment amt")))
  );
}

function resolvePaymentChannel(payMethod: string): string {
  switch (payMethod.trim().toUpperCase()) {
    case "CA":
      return "Cash";
    case "CC":
      return "Credit Card";
    case "OTH":
      return "Financing";
    case "CHK":
      return "Check";
    default:
      return payMethod.trim() || "Unknown";
  }
}

function resolveFinancingProvider(payMethod: string, payCode: string): string {
  const code = payCode.trim().toUpperCase();
  const method = payMethod.trim().toUpperCase();

  if (method === "CA" || code.includes("CASH")) return "Cash";
  if (code.includes("ACIMA")) return "Acima";
  if (code.includes("SYNY")) return "Synchrony";
  if (code.includes("IDDEAL") || code.includes("IDEA")) return "Ideale";
  if (code.includes("KAFE")) return "Kafene";
  if (code.includes("WELLS")) return "Wells Fargo";
  if (code.includes("PROG")) return "Progressive";
  if (code.includes("UOWN")) return "UOwn";
  if (code.includes("AFFIRM")) return "Affirm";
  if (code.includes("ACIMA")) return "Acima";
  if (method === "CC" || code.includes("-CC")) return "Credit Card";
  if (method === "OTH") return "Other Financing";
  return payCode.trim() || resolvePaymentChannel(payMethod);
}

function isSalesRow(type: string): boolean {
  return /sales/i.test(type);
}

export function parseFinancingRows(records: Record<string, unknown>[]): {
  rows: FinancingRow[];
  columns: string[];
} {
  if (records.length === 0) return { rows: [], columns: [] };

  const columns = Object.keys(records[0]).map((c) => c.trim());
  const dateCol = findCol(columns, [/transaction\s*date/, /^date$/]);
  const storeCol = findCol(columns, [/^store$/]);
  const typeCol = findCol(columns, [/^type$/]);
  const payMethodCol = findCol(columns, [/pay\s*method/]);
  const payCodeCol = findCol(columns, [/pay\s*code/]);
  const netCol =
    findCol(columns, [/^net\s*amt$/]) ??
    findCol(columns, [/^total$/]) ??
    findCol(columns, [/payment\s*amt/, /applied\s*amt/]);
  const profitCol = findCol(columns, [/^profit$/]);
  const txnCol = findCol(columns, [/transaction\s*#/]);
  const salesPersonCol = findCol(columns, [/sales\s*person/]);
  const customerCol = findCol(columns, [/customer\s*name/]);

  const rows: FinancingRow[] = [];

  for (const rec of records) {
    const type = typeCol ? String(rec[typeCol] ?? "").trim() : "";
    if (!isSalesRow(type)) continue;

    const netAmount = netCol ? parseNumber(rec[netCol]) : 0;
    if (netAmount === 0) continue;

    const payMethod = payMethodCol ? String(rec[payMethodCol] ?? "").trim() : "";
    const payCode = payCodeCol ? String(rec[payCodeCol] ?? "").trim() : "";

    rows.push({
      date: (dateCol ? normalizeDate(rec[dateCol]) : null) ?? "",
      store: storeCol ? String(rec[storeCol] ?? "").trim() || "Unknown store" : "Unknown store",
      transactionId: txnCol ? String(rec[txnCol] ?? "").trim() : "",
      type,
      payMethod,
      payCode,
      paymentChannel: resolvePaymentChannel(payMethod),
      financingProvider: resolveFinancingProvider(payMethod, payCode),
      netAmount,
      profit: profitCol ? parseNumber(rec[profitCol]) : 0,
      salesPerson: salesPersonCol ? String(rec[salesPersonCol] ?? "").trim() : "",
      customerName: customerCol ? String(rec[customerCol] ?? "").trim() : "",
    });
  }

  return { rows, columns };
}

function rankBy<T>(
  items: T[],
  keyFn: (item: T) => string,
  revenueFn: (item: T) => number,
  countFn: (item: T) => number
) {
  const map = new Map<string, { revenue: number; units: number }>();
  for (const item of items) {
    const key = keyFn(item).trim() || "Unknown";
    const ex = map.get(key) ?? { revenue: 0, units: 0 };
    map.set(key, {
      revenue: ex.revenue + revenueFn(item),
      units: ex.units + countFn(item),
    });
  }
  return Array.from(map.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

function sharePct(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

export function summarizeFinancing(
  rows: FinancingRow[],
  opts: {
    period: ReportPeriod;
    reportId?: string;
    reportLabel?: string;
    filterDate?: string;
  }
): {
  summary: ReportSummary;
  reportDate: string | null;
  columns: string[];
} {
  if (rows.length === 0) {
    throw new Error("No sales rows found in financing report.");
  }

  const dates = [...new Set(rows.map((r) => r.date).filter(Boolean))].sort();
  const dateFrom = dates[0] ?? null;
  const dateTo = dates[dates.length - 1] ?? null;
  const reportDate = opts.filterDate ?? dateTo;

  let periodRows = rows;
  let compareRows: FinancingRow[] = [];

  if (opts.filterDate) {
    periodRows = rows.filter((r) => r.date === opts.filterDate);
    const idx = dates.indexOf(opts.filterDate);
    if (idx > 0) {
      compareRows = rows.filter((r) => r.date === dates[idx - 1]);
    }
  } else if (opts.period === "daily" && dates.length <= 1) {
    periodRows = dateTo ? rows.filter((r) => r.date === dateTo) : rows;
  }

  const totalRevenue = periodRows.reduce((s, r) => s + r.netAmount, 0);
  const totalProfit = periodRows.reduce((s, r) => s + r.profit, 0);
  const prevRevenue = compareRows.reduce((s, r) => s + r.netAmount, 0);
  const comparisonPreviousDay =
    compareRows.length > 0 && prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : 0;

  const paymentMethods = rankBy(
    periodRows,
    (r) => r.paymentChannel,
    (r) => r.netAmount,
    () => 1
  ).map((p) => ({ ...p, share: sharePct(p.revenue, totalRevenue) }));

  const financingProviders = rankBy(
    periodRows,
    (r) => r.financingProvider,
    (r) => r.netAmount,
    () => 1
  ).map((p) => ({ ...p, share: sharePct(p.revenue, totalRevenue) }));

  const topStores = rankBy(
    periodRows,
    (r) => r.store,
    (r) => r.netAmount,
    () => 1
  )
    .slice(0, 10)
    .map((s) => ({
      name: s.name,
      revenue: s.revenue,
      change: 0,
    }));

  const worstStores = [...topStores]
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, 10);

  const topSalesPeople = rankBy(
    periodRows,
    (r) => r.salesPerson,
    (r) => r.netAmount,
    () => 1
  ).slice(0, 10);

  const cashRevenue =
    paymentMethods.find((p) => p.name === "Cash")?.revenue ?? 0;
  const creditRevenue =
    paymentMethods.find((p) => p.name === "Credit Card")?.revenue ?? 0;
  const financingRevenue =
    paymentMethods.find((p) => p.name === "Financing")?.revenue ?? 0;

  const recommendations: string[] = [
    `Financing report: ${periodRows.length.toLocaleString()} sales transactions, ${formatMoney(totalRevenue)} net.`,
  ];

  if (paymentMethods[0]) {
    recommendations.push(
      `${paymentMethods[0].name} leads payment mix at ${paymentMethods[0].share.toFixed(1)}% (${formatMoney(paymentMethods[0].revenue)}).`
    );
  }

  const topFinancing = financingProviders.find(
    (p) => !["Cash", "Credit Card"].includes(p.name)
  );
  if (topFinancing && financingRevenue > 0) {
    recommendations.push(
      `Top financing program: ${topFinancing.name} (${formatMoney(topFinancing.revenue)}, ${topFinancing.share.toFixed(1)}% of all sales).`
    );
  }

  if (topStores[0]) {
    recommendations.push(`Top store: ${topStores[0].name} (${formatMoney(topStores[0].revenue)}).`);
  }

  if (totalProfit > 0) {
    recommendations.push(`Total profit: ${formatMoney(totalProfit)}.`);
  }

  const base: SalesSummary = {
    totalRevenue,
    totalTransactions: periodRows.length,
    averageOrderValue: periodRows.length > 0 ? totalRevenue / periodRows.length : 0,
    comparisonPreviousDay,
    comparisonPreviousWeek: 0,
    topStores,
    worstStores,
    topProducts: financingProviders.slice(0, 10).map((p) => ({
      name: p.name,
      revenue: p.revenue,
      units: p.units,
    })),
    underperformingStores: [],
    recommendations,
  };

  return {
    summary: {
      ...base,
      source: "report",
      reportId: opts.reportId,
      reportLabel: opts.reportLabel,
      reportDate,
      schema: "financing",
      reportPeriod: opts.period,
      reportCategory: "financing",
      dateRange:
        opts.filterDate
          ? { from: opts.filterDate, to: opts.filterDate }
          : dateFrom && dateTo
            ? { from: dateFrom, to: dateTo }
            : undefined,
      transactionCount: periodRows.length,
      totalProfit,
      paymentMethods,
      financingProviders,
      topSalesPeople,
      cashRate: sharePct(cashRevenue, totalRevenue),
      creditCardRate: sharePct(creditRevenue, totalRevenue),
      financingRate: sharePct(financingRevenue, totalRevenue),
    },
    reportDate,
    columns: [
      "Store",
      "Transaction Date",
      "Type",
      "Pay Method",
      "Pay Code",
      "Net Amt",
      "Profit",
      "Sales Person",
      "Customer Name",
    ],
  };
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
