import { NextResponse } from "next/server";
import Papa from "papaparse";
import {
  getLatestReportWithSummary,
  getReportMeta,
  readReportCsv,
} from "@/lib/reports/store";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { filterExcludedSalesRows, isExcludedSalesSku } from "@/lib/utils";
import type { RankDimension, VendorPosRow } from "@/lib/reports/types";
import { parseMultiParam } from "@/lib/sales/filter-params";
import { dimensionValue } from "@/lib/reports/rank-dimension";
import {
  rowIncludesSalesperson,
  salespersonShare,
} from "@/lib/sales/salesperson-credit";
import {
  loadSalespersonDirectory,
  resolveSalespersonLabelWithCode,
} from "@/lib/sales/salesperson-directory";
import type { VendorModelSkuLine } from "@/lib/sales/sales-types";

export const runtime = "nodejs";

export type { RankDimension };

/** Normalize class/metal labels so "21-24KT" and "21–24KT" match. */
function normalizeFilterKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ");
}

function multiSet(values: string[]): Set<string> | null {
  if (!values.length) return null;
  return new Set(values.map(normalizeFilterKey));
}

/** Resolve rank-detail value to a salesperson code (accepts code or "Name (CODE)"). */
function resolveSalespersonCode(value: string): string {
  const raw = value.trim();
  const paren = raw.match(/\(([A-Za-z0-9_.-]+)\)\s*$/);
  if (paren) return paren[1].toUpperCase();
  return raw.toUpperCase();
}

function skuLinesCredited(
  rows: VendorPosRow[],
  creditOf: (r: VendorPosRow) => number
): VendorModelSkuLine[] {
  const map = new Map<
    string,
    VendorModelSkuLine & { storeSet: Set<string> }
  >();
  for (const r of rows) {
    const sku = (r.sku || r.itemNumber || "").trim();
    if (!sku || isExcludedSalesSku(sku)) continue;
    const share = creditOf(r);
    if (share <= 0) continue;
    const key = sku.toUpperCase();
    const cur = map.get(key) ?? {
      sku,
      units: 0,
      revenue: 0,
      margin: 0,
      storeSet: new Set<string>(),
    };
    cur.units += r.quantity * share;
    cur.revenue += r.netRevenue * share;
    cur.margin = (cur.margin ?? 0) + r.margin * share;
    const store = r.storeName?.trim();
    if (store) cur.storeSet.add(store);
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ storeSet, ...line }) => {
      const margin = line.margin ?? 0;
      const stores = [...storeSet].sort((a, b) => a.localeCompare(b));
      return {
        ...line,
        margin,
        marginRate: line.revenue > 0 ? margin / line.revenue : 0,
        stores: stores.length ? stores : undefined,
      };
    })
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dimension = searchParams.get("dimension") as RankDimension | null;
  const value = searchParams.get("value")?.trim() ?? "";
  const date = searchParams.get("date")?.trim() || undefined;
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;
  const stores = parseMultiParam(searchParams, "store", "stores");
  const departments = parseMultiParam(searchParams, "department", "departments");
  const designs = parseMultiParam(searchParams, "design", "designs");
  const vendors = parseMultiParam(searchParams, "vendor", "vendors");
  const classes = parseMultiParam(searchParams, "class", "classes");
  const id = searchParams.get("id")?.trim() || undefined;

  const allowed: RankDimension[] = [
    "store",
    "department",
    "vendor",
    "design",
    "class",
    "vendorModel",
    "salesperson",
  ];
  if (!dimension || !allowed.includes(dimension) || !value) {
    return NextResponse.json(
      { error: "dimension and value are required" },
      { status: 400 }
    );
  }

  let csv: string | null = null;
  if (id) {
    if (!getReportMeta(id)) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    csv = readReportCsv(id);
  } else {
    const latest = getLatestReportWithSummary();
    csv = latest?.csv ?? null;
  }

  if (!csv) {
    return NextResponse.json({ error: "No report available" }, { status: 404 });
  }

  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  let rows = filterExcludedSalesRows(parseVendorPosRows(parsed.data ?? []).rows);
  if (from && to) {
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    rows = rows.filter((r) => r.date && r.date >= a && r.date <= b);
  } else if (date) {
    rows = rows.filter((r) => r.date === date);
  }
  const storeSet = multiSet(stores);
  const deptSet = multiSet(departments);
  const designSet = multiSet(designs);
  const vendorSet = multiSet(vendors);
  const classSet = multiSet(classes);
  if (storeSet) {
    rows = rows.filter((r) =>
      storeSet.has(normalizeFilterKey(dimensionValue(r, "store")))
    );
  }
  if (deptSet) {
    rows = rows.filter((r) =>
      deptSet.has(normalizeFilterKey(dimensionValue(r, "department")))
    );
  }
  if (designSet) {
    rows = rows.filter((r) =>
      designSet.has(normalizeFilterKey(dimensionValue(r, "design")))
    );
  }
  if (vendorSet) {
    rows = rows.filter((r) =>
      vendorSet.has(normalizeFilterKey(dimensionValue(r, "vendor")))
    );
  }
  if (classSet) {
    rows = rows.filter((r) =>
      classSet.has(normalizeFilterKey(dimensionValue(r, "class")))
    );
  }

  const isSalesperson = dimension === "salesperson";
  const salespersonCode = isSalesperson ? resolveSalespersonCode(value) : "";
  const needle = normalizeFilterKey(value);
  const matched = isSalesperson
    ? rows.filter((r) => rowIncludesSalesperson(r, salespersonCode))
    : rows.filter(
        (r) => normalizeFilterKey(dimensionValue(r, dimension)) === needle
      );

  const creditOf = (r: VendorPosRow) =>
    isSalesperson ? salespersonShare(r, salespersonCode) : 1;

  const revenue = matched.reduce((s, r) => s + r.netRevenue * creditOf(r), 0);
  const units = matched.reduce((s, r) => s + r.quantity * creditOf(r), 0);
  const margin = matched.reduce((s, r) => s + r.margin * creditOf(r), 0);
  const grossSales = matched.reduce((s, r) => s + r.grossSales * creditOf(r), 0);
  const discountTotal = matched.reduce(
    (s, r) => s + r.discountAmount * creditOf(r),
    0
  );
  const inventoryCost = matched.reduce(
    (s, r) => s + r.inventoryCost * creditOf(r),
    0
  );
  const uniqueTransactions = new Set(
    matched.map((r) => r.transactionId).filter(Boolean)
  ).size;

  const byStore = new Map<string, { revenue: number; units: number }>();
  const byDept = new Map<string, { revenue: number; units: number }>();
  const byDesign = new Map<string, { revenue: number; units: number }>();
  const byClass = new Map<string, { revenue: number; units: number }>();
  const byVendor = new Map<string, { revenue: number; units: number }>();
  const byModel = new Map<
    string,
    {
      name: string;
      vendorModel: string;
      revenue: number;
      units: number;
      margin: number;
      imageDir?: string;
      sku?: string;
      rows: typeof matched;
    }
  >();

  for (const r of matched) {
    const share = creditOf(r);
    const bump = (
      map: Map<string, { revenue: number; units: number }>,
      key: string
    ) => {
      if (!key || key === "—") return;
      const ex = map.get(key) || { revenue: 0, units: 0 };
      map.set(key, {
        revenue: ex.revenue + r.netRevenue * share,
        units: ex.units + r.quantity * share,
      });
    };
    bump(byStore, r.storeName);
    bump(byDept, r.department);
    bump(byDesign, r.design);
    bump(byClass, r.productClass);
    bump(byVendor, r.vendor);

    const model = r.vendorModel?.trim() || r.sku || r.itemNumber;
    if (model) {
      const ex = byModel.get(model) || {
        name: r.description || model,
        vendorModel: model,
        revenue: 0,
        units: 0,
        margin: 0,
        imageDir: r.imageDir || undefined,
        sku: r.sku || r.itemNumber || undefined,
        rows: [],
      };
      ex.rows.push(r);
      byModel.set(model, {
        name: r.description || ex.name,
        vendorModel: model,
        revenue: ex.revenue + r.netRevenue * share,
        units: ex.units + r.quantity * share,
        margin: ex.margin + r.margin * share,
        imageDir: ex.imageDir || r.imageDir || undefined,
        sku: ex.sku || r.sku || r.itemNumber || undefined,
        rows: ex.rows,
      });
    }
  }

  const topN = (
    map: Map<string, { revenue: number; units: number }>,
    n = 10
  ) =>
    [...map.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, n);

  const topModels = [...byModel.values()]
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .map(({ rows: modelRows, ...m }) => {
      const skus: VendorModelSkuLine[] = isSalesperson
        ? skuLinesCredited(modelRows, creditOf)
        : skuLinesCredited(modelRows, () => 1);
      return {
        ...m,
        skus: skus.length ? skus : undefined,
        marginRate: m.revenue > 0 ? m.margin / m.revenue : 0,
        imageUrl: resolveProductImageUrl(m.imageDir),
      };
    });

  const displayValue = isSalesperson
    ? resolveSalespersonLabelWithCode(salespersonCode, loadSalespersonDirectory())
    : value;

  return NextResponse.json({
    dimension,
    value: displayValue,
    code: isSalesperson ? salespersonCode : undefined,
    date: date ?? null,
    totals: {
      revenue,
      units,
      margin,
      grossSales,
      discountTotal,
      inventoryCost,
      lineCount: matched.length,
      uniqueTransactions,
      modelCount: topModels.length,
    },
    breakdowns: {
      stores: topN(byStore),
      departments: topN(byDept),
      designs: topN(byDesign),
      classes: topN(byClass),
      vendors: topN(byVendor),
      models: topModels,
    },
  });
}
