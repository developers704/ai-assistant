import { NextResponse } from "next/server";
import Papa from "papaparse";
import {
  getLatestReportMeta,
  getLatestReportWithSummary,
  getReportMeta,
  readReportCsv,
} from "@/lib/reports/store";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import {
  filterExcludedSalesRows,
  isExcludedSalesSku,
  isHiddenFromTopVendorModelsRow,
  salesUnitsSold,
} from "@/lib/utils";
import { buildSkuStoreLines } from "@/lib/sales/sales-aggregate";
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
import { isSalesUnifiedIntelligenceEnabled } from "@/lib/sales/flags";
import {
  readActivePointer,
  readNormalizedRows,
  readVersionMetadata,
} from "@/lib/sales/data/version-store";
import { readSessionFromCookies } from "@/lib/auth/session";
import { scopeStoresForUser } from "@/lib/auth/scope-stores";
import { sumCostPriceForRole } from "@/lib/sales/cost-price";
import { hidesVendorInfoFromPermissions } from "@/lib/auth/user-permissions-store";
import { showsAllSoldInTopVendorModels } from "@/lib/auth/user-permissions";
import { vendorModelGroupKey } from "@/lib/sales/top-models-wholesale-margin";

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

function loadRankRows(
  reportId?: string,
  opts?: { skipSalesExclusions?: boolean }
): VendorPosRow[] | null {
  const skip = opts?.skipSalesExclusions === true;
  const latestMeta = getLatestReportMeta();
  const useVersion =
    isSalesUnifiedIntelligenceEnabled() &&
    (!reportId || !latestMeta || reportId === latestMeta.id);

  if (useVersion) {
    const pointer = readActivePointer();
    if (pointer.activeVersion) {
      const versionRows = readNormalizedRows(pointer.activeVersion);
      if (versionRows?.length) {
        return skip ? versionRows : filterExcludedSalesRows(versionRows);
      }
    }
  }

  let csv: string | null = null;
  if (reportId) {
    if (!getReportMeta(reportId)) return null;
    csv = readReportCsv(reportId);
  } else {
    const latest = getLatestReportWithSummary();
    csv = latest?.csv ?? null;
  }
  if (!csv) return null;
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = parseVendorPosRows(parsed.data ?? []).rows;
  return skip ? rows : filterExcludedSalesRows(rows);
}

function skuLinesCredited(
  rows: VendorPosRow[],
  creditOf: (r: VendorPosRow) => number
): VendorModelSkuLine[] {
  const map = new Map<
    string,
    VendorModelSkuLine & {
      storeSales: Map<string, { units: number; returned: number; revenue: number }>;
    }
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
      storeSales: new Map<
        string,
        { units: number; returned: number; revenue: number }
      >(),
    };
    const units = salesUnitsSold(r.quantity) * share;
    const revenueShare = r.netRevenue * share;
    cur.units += units;
    cur.revenue += revenueShare;
    cur.margin = (cur.margin ?? 0) + r.margin * share;
    const store = r.storeName?.trim();
    if (store) {
      const prev = cur.storeSales.get(store) ?? {
        units: 0,
        returned: 0,
        revenue: 0,
      };
      prev.units += units;
      const q = Number(r.quantity ?? 0);
      if (q < 0) prev.returned += Math.abs(q) * share;
      prev.revenue += revenueShare;
      cur.storeSales.set(store, prev);
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ storeSales, ...line }) => {
      const margin = line.margin ?? 0;
      const stores = buildSkuStoreLines(line.sku, storeSales);
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
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dimension = searchParams.get("dimension") as RankDimension | null;
  const value = searchParams.get("value")?.trim() ?? "";
  const date = searchParams.get("date")?.trim() || undefined;
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;
  const requested = parseMultiParam(searchParams, "store", "stores");
  const { stores } = scopeStoresForUser(session, requested);
  const departments = parseMultiParam(searchParams, "department", "departments");
  const designs = parseMultiParam(searchParams, "design", "designs");
  const vendors = parseMultiParam(searchParams, "vendor", "vendors");
  const classes = parseMultiParam(searchParams, "class", "classes");
  const id = searchParams.get("id")?.trim() || undefined;
  const includeHiddenTopModels = showsAllSoldInTopVendorModels(session.username);

  const allowed: RankDimension[] = [
    "store",
    "department",
    "vendor",
    "design",
    "class",
    "vendorModel",
    "salesperson",
  ].filter((d) => !(hidesVendorInfoFromPermissions(session.username) && d === "vendor")) as RankDimension[];
  if (!dimension || !allowed.includes(dimension) || !value) {
    return NextResponse.json(
      { error: "dimension and value are required" },
      { status: 400 }
    );
  }

  let rows = loadRankRows(id, {
    skipSalesExclusions: includeHiddenTopModels,
  });
  if (!rows) {
    return NextResponse.json(
      { error: id ? "Report not found" : "No report available" },
      { status: id ? 404 : 404 }
    );
  }
  if (from && to) {
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    rows = rows.filter((r) => r.date && r.date >= a && r.date <= b);
  } else if (date) {
    rows = rows.filter((r) => r.date === date);
  }
  const storeSet = multiSet(stores ?? []);
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
  const units = matched.reduce(
    (s, r) => s + salesUnitsSold(r.quantity) * creditOf(r),
    0
  );
  const margin = matched.reduce((s, r) => s + r.margin * creditOf(r), 0);
  const grossSales = matched.reduce((s, r) => s + r.grossSales * creditOf(r), 0);
  const discountTotal = matched.reduce(
    (s, r) => s + r.discountAmount * creditOf(r),
    0
  );
  const inventoryCost = sumCostPriceForRole(
    matched,
    session.role,
    (r) => creditOf(r)
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
        units: ex.units + salesUnitsSold(r.quantity) * share,
      });
    };
    bump(byStore, r.storeName);
    bump(byDept, r.department);
    bump(byDesign, r.design);
    bump(byClass, r.productClass);
    bump(byVendor, r.vendor);

    const model = vendorModelGroupKey(r);
    if (model && (includeHiddenTopModels || !isHiddenFromTopVendorModelsRow(r))) {
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
        units: ex.units + salesUnitsSold(r.quantity) * share,
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
      vendors: hidesVendorInfoFromPermissions(session.username) ? [] : topN(byVendor),
      models: topModels,
    },
  });
}
