import type { VendorPosRow } from "@/lib/reports/types";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { skuLinesForModel } from "@/lib/sales/sales-aggregate";
import {
  collapseCancelledSkuLegs,
  wholesaleProfitForModelRows,
} from "@/lib/sales/top-models-wholesale-margin";
import { inclusivePeriodDays } from "@/lib/sales/inventory-metrics";
import {
  hasOnhandData,
  listOnhandStoresForSku,
  lookupSkuCatalogMeta,
  listSkuKeysForVendorModel,
} from "@/lib/inventory/onhand";
import { shiftIsoYears } from "@/lib/reports/date-utils";
import {
  isExcludedSalesSku,
  isHiddenFromTopVendorModelsRow,
  salesUnitsSold,
} from "@/lib/utils";

export type VendorModelTrendPoint = {
  date: string;
  units: number;
  revenue: number;
};

export type VendorModelSkuDetail = {
  sku: string;
  description: string;
  vendor: string;
  department: string;
  design: string;
  productClass: string;
  subClass: string;
  units: number;
  revenue: number;
  margin: number;
  marginRate: number;
  onHandTotal: number | null;
  stores?: { name: string; units: number; onhand?: number | null }[];
};

export type VendorModelDetail = {
  vendorModel: string;
  description: string;
  imageUrl: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  periodDays: number;
  attributes: {
    vendor: string;
    department: string;
    design: string;
    productClass: string;
    subClass: string;
  };
  totals: {
    revenue: number;
    units: number;
    margin: number;
    marginRate: number;
    onHandTotal: number | null;
    sellThrough: number | null;
    activeStores: number;
    sellingDays: number;
    avgDailyUnits: number;
  };
  /** Primary series (selected year, or first calendar year in a multi-year filter). */
  trend: VendorModelTrendPoint[];
  /** Compare series: prior-year YoY window, or last calendar year in a multi-year filter. */
  trendLastYear: VendorModelTrendPoint[];
  /** Legend label for `trend` (e.g. "2026" or "2025"). */
  trendLabel: string;
  /** Legend label for `trendLastYear` (e.g. "2025"). */
  compareLabel: string;
  /** How the two series were built. */
  compareMode: "yoy" | "calendar-years";
  skus: VendorModelSkuDetail[];
  stores: { name: string; revenue: number; units: number }[];
  insights: string[];
};

function normKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ");
}

function pickDominant(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

function sellThrough(units: number, onHand: number | null): number | null {
  if (onHand == null) return null;
  const denom = units + onHand;
  if (!(denom > 0)) return null;
  return units / denom;
}

function buildDailyTrend(
  rows: VendorPosRow[],
  fillFrom: string | null,
  fillTo: string | null
): VendorModelTrendPoint[] {
  const byDate = new Map<string, { units: number; revenue: number }>();
  for (const r of rows) {
    if (!r.date) continue;
    const cur = byDate.get(r.date) ?? { units: 0, revenue: 0 };
    cur.units += salesUnitsSold(r.quantity);
    cur.revenue += r.netRevenue;
    byDate.set(r.date, cur);
  }
  let trend = [...byDate.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const from = fillFrom ?? trend[0]?.date ?? null;
  const to = fillTo ?? trend[trend.length - 1]?.date ?? null;
  const fillDays = inclusivePeriodDays(from, to);
  if (from && to && fillDays > 1 && fillDays <= 93) {
    const by = new Map(trend.map((p) => [p.date, p]));
    const filled: VendorModelTrendPoint[] = [];
    const cursor = new Date(`${from}T12:00:00Z`);
    const endMs = new Date(`${to}T12:00:00Z`).getTime();
    while (cursor.getTime() <= endMs) {
      const iso = cursor.toISOString().slice(0, 10);
      filled.push(by.get(iso) ?? { date: iso, units: 0, revenue: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    trend = filled;
  }
  return trend;
}

function buildInsights(detail: Omit<VendorModelDetail, "insights">): string[] {
  const out: string[] = [];
  const { totals, stores, trend, periodDays } = detail;

  if (totals.sellThrough != null) {
    out.push(
      `Sell-through is ${(totals.sellThrough * 100).toFixed(0)}% (${totals.units} sold vs ${totals.onHandTotal ?? 0} on hand).`
    );
  }

  if (stores[0] && totals.units > 0) {
    const share = (stores[0].units / totals.units) * 100;
    out.push(
      `${stores[0].name} leads with ${stores[0].units} units (${share.toFixed(0)}% of model sales).`
    );
  }

  if (trend.length >= 14) {
    const mid = Math.floor(trend.length / 2);
    const firstHalf = trend.slice(0, mid).reduce((s, p) => s + p.units, 0);
    const secondHalf = trend.slice(mid).reduce((s, p) => s + p.units, 0);
    if (secondHalf > firstHalf * 1.15) {
      out.push("Sales pace accelerated in the second half of this period.");
    } else if (secondHalf < firstHalf * 0.85) {
      out.push("Sales pace slowed in the second half of this period.");
    }
  }

  const primaryUnits = detail.trend.reduce((s, p) => s + p.units, 0);
  const compareUnits = detail.trendLastYear.reduce((s, p) => s + p.units, 0);
  if (compareUnits > 0 && primaryUnits > 0) {
    const delta = ((primaryUnits - compareUnits) / compareUnits) * 100;
    const vs =
      detail.compareMode === "calendar-years"
        ? `${detail.compareLabel}`
        : "same period last year";
    out.push(
      `Units ${delta >= 0 ? "up" : "down"} ${Math.abs(delta).toFixed(0)}% vs ${vs} (${primaryUnits} in ${detail.trendLabel} vs ${compareUnits} in ${detail.compareLabel}).`
    );
  }

  if (totals.sellingDays > 0 && periodDays > 0) {
    const coverage = (totals.sellingDays / periodDays) * 100;
    out.push(
      `Sold on ${totals.sellingDays} of ${periodDays} days (${coverage.toFixed(0)}% day coverage) · avg ${totals.avgDailyUnits.toFixed(1)} units/selling day.`
    );
  }

  return out.slice(0, 6);
}

export function buildVendorModelDetail(
  allRows: VendorPosRow[],
  vendorModel: string,
  opts?: {
    dateFrom?: string | null;
    dateTo?: string | null;
  }
): VendorModelDetail | null {
  const needle = normKey(vendorModel);
  if (!needle) return null;

  const modelRows = allRows.filter(
    (r) =>
      !isHiddenFromTopVendorModelsRow(r) &&
      normKey(r.vendorModel || r.sku || r.itemNumber || "") === needle
  );

  let rows = modelRows;

  const dateFrom = opts?.dateFrom?.slice(0, 10) ?? null;
  const dateTo = opts?.dateTo?.slice(0, 10) ?? null;
  if (dateFrom && dateTo) {
    const a = dateFrom <= dateTo ? dateFrom : dateTo;
    const b = dateFrom <= dateTo ? dateTo : dateFrom;
    rows = rows.filter((r) => r.date && r.date >= a && r.date <= b);
  }

  hasOnhandData();

  const inventorySkus = listSkuKeysForVendorModel(vendorModel);
  const skuMetaFromRows = new Map<
    string,
    {
      description: string;
      vendor: string;
      department: string;
      design: string;
      productClass: string;
      subClass: string;
      imageDir?: string;
    }
  >();

  for (const r of rows) {
    const sku = (r.sku || r.itemNumber || "").trim();
    if (!sku || isExcludedSalesSku(sku)) continue;
    const key = sku.toUpperCase();
    if (!skuMetaFromRows.has(key)) {
      skuMetaFromRows.set(key, {
        description: r.description?.trim() || "—",
        vendor: r.vendor?.trim() || "—",
        department: r.department?.trim() || "—",
        design: r.design?.trim() || "—",
        productClass: r.productClass?.trim() || "—",
        subClass: r.subClass?.trim() || "—",
        imageDir: r.imageDir || undefined,
      });
    }
  }

  for (const skuKey of inventorySkus) {
    if (skuMetaFromRows.has(skuKey)) continue;
    const meta = lookupSkuCatalogMeta(skuKey);
    if (!meta) continue;
    skuMetaFromRows.set(skuKey, {
      description: meta.description || "—",
      vendor: meta.vendor || "—",
      department: meta.department || "—",
      design: meta.design || "—",
      productClass: meta.productClass || "—",
      subClass: meta.subClass || "—",
    });
  }

  const periodDays = inclusivePeriodDays(dateFrom, dateTo);
  const activeRows = collapseCancelledSkuLegs(rows);
  const skuLines = skuLinesForModel(activeRows);

  const skus: VendorModelSkuDetail[] = [];
  const seenSku = new Set<string>();

  for (const line of skuLines) {
    seenSku.add(line.sku.toUpperCase());
    const meta = skuMetaFromRows.get(line.sku.toUpperCase());
    skus.push({
      sku: line.sku,
      description: meta?.description ?? "—",
      vendor: meta?.vendor ?? "—",
      department: meta?.department ?? "—",
      design: meta?.design ?? "—",
      productClass: meta?.productClass ?? "—",
      subClass: meta?.subClass ?? "—",
      units: line.units,
      revenue: line.revenue,
      margin: line.margin ?? 0,
      marginRate: line.marginRate ?? 0,
      onHandTotal: line.onHandTotal ?? null,
      stores: line.stores,
    });
  }

  for (const skuKey of inventorySkus) {
    if (seenSku.has(skuKey)) continue;
    const meta = lookupSkuCatalogMeta(skuKey) ?? skuMetaFromRows.get(skuKey);
    const stores = listOnhandStoresForSku(skuKey);
    const onHandTotal = stores
      ? stores.reduce((s, x) => s + x.onhand, 0)
      : null;
    skus.push({
      sku: skuKey,
      description: meta?.description ?? "—",
      vendor: meta?.vendor ?? "—",
      department: meta?.department ?? "—",
      design: meta?.design ?? "—",
      productClass: meta?.productClass ?? "—",
      subClass: meta?.subClass ?? "—",
      units: 0,
      revenue: 0,
      margin: 0,
      marginRate: 0,
      onHandTotal,
      stores: stores
        ? stores.map((s) => ({ name: s.store, units: 0, onhand: s.onhand }))
        : undefined,
    });
  }

  skus.sort((a, b) => b.units - a.units || (b.onHandTotal ?? 0) - (a.onHandTotal ?? 0));

  const units = activeRows.reduce((s, r) => s + salesUnitsSold(r.quantity), 0);
  const revenue = activeRows.reduce((s, r) => s + r.netRevenue, 0);
  const { profit, marginRate } = wholesaleProfitForModelRows(activeRows);
  const margin = profit ?? 0;

  let onHandTotal: number | null = null;
  const activeStores = new Set<string>();
  for (const sku of skus) {
    if (sku.onHandTotal != null) {
      if (onHandTotal === null) onHandTotal = 0;
      onHandTotal += sku.onHandTotal;
    }
    for (const st of sku.stores ?? []) {
      activeStores.add(st.name);
      if (st.units > 0) activeStores.add(st.name);
    }
  }
  for (const r of rows) {
    if (r.storeName?.trim() && salesUnitsSold(r.quantity) > 0) {
      activeStores.add(r.storeName.trim());
    }
  }

  const rangeFrom =
    dateFrom && dateTo
      ? dateFrom <= dateTo
        ? dateFrom
        : dateTo
      : null;
  const rangeTo =
    dateFrom && dateTo
      ? dateFrom <= dateTo
        ? dateTo
        : dateFrom
      : null;

  let trend: VendorModelTrendPoint[];
  let trendLastYear: VendorModelTrendPoint[];
  let trendLabel: string;
  let compareLabel: string;
  let compareMode: VendorModelDetail["compareMode"];

  // Multi-year filter (e.g. 2025-01-01 → 2026-07-30): overlay first vs last
  // calendar year in the selection — not YoY-shifted (that labeled both lines 2025).
  if (rangeFrom && rangeTo && rangeFrom.slice(0, 4) !== rangeTo.slice(0, 4)) {
    compareMode = "calendar-years";
    const y0 = rangeFrom.slice(0, 4);
    const y1 = rangeTo.slice(0, 4);
    const y0To = `${y0}-12-31`;
    const y1From = `${y1}-01-01`;
    const rowsY0 = rows.filter(
      (r) => r.date && r.date >= rangeFrom && r.date <= y0To
    );
    const rowsY1 = rows.filter(
      (r) => r.date && r.date >= y1From && r.date <= rangeTo
    );
    trend = buildDailyTrend(rowsY0, rangeFrom, y0To);
    trendLastYear = buildDailyTrend(rowsY1, y1From, rangeTo);
    trendLabel = y0;
    compareLabel = y1;
  } else {
    compareMode = "yoy";
    trend = buildDailyTrend(rows, dateFrom, dateTo);

    let lyFrom: string | null = null;
    let lyTo: string | null = null;
    if (rangeFrom && rangeTo) {
      lyFrom = shiftIsoYears(rangeFrom, -1);
      lyTo = shiftIsoYears(rangeTo, -1);
    } else if (trend.length) {
      lyFrom = shiftIsoYears(trend[0].date, -1);
      lyTo = shiftIsoYears(trend[trend.length - 1].date, -1);
    }
    const lyRows =
      lyFrom && lyTo
        ? modelRows.filter((r) => r.date && r.date >= lyFrom! && r.date <= lyTo!)
        : [];
    trendLastYear = buildDailyTrend(lyRows, lyFrom, lyTo);
    trendLabel =
      rangeFrom?.slice(0, 4) ||
      trend[0]?.date?.slice(0, 4) ||
      "This year";
    compareLabel =
      lyFrom?.slice(0, 4) ||
      (Number(trendLabel) ? String(Number(trendLabel) - 1) : "Last year");
  }

  const byStore = new Map<string, { revenue: number; units: number }>();
  for (const r of activeRows) {
    const store = r.storeName?.trim();
    if (!store) continue;
    const cur = byStore.get(store) ?? { revenue: 0, units: 0 };
    cur.revenue += r.netRevenue;
    cur.units += salesUnitsSold(r.quantity);
    byStore.set(store, cur);
  }
  const stores = [...byStore.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue);

  const sellingSource =
    compareMode === "calendar-years"
      ? buildDailyTrend(rows, dateFrom, dateTo)
      : trend;
  const sellingDays = sellingSource.filter((p) => p.units > 0).length;
  const avgDailyUnits = sellingDays > 0 ? units / sellingDays : 0;

  const firstImage = rows.find((r) => r.imageDir)?.imageDir;
  const description =
    pickDominant(rows.map((r) => r.description)) ||
    skus.find((s) => s.description !== "—")?.description ||
    vendorModel;

  const partial: Omit<VendorModelDetail, "insights"> = {
    vendorModel,
    description,
    imageUrl: resolveProductImageUrl(firstImage),
    dateFrom: dateFrom ?? trend[0]?.date ?? null,
    dateTo: dateTo ?? trend[trend.length - 1]?.date ?? null,
    periodDays:
      dateFrom && dateTo
        ? periodDays
        : inclusivePeriodDays(trend[0]?.date, trend[trend.length - 1]?.date),
    attributes: {
      vendor: pickDominant([...skuMetaFromRows.values()].map((m) => m.vendor)),
      department: pickDominant([...skuMetaFromRows.values()].map((m) => m.department)),
      design: pickDominant([...skuMetaFromRows.values()].map((m) => m.design)),
      productClass: pickDominant([...skuMetaFromRows.values()].map((m) => m.productClass)),
      subClass: pickDominant([...skuMetaFromRows.values()].map((m) => m.subClass)),
    },
    totals: {
      revenue,
      units,
      margin,
      marginRate: marginRate ?? (revenue > 0 ? margin / revenue : 0),
      onHandTotal,
      sellThrough: sellThrough(units, onHandTotal),
      activeStores: activeStores.size,
      sellingDays,
      avgDailyUnits,
    },
    trend,
    trendLastYear,
    trendLabel,
    compareLabel,
    compareMode,
    skus,
    stores,
  };

  return { ...partial, insights: buildInsights(partial) };
}
