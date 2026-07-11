import type { VendorPosRow } from "@/lib/reports/types";
import type {
  SalesComparisonResult,
  SalesEntityType,
  SalesMetricSummary,
  SalesQueryInput,
} from "./sales-types";
import { filterRows, groupRows, summarizeRows, topOf } from "./sales-aggregate";

function diff(
  a: number | null | undefined,
  b: number | null | undefined
): number | null {
  if (a == null || b == null) return null;
  return a - b;
}

function pctChange(
  a: number | null | undefined,
  b: number | null | undefined
): number | null {
  if (a == null || b == null || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

function enrichSide(rows: VendorPosRow[], label: string) {
  const summary = summarizeRows(rows);
  return {
    label,
    summary,
    topDepartment: topOf(groupRows(rows, "department", 1)),
    topDesign: topOf(groupRows(rows, "design", 1)),
    topVendor: topOf(groupRows(rows, "vendor", 1)),
    topVendorModel: topOf(groupRows(rows, "vendor_model", 1)),
  };
}

const METRIC_KEYS: (keyof SalesMetricSummary)[] = [
  "netSales",
  "grossSales",
  "discounts",
  "discountRate",
  "unitsSold",
  "transactions",
  "estimatedMargin",
  "marginRate",
  "averageTicket",
  "averageUnitPrice",
];

export function compareEntitySlices(
  baseRows: VendorPosRow[],
  entityType: SalesEntityType,
  leftName: string,
  rightName: string,
  sharedFilters: {
    dates?: string[];
    stores?: string[];
    departments?: string[];
    designs?: string[];
    vendors?: string[];
    classes?: string[];
  }
): SalesComparisonResult {
  const shared = filterRows(baseRows, sharedFilters);

  const leftFilter = { ...sharedFilters };
  const rightFilter = { ...sharedFilters };
  const key =
    entityType === "store"
      ? "stores"
      : entityType === "department"
        ? "departments"
        : entityType === "design"
          ? "designs"
          : entityType === "vendor"
            ? "vendors"
            : entityType === "class"
              ? "classes"
              : "products";

  (leftFilter as Record<string, string[]>)[key] = [leftName];
  (rightFilter as Record<string, string[]>)[key] = [rightName];

  // When comparing stores, don't also keep store filter from shared
  if (entityType === "store") {
    delete (leftFilter as { stores?: string[] }).stores;
    delete (rightFilter as { stores?: string[] }).stores;
    leftFilter.stores = [leftName];
    rightFilter.stores = [rightName];
  }

  const leftRows = filterRows(shared, {
    ...sharedFilters,
    ...(entityType === "store" ? { stores: [leftName] } : {}),
    ...(entityType === "department" ? { departments: [leftName] } : {}),
    ...(entityType === "design" ? { designs: [leftName] } : {}),
    ...(entityType === "vendor" ? { vendors: [leftName] } : {}),
    ...(entityType === "class" ? { classes: [leftName] } : {}),
    ...(entityType === "product" ? { products: [leftName] } : {}),
  });
  const rightRows = filterRows(shared, {
    ...sharedFilters,
    ...(entityType === "store" ? { stores: [rightName] } : {}),
    ...(entityType === "department" ? { departments: [rightName] } : {}),
    ...(entityType === "design" ? { designs: [rightName] } : {}),
    ...(entityType === "vendor" ? { vendors: [rightName] } : {}),
    ...(entityType === "class" ? { classes: [rightName] } : {}),
    ...(entityType === "product" ? { products: [rightName] } : {}),
  });

  // Re-filter from base with only the entity differing + shared non-entity filters
  const common = { ...sharedFilters };
  if (entityType === "store") delete common.stores;
  if (entityType === "department") delete common.departments;
  if (entityType === "design") delete common.designs;
  if (entityType === "vendor") delete common.vendors;
  if (entityType === "class") delete common.classes;

  const left = enrichSide(
    filterRows(baseRows, {
      ...common,
      ...(entityType === "store" ? { stores: [leftName] } : {}),
      ...(entityType === "department" ? { departments: [leftName] } : {}),
      ...(entityType === "design" ? { designs: [leftName] } : {}),
      ...(entityType === "vendor" ? { vendors: [leftName] } : {}),
      ...(entityType === "class" ? { classes: [leftName] } : {}),
      ...(entityType === "product" ? { products: [leftName] } : {}),
    }),
    leftName
  );
  const right = enrichSide(
    filterRows(baseRows, {
      ...common,
      ...(entityType === "store" ? { stores: [rightName] } : {}),
      ...(entityType === "department" ? { departments: [rightName] } : {}),
      ...(entityType === "design" ? { designs: [rightName] } : {}),
      ...(entityType === "vendor" ? { vendors: [rightName] } : {}),
      ...(entityType === "class" ? { classes: [rightName] } : {}),
      ...(entityType === "product" ? { products: [rightName] } : {}),
    }),
    rightName
  );

  void leftRows;
  void rightRows;

  const differences: SalesComparisonResult["differences"] = {};
  const percentageChanges: SalesComparisonResult["percentageChanges"] = {};
  const winnerByMetric: SalesComparisonResult["winnerByMetric"] = {};

  for (const k of METRIC_KEYS) {
    differences[k] = diff(left.summary[k], right.summary[k]);
    percentageChanges[k] = pctChange(left.summary[k], right.summary[k]);
    const lv = left.summary[k];
    const rv = right.summary[k];
    if (lv == null || rv == null) winnerByMetric[k] = null;
    else if (lv === rv) winnerByMetric[k] = "tie";
    else if (k === "discounts" || k === "discountRate") {
      // lower discounts can be "better" — still report higher value as winner label for clarity
      winnerByMetric[k] = lv > rv ? left.label : right.label;
    } else {
      winnerByMetric[k] = lv > rv ? left.label : right.label;
    }
  }

  return { left, right, differences, percentageChanges, winnerByMetric };
}

export function inferComparisonEntityType(
  comparison: NonNullable<SalesQueryInput["comparison"]>,
  filters: {
    stores: string[];
    departments: string[];
    designs: string[];
    vendors: string[];
    classes: string[];
  }
): SalesEntityType {
  if (comparison.entityType) return comparison.entityType;
  // Heuristic: if entities look like designs already in filters context, etc.
  return "store";
}
