import { filterExcludedSalesRows } from "@/lib/utils";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import { getLatestReportWithSummary } from "@/lib/reports/store";
import { datesInIsoRange, isValidIsoDate } from "@/lib/reports/date-utils";
import Papa from "papaparse";
import { readActivePointer, readNormalizedRows } from "@/lib/sales/data/version-store";
import { isSalesUnifiedIntelligenceEnabled } from "@/lib/sales/flags";
import { filterRows, groupRows, summarizeRows } from "@/lib/sales/sales-aggregate";
import { getTopVendorModels } from "@/lib/sales/sales-product-analysis";
import type { VendorPosRow } from "@/lib/reports/types";

export interface VizChartRow {
  name: string;
  netSales: number;
  unitsSold: number;
  share: number;
  transactions: number;
}

export interface SalesVisualizationPayload {
  summary: {
    netSales: number;
    unitsSold: number;
    transactions: number;
    averageUnitPrice: number;
    discounts: number;
    grossSales: number;
    matchingRowCount: number;
  };
  charts: {
    byDate: VizChartRow[];
    byStore: VizChartRow[];
    byDepartment: VizChartRow[];
    byDesign: VizChartRow[];
    byVendor: VizChartRow[];
    byClass: VizChartRow[];
    topVendorModels: VizChartRow[];
  };
  filters: {
    dates: string[];
    stores: string[];
    departments: string[];
    designs: string[];
    vendors: string[];
    classes: string[];
  };
  applied: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    store?: string;
    department?: string;
    design?: string;
    vendor?: string;
    className?: string;
  };
  reportLabel: string | null;
  dateRange: { from: string | null; to: string | null };
}

function uniqSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function loadAllRows(): { rows: VendorPosRow[]; reportLabel: string | null } {
  if (isSalesUnifiedIntelligenceEnabled()) {
    const pointer = readActivePointer();
    const versionRows = pointer.activeVersion ? readNormalizedRows(pointer.activeVersion) : null;
    if (versionRows?.length) {
      const latest = getLatestReportWithSummary();
      return {
        rows: versionRows,
        reportLabel: latest?.meta.label ?? "Sales report",
      };
    }
  }

  const latest = getLatestReportWithSummary();
  if (!latest) return { rows: [], reportLabel: null };
  const parsed = Papa.parse<Record<string, unknown>>(latest.csv, {
    header: true,
    skipEmptyLines: true,
  });
  const { rows } = parseVendorPosRows(parsed.data ?? []);
  return {
    rows: filterExcludedSalesRows(rows),
    reportLabel: latest.meta.label,
  };
}

function toChartRows(rows: ReturnType<typeof groupRows>): VizChartRow[] {
  return rows.map((r) => ({
    name: r.name,
    netSales: Math.round(r.netSales * 100) / 100,
    unitsSold: r.unitsSold,
    share: Math.round((r.share ?? 0) * 10) / 10,
    transactions: r.transactions,
  }));
}

export function buildSalesVisualizations(opts: {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  store?: string;
  department?: string;
  design?: string;
  vendor?: string;
  className?: string;
}): SalesVisualizationPayload {
  const { rows: allRows, reportLabel } = loadAllRows();
  const dates = uniqSorted(allRows.map((r) => r.date));
  const stores = uniqSorted(allRows.map((r) => r.storeName));
  const departments = uniqSorted(allRows.map((r) => r.department));
  const designs = uniqSorted(allRows.map((r) => r.design));
  const vendors = uniqSorted(allRows.map((r) => r.vendor));
  const classes = uniqSorted(allRows.map((r) => r.productClass));

  let filterDates: string[] | undefined;
  if (
    opts.dateFrom &&
    opts.dateTo &&
    isValidIsoDate(opts.dateFrom) &&
    isValidIsoDate(opts.dateTo)
  ) {
    const from = opts.dateFrom <= opts.dateTo ? opts.dateFrom : opts.dateTo;
    const to = opts.dateFrom <= opts.dateTo ? opts.dateTo : opts.dateFrom;
    filterDates = datesInIsoRange(from, to);
  } else if (opts.date) {
    filterDates = [opts.date];
  }

  const filtered = filterRows(allRows, {
    dates: filterDates,
    stores: opts.store ? [opts.store] : undefined,
    departments: opts.department ? [opts.department] : undefined,
    designs: opts.design ? [opts.design] : undefined,
    vendors: opts.vendor ? [opts.vendor] : undefined,
    classes: opts.className ? [opts.className] : undefined,
  });

  const summary = summarizeRows(filtered);
  const byDate = groupRows(filtered, "date", 366, "netSales", "asc").sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const appliedFrom = filterDates?.length
    ? filterDates[0]
    : undefined;
  const appliedTo = filterDates?.length
    ? filterDates[filterDates.length - 1]
    : undefined;

  return {
    summary: {
      netSales: summary.netSales ?? 0,
      unitsSold: summary.unitsSold ?? 0,
      transactions: summary.transactions ?? 0,
      averageUnitPrice: summary.averageUnitPrice ?? 0,
      discounts: summary.discounts ?? 0,
      grossSales: summary.grossSales ?? 0,
      matchingRowCount: filtered.length,
    },
    charts: {
      byDate: toChartRows(byDate),
      byStore: toChartRows(groupRows(filtered, "store", 25, "netSales", "desc")),
      byDepartment: toChartRows(groupRows(filtered, "department", 20, "netSales", "desc")),
      byDesign: toChartRows(groupRows(filtered, "design", 20, "netSales", "desc")),
      byVendor: toChartRows(groupRows(filtered, "vendor", 20, "netSales", "desc")),
      byClass: toChartRows(groupRows(filtered, "class", 20, "netSales", "desc")),
      topVendorModels: toChartRows(
        getTopVendorModels(filtered, { limit: 15, sortBy: "quantity" })
      ),
    },
    filters: { dates, stores, departments, designs, vendors, classes },
    applied: {
      date: appliedFrom && appliedTo && appliedFrom === appliedTo ? appliedFrom : undefined,
      dateFrom: appliedFrom,
      dateTo: appliedTo,
      store: opts.store,
      department: opts.department,
      design: opts.design,
      vendor: opts.vendor,
      className: opts.className,
    },
    reportLabel,
    dateRange: {
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
    },
  };
}
