import { NextResponse } from "next/server";
import Papa from "papaparse";
import {
  getLatestReportWithSummary,
  getReportMeta,
  readReportCsv,
} from "@/lib/reports/store";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { filterExcludedSalesRows } from "@/lib/utils";
import type { VendorPosRow, RankDimension } from "@/lib/reports/types";

export const runtime = "nodejs";

export type { RankDimension };

function dimensionValue(row: VendorPosRow, dimension: RankDimension): string {
  switch (dimension) {
    case "store":
      return row.storeName;
    case "department":
      return row.department;
    case "vendor":
      return row.vendor;
    case "design":
      return row.design;
    case "class":
      return row.productClass;
    case "vendorModel":
      return row.vendorModel;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dimension = searchParams.get("dimension") as RankDimension | null;
  const value = searchParams.get("value")?.trim() ?? "";
  const date = searchParams.get("date")?.trim() || undefined;
  const store = searchParams.get("store")?.trim() || undefined;
  const department = searchParams.get("department")?.trim() || undefined;
  const design = searchParams.get("design")?.trim() || undefined;
  const id = searchParams.get("id")?.trim() || undefined;

  const allowed: RankDimension[] = [
    "store",
    "department",
    "vendor",
    "design",
    "class",
    "vendorModel",
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
  if (date) rows = rows.filter((r) => r.date === date);
  if (store) {
    const needle = store.toLowerCase();
    rows = rows.filter((r) => r.storeName.trim().toLowerCase() === needle);
  }
  if (department) {
    const needle = department.toLowerCase();
    rows = rows.filter((r) => r.department.trim().toLowerCase() === needle);
  }
  if (design) {
    const needle = design.toLowerCase();
    rows = rows.filter((r) => r.design.trim().toLowerCase() === needle);
  }

  const needle = value.toLowerCase();
  const matched = rows.filter(
    (r) => dimensionValue(r, dimension).trim().toLowerCase() === needle
  );

  const revenue = matched.reduce((s, r) => s + r.netRevenue, 0);
  const units = matched.reduce((s, r) => s + r.quantity, 0);
  const margin = matched.reduce((s, r) => s + r.margin, 0);
  const grossSales = matched.reduce((s, r) => s + r.grossSales, 0);
  const discountTotal = matched.reduce((s, r) => s + r.discountAmount, 0);
  const inventoryCost = matched.reduce((s, r) => s + r.inventoryCost, 0);
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
      imageDir?: string;
      sku?: string;
    }
  >();

  for (const r of matched) {
    const bump = (
      map: Map<string, { revenue: number; units: number }>,
      key: string
    ) => {
      if (!key || key === "—") return;
      const ex = map.get(key) || { revenue: 0, units: 0 };
      map.set(key, {
        revenue: ex.revenue + r.netRevenue,
        units: ex.units + r.quantity,
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
        imageDir: r.imageDir || undefined,
        sku: r.sku || r.itemNumber || undefined,
      };
      byModel.set(model, {
        name: r.description || ex.name,
        vendorModel: model,
        revenue: ex.revenue + r.netRevenue,
        units: ex.units + r.quantity,
        imageDir: ex.imageDir || r.imageDir || undefined,
        sku: ex.sku || r.sku || r.itemNumber || undefined,
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
    .slice(0, 15)
    .map((m) => ({
      ...m,
      imageUrl: resolveProductImageUrl(m.imageDir),
    }));

  const lineItems = matched
    .slice()
    .sort((a, b) => b.netRevenue - a.netRevenue)
    .slice(0, 40)
    .map((r) => ({
      date: r.date,
      transactionId: r.transactionId,
      storeName: r.storeName,
      department: r.department,
      design: r.design,
      vendor: r.vendor,
      vendorModel: r.vendorModel,
      sku: r.sku || r.itemNumber,
      description: r.description,
      productClass: r.productClass,
      subClass: r.subClass,
      quantity: r.quantity,
      netRevenue: r.netRevenue,
      margin: r.margin,
      inventoryCost: r.inventoryCost,
      imageUrl: resolveProductImageUrl(r.imageDir),
    }));

  return NextResponse.json({
    dimension,
    value,
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
    },
    breakdowns: {
      stores: topN(byStore),
      departments: topN(byDept),
      designs: topN(byDesign),
      classes: topN(byClass),
      vendors: topN(byVendor),
      models: topModels,
    },
    lineItems,
  });
}
