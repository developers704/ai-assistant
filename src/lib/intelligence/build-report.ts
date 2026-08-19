import type { ForecastPoint } from "@/lib/analyst/types";
import { lookupOnhandQty } from "@/lib/inventory/onhand";
import {
  shiftIsoToSameWeekdayLastYear,
  yoyCompareLabelForRange,
} from "@/lib/reports/date-utils";
import { creditSalespersonRows } from "@/lib/sales/salesperson-credit";
import type { VendorPosRow } from "@/lib/reports/types";
import { isWalkInCustomer } from "@/lib/intelligence/customer-id";
import { forecastMonthly } from "@/lib/intelligence/forecast";
import type {
  IntelligenceIssue,
  IntelligenceReport,
  IntelligenceRow,
  ProductInsight,
  RankedMetric,
  StoreDeptDesignCell,
} from "@/lib/intelligence/types";
import { salesUnitsSold } from "@/lib/utils";

function pct(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0;
}

function isProductRow(r: IntelligenceRow): boolean {
  const sku = (r.sku || r.itemNumber || "").trim().toUpperCase();
  if (!sku || sku === "ITEM") return false;
  if (sku.startsWith("JVV-")) return false;
  return Boolean(r.department || r.design || r.vendorModel);
}

type Agg = { net: number; gross: number; disc: number; units: number; txns: Set<string> };

function bump(map: Map<string, Agg>, key: string, r: IntelligenceRow) {
  const cur = map.get(key) ?? { net: 0, gross: 0, disc: 0, units: 0, txns: new Set() };
  cur.net += r.netRevenue;
  cur.gross += r.grossSales;
  cur.disc += r.discountAmount;
  cur.units += salesUnitsSold(r.quantity);
  if (r.transactionId) cur.txns.add(r.transactionId);
  map.set(key, cur);
}

function toRanked(
  map: Map<string, Agg>,
  totalNet: number,
  labelFn: (id: string) => string = (id) => id
): RankedMetric[] {
  return [...map.entries()]
    .map(([id, a]) => ({
      id,
      label: labelFn(id),
      netSales: a.net,
      units: a.units,
      transactions: a.txns.size,
      avgTicket: a.txns.size > 0 ? a.net / a.txns.size : 0,
      discountPct: pct(a.disc, a.gross),
      sharePct: pct(a.net, totalNet),
    }))
    .sort((a, b) => b.netSales - a.netSales || a.label.localeCompare(b.label));
}

function storeMatrix(
  rows: IntelligenceRow[],
  dim: "department" | "design",
  minNet = 500
): {
  cells: StoreDeptDesignCell[];
  bestByDim: Array<{ department: string; store: string; index: number; netSales: number }>;
} {
  const productRows = rows.filter(isProductRow);
  const chainByDim = new Map<string, number>();
  const storeDim = new Map<string, number>();

  for (const r of productRows) {
    const dimVal = (dim === "department" ? r.department : r.design).trim().toUpperCase();
    if (!dimVal) continue;
    chainByDim.set(dimVal, (chainByDim.get(dimVal) ?? 0) + r.netRevenue);
    const sk = `${r.storeName}|${dimVal}`;
    storeDim.set(sk, (storeDim.get(sk) ?? 0) + r.netRevenue);
  }

  const storeCount = new Set(productRows.map((r) => r.storeName)).size || 1;
  const cells: StoreDeptDesignCell[] = [];

  for (const [sk, net] of storeDim) {
    const [store, dimVal] = sk.split("|");
    const chainTotal = chainByDim.get(dimVal!) ?? 0;
    const avgPerStore = chainTotal / storeCount;
    const index = avgPerStore > 0 ? (net / avgPerStore) * 100 : 100;
    if (net < minNet) continue;
    cells.push({
      store: store!,
      department: dim === "department" ? dimVal! : "",
      design: dim === "design" ? dimVal! : "",
      netSales: net,
      units: 0,
      indexVsChain: Math.round(index),
    });
  }

  cells.sort((a, b) => b.indexVsChain - a.indexVsChain || b.netSales - a.netSales);

  const byDim = new Map<string, StoreDeptDesignCell>();
  for (const c of cells) {
    const dimVal = c.department || c.design;
    const prev = byDim.get(dimVal);
    if (!prev || c.indexVsChain > prev.indexVsChain) byDim.set(dimVal, c);
  }

  const bestByDim = [...byDim.entries()]
    .map(([department, c]) => ({
      department,
      store: c.store,
      index: c.indexVsChain,
      netSales: c.netSales,
    }))
    .sort((a, b) => b.netSales - a.netSales);

  return { cells, bestByDim };
}

function buildRetention(rows: IntelligenceRow[]) {
  const byCustomer = new Map<string, { dates: string[]; stores: Set<string> }>();
  for (const r of rows) {
    if (!r.customerId || isWalkInCustomer(r)) continue;
    const cur = byCustomer.get(r.customerId) ?? { dates: [], stores: new Set() };
    cur.dates.push(r.date);
    if (r.storeName) cur.stores.add(r.storeName);
    byCustomer.set(r.customerId, cur);
  }
  let repeat = 0;
  let totalVisits = 0;
  let crossStore = 0;
  const gaps: number[] = [];
  for (const [, v] of byCustomer) {
    const uniqueDates = [...new Set(v.dates)].sort();
    totalVisits += uniqueDates.length;
    if (uniqueDates.length >= 2) {
      repeat++;
      for (let i = 1; i < uniqueDates.length; i++) {
        const a = new Date(`${uniqueDates[i - 1]}T12:00:00Z`).getTime();
        const b = new Date(`${uniqueDates[i]}T12:00:00Z`).getTime();
        gaps.push((b - a) / 86400000);
      }
    }
    if (v.stores.size >= 2) crossStore++;
  }
  const n = byCustomer.size;
  return {
    uniqueCustomers: n,
    repeatCustomers: repeat,
    repeatRatePct: n > 0 ? Math.round(pct(repeat, n) * 10) / 10 : 0,
    avgVisitsPerCustomer: n > 0 ? Math.round((totalVisits / n) * 100) / 100 : 0,
    avgDaysBetweenVisits:
      gaps.length > 0
        ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
        : null,
    crossStoreShoppers: crossStore,
  };
}

function buildDemographics(rows: IntelligenceRow[], field: "zip" | "city") {
  const map = new Map<string, { net: number; customers: Set<string>; txns: Set<string> }>();
  for (const r of rows) {
    if (!r.customerId || isWalkInCustomer(r)) continue;
    const raw = field === "zip" ? r.customerZip : r.customerCity;
    const key = raw.trim().toUpperCase();
    if (!key) continue;
    const cur = map.get(key) ?? { net: 0, customers: new Set(), txns: new Set() };
    cur.net += r.netRevenue;
    cur.customers.add(r.customerId);
    if (r.transactionId) cur.txns.add(r.transactionId);
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      zip: field === "zip" ? key : "",
      city: field === "city" ? key : "",
      netSales: v.net,
      customers: v.customers.size,
      transactions: v.txns.size,
      avgTicket: v.txns.size > 0 ? v.net / v.txns.size : 0,
    }))
    .sort((a, b) => b.netSales - a.netSales)
    .slice(0, 15);
}

function buildProducts(rows: IntelligenceRow[]): {
  topModels: ProductInsight[];
  slowMovers: ProductInsight[];
} {
  const map = new Map<
    string,
    { net: number; units: number; sku: string; dept: string; design: string; store: string }
  >();
  for (const r of rows.filter(isProductRow)) {
    const model = (r.vendorModel || r.sku).trim().toUpperCase();
    if (!model) continue;
    const cur = map.get(model) ?? {
      net: 0,
      units: 0,
      sku: r.sku,
      dept: r.department,
      design: r.design,
      store: r.storeName,
    };
    cur.net += r.netRevenue;
    cur.units += salesUnitsSold(r.quantity);
    map.set(model, cur);
  }

  const topModels: ProductInsight[] = [...map.entries()]
    .map(([vendorModel, v]) => {
      const onHand = lookupOnhandQty(v.sku, v.store);
      const sellThroughPct =
        onHand != null && onHand + v.units > 0
          ? Math.round(pct(v.units, v.units + onHand) * 10) / 10
          : null;
      return {
        vendorModel,
        sku: v.sku,
        department: v.dept,
        design: v.design,
        netSales: v.net,
        units: v.units,
        onHand,
        sellThroughPct,
      };
    })
    .sort((a, b) => b.netSales - a.netSales)
    .slice(0, 20);

  const slowMovers = topModels
    .filter((p) => p.onHand != null && p.onHand >= 3 && (p.sellThroughPct ?? 100) < 25)
    .sort((a, b) => (b.onHand ?? 0) - (a.onHand ?? 0))
    .slice(0, 10);

  return { topModels, slowMovers };
}

function formatMoney(n: number): string {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1000
      ? `$${(n / 1000).toFixed(1)}k`
      : `$${n.toFixed(0)}`;
}

function buildIssues(opts: {
  stores: RankedMetric[];
  yoyNetPct: number | null;
  discountPct: number;
  slowMovers: ProductInsight[];
  storeByDept: StoreDeptDesignCell[];
}): IntelligenceIssue[] {
  const issues: IntelligenceIssue[] = [];
  if (opts.yoyNetPct != null && opts.yoyNetPct < -5) {
    issues.push({
      severity: "high",
      category: "Revenue",
      title: "Net sales down vs same period last year",
      detail: `Overall net is ${opts.yoyNetPct.toFixed(1)}% vs prior year.`,
      solution:
        "Review stores with the largest YoY drops; push top departments that still index above 110.",
    });
  }
  if (opts.discountPct > 18) {
    issues.push({
      severity: "medium",
      category: "Margin",
      title: "High chain-wide discount rate",
      detail: `Average discount is ${opts.discountPct.toFixed(1)}% of gross.`,
      solution: "Check Discounting flags and coach on DM minimum pricing.",
    });
  }
  for (const s of opts.stores.filter((x) => x.discountPct > 25).slice(0, 3)) {
    issues.push({
      severity: "medium",
      category: "Store",
      title: `${s.label} — elevated discounts`,
      detail: `${s.discountPct.toFixed(1)}% discount rate on ${formatMoney(s.netSales)} net.`,
      solution: "Audit top discounted SKUs; verify approver memos on financing packages.",
      store: s.label,
      metric: `${s.discountPct.toFixed(1)}% disc`,
    });
  }
  for (const s of opts.stores.slice(0, 5)) {
    if (s.indexVsChain != null && s.indexVsChain < 85) {
      issues.push({
        severity: "low",
        category: "Store",
        title: `${s.label} underperforming vs chain`,
        detail: `Store index ${s.indexVsChain} (100 = average).`,
        solution: "Compare department strengths — reallocate top sellers from high-index stores.",
        store: s.label,
      });
    }
  }
  if (opts.slowMovers.length >= 3) {
    issues.push({
      severity: "medium",
      category: "Inventory",
      title: "Slow-moving models with high on-hand",
      detail: `${opts.slowMovers.length} models show low sell-through with 3+ units on hand.`,
      solution: "Consider transfers, remerchandising, or targeted promotions by store.",
    });
  }
  for (const c of opts.storeByDept.filter((x) => x.indexVsChain < 70).slice(0, 3)) {
    issues.push({
      severity: "low",
      category: "Department",
      title: `${c.store} weak in ${c.department || c.design}`,
      detail: `Index ${c.indexVsChain} vs chain for this category.`,
      solution:
        "Compare with best store for this category; review assortment and associate training.",
      store: c.store,
    });
  }
  return issues.slice(0, 12);
}

function buildBrief(report: Omit<IntelligenceReport, "brief">): string {
  const lines: string[] = [];
  lines.push(
    `${formatMoney(report.summary.netSales)} net across ${report.summary.storeCount} stores · ${report.summary.customerCount.toLocaleString()} customers.`
  );
  if (report.summary.yoyNetPct != null) {
    lines.push(
      `YoY ${report.summary.yoyNetPct >= 0 ? "+" : ""}${report.summary.yoyNetPct.toFixed(1)}% ${report.summary.yoyLabel.replace(/^vs /, "")}.`
    );
  }
  if (report.bestStoreByDepartment[0]) {
    const b = report.bestStoreByDepartment[0];
    lines.push(`Top department lead: ${b.store} in ${b.department} (index ${b.index}).`);
  }
  if (report.customers.retention.repeatRatePct > 0) {
    lines.push(
      `Repeat customer rate ${report.customers.retention.repeatRatePct}% · ${report.customers.crossStoreShoppers.toLocaleString()} shop multiple stores.`
    );
  }
  if (report.forecast.projectedMonthNet) {
    lines.push(
      `Next month projection ~${formatMoney(report.forecast.projectedMonthNet)}${report.forecast.trendPct != null ? ` (${report.forecast.trendPct >= 0 ? "+" : ""}${report.forecast.trendPct}% MoM trend)` : ""}.`
    );
  }
  if (report.issues[0]) {
    lines.push(`Priority: ${report.issues[0].title}.`);
  }
  return lines.join(" ");
}

export function buildIntelligenceReport(
  allRows: IntelligenceRow[],
  opts?: { dateFrom?: string | null; dateTo?: string | null; store?: string | null }
): IntelligenceReport | null {
  if (!allRows.length) return null;

  const bounds = {
    from: allRows.reduce((m, r) => (r.date < m ? r.date : m), allRows[0]!.date),
    to: allRows.reduce((m, r) => (r.date > m ? r.date : m), allRows[0]!.date),
  };
  const dateFrom = opts?.dateFrom?.trim() || bounds.from;
  const dateTo = opts?.dateTo?.trim() || bounds.to;
  const storeFilter = opts?.store?.trim().toUpperCase() || null;

  let rows = allRows.filter((r) => r.date >= dateFrom && r.date <= dateTo);
  if (storeFilter) rows = rows.filter((r) => r.storeName.toUpperCase() === storeFilter);
  if (!rows.length) return null;

  const lyFrom = shiftIsoToSameWeekdayLastYear(dateFrom);
  const lyTo = shiftIsoToSameWeekdayLastYear(dateTo);
  let lyRows = allRows.filter((r) => r.date >= lyFrom && r.date <= lyTo);
  if (storeFilter) lyRows = lyRows.filter((r) => r.storeName.toUpperCase() === storeFilter);

  const totalNet = rows.reduce((s, r) => s + r.netRevenue, 0);
  const totalGross = rows.reduce((s, r) => s + r.grossSales, 0);
  const totalDisc = rows.reduce((s, r) => s + r.discountAmount, 0);
  const totalUnits = rows.reduce((s, r) => s + salesUnitsSold(r.quantity), 0);
  const txns = new Set(rows.map((r) => r.transactionId).filter(Boolean));
  const lyNet = lyRows.reduce((s, r) => s + r.netRevenue, 0);
  const yoyNetPct = lyNet > 0 ? ((totalNet - lyNet) / lyNet) * 100 : null;

  const storeMap = new Map<string, Agg>();
  const deptMap = new Map<string, Agg>();
  const designMap = new Map<string, Agg>();
  for (const r of rows) {
    if (r.storeName) bump(storeMap, r.storeName, r);
    if (r.department) bump(deptMap, r.department, r);
    if (r.design) bump(designMap, r.design, r);
  }

  const stores = toRanked(storeMap, totalNet);
  const chainAvgStore = stores.length > 0 ? totalNet / stores.length : 0;
  for (const s of stores) {
    s.indexVsChain =
      chainAvgStore > 0 ? Math.round((s.netSales / chainAvgStore) * 100) : 100;
  }

  const deptMatrix = storeMatrix(rows, "department");
  const designMatrix = storeMatrix(rows, "design");

  const spCredits = creditSalespersonRows(rows as unknown as VendorPosRow[]);
  const spByDept = new Map<string, Map<string, number>>();
  for (const r of rows.filter(isProductRow)) {
    const splits = r.salespersons.match(/([A-Za-z0-9_.-]+)\s*\/\s*(\d+(?:\.\d+)?)\s*%/g);
    if (!splits?.length || !r.department) continue;
    for (const token of splits) {
      const m = token.match(/([A-Za-z0-9_.-]+)\s*\/\s*(\d+(?:\.\d+)?)\s*%/);
      if (!m) continue;
      const code = m[1]!.toUpperCase();
      const share = parseFloat(m[2]!) / 100;
      const bag = spByDept.get(code) ?? new Map();
      bag.set(r.department, (bag.get(r.department) ?? 0) + r.netRevenue * share);
      spByDept.set(code, bag);
    }
  }

  const salespersons = spCredits.slice(0, 25).map((sp) => {
    const deptBag = spByDept.get(sp.code);
    let topDepartment = "";
    let topVal = 0;
    if (deptBag) {
      for (const [d, v] of deptBag) {
        if (v > topVal) {
          topVal = v;
          topDepartment = d;
        }
      }
    }
    return {
      code: sp.code,
      name: sp.name,
      netSales: sp.netSales,
      units: sp.units,
      avgTicket: sp.transactions > 0 ? sp.netSales / sp.transactions : 0,
      topDepartment,
      topDesign: "",
      deptIndex: 0,
    };
  });

  const retention = buildRetention(rows);
  const customerCount = retention.uniqueCustomers;
  const { crossStoreShoppers, ...retentionCore } = retention;

  const monthlyMap = new Map<string, number>();
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + r.netRevenue);
  }
  const monthly = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, net]) => ({ month, net }));
  const fc = forecastMonthly(monthly, 3);

  const products = buildProducts(rows);
  const issues = buildIssues({
    stores,
    yoyNetPct,
    discountPct: pct(totalDisc, totalGross),
    slowMovers: products.slowMovers,
    storeByDept: deptMatrix.cells,
  });

  const partial: Omit<IntelligenceReport, "brief"> = {
    generatedAt: new Date().toISOString(),
    filter: { dateFrom, dateTo, store: storeFilter },
    dateRange: bounds,
    rowCount: rows.length,
    summary: {
      netSales: totalNet,
      grossSales: totalGross,
      discountPct: Math.round(pct(totalDisc, totalGross) * 10) / 10,
      units: totalUnits,
      transactions: txns.size,
      avgTicket: txns.size > 0 ? totalNet / txns.size : 0,
      yoyNetPct: yoyNetPct != null ? Math.round(yoyNetPct * 10) / 10 : null,
      yoyLabel: yoyCompareLabelForRange({ from: dateFrom, to: dateTo }),
      storeCount: stores.length,
      customerCount,
    },
    stores,
    departments: toRanked(deptMap, totalNet).slice(0, 20),
    designs: toRanked(designMap, totalNet).slice(0, 20),
    storeByDepartment: deptMatrix.cells.slice(0, 80),
    storeByDesign: designMatrix.cells.slice(0, 80),
    bestStoreByDepartment: deptMatrix.bestByDim.slice(0, 15),
    bestStoreByDesign: designMatrix.bestByDim.slice(0, 15).map((r) => ({
      design: r.department,
      store: r.store,
      index: r.index,
      netSales: r.netSales,
    })),
    salespersons,
    customers: {
      retention: retentionCore,
      topZips: buildDemographics(rows, "zip"),
      topCities: buildDemographics(rows, "city"),
      crossStoreShoppers,
    },
    products,
    forecast: {
      monthly: fc.points,
      projectedMonthNet: fc.projectedNext,
      trendPct: fc.trendPct,
    },
    issues,
  };

  return { ...partial, brief: buildBrief(partial) };
}
