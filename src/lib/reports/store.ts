import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { summarizeCsvText, extractReportDimensions } from "./summarize-csv";
import { enrichStoreSalesCsvDates } from "./enrich-sales-dates";
import { datesInIsoRange, isoToUsDate } from "./date-utils";
import type { ReportSummary, StoredReportMeta } from "./types";

const REPORTS_DIR = path.join(process.cwd(), ".data", "reports");
const INDEX_FILE = path.join(REPORTS_DIR, "index.json");

const SEED_CANDIDATES: {
  fileName: string;
  path: string;
  label: string;
  reportPeriod: import("./types").ReportPeriod;
  reportDate?: string;
  dateRange?: { from: string; to: string };
}[] = [
  {
    fileName: "Sales-Report.csv",
    path: path.join(process.cwd(), "data", "reports", "Sales-Report.csv"),
    label: "Store Sales Report Jan 1–Jul 23",
    reportPeriod: "custom",
    reportDate: "2026-07-23",
    dateRange: { from: "2026-01-01", to: "2026-07-23" },
  },
];

function isBundledSalesReport(meta: StoredReportMeta): boolean {
  return meta.fileName === "Sales-Report.csv";
}

function readSeedCsv():
  | {
      fileName: string;
      csvText: string;
      label: string;
      reportPeriod: import("./types").ReportPeriod;
      reportDate?: string;
      dateRange?: { from: string; to: string };
    }
  | null {
  for (const seed of SEED_CANDIDATES) {
    if (!fs.existsSync(seed.path)) continue;
    const csvText = enrichStoreSalesCsvDates(fs.readFileSync(seed.path, "utf-8"), {
      fallbackDate: seed.dateRange?.to ? isoToUsDate(seed.dateRange.to) : "7/17/2026",
    });
    if (csvText.trim()) {
      return {
        fileName: seed.fileName,
        csvText,
        label: seed.label,
        reportPeriod: seed.reportPeriod,
        reportDate: seed.reportDate,
        dateRange: seed.dateRange,
      };
    }
  }
  return null;
}

function ensureDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

/** Load bundled store sales CSV when no reports exist yet, or refresh when seed file changes. */
function ensureSeedReport() {
  const seed = readSeedCsv();
  if (!seed) return;

  const index = readIndex();
  const bundled = index.filter(isBundledSalesReport);
  const existingBundled =
    bundled.find((r) => r.fileName === seed.fileName) ?? bundled[0] ?? null;

  if (existingBundled) {
    const existingCsv = readReportCsv(existingBundled.id);
    if (existingCsv === seed.csvText) return;
    for (const report of bundled) {
      deleteReport(report.id);
    }
  }

  try {
    saveReport(seed.fileName, seed.csvText, {
      label: seed.label,
      reportPeriod: seed.reportPeriod,
      reportCategory: "sales",
      reportDate: seed.reportDate,
      dateRange: seed.dateRange,
    });
  } catch (err) {
    console.warn("Could not seed default sales report:", err);
  }
}

function readIndex(): StoredReportMeta[] {
  ensureDir();
  if (!fs.existsSync(INDEX_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8")) as StoredReportMeta[];
  } catch {
    return [];
  }
}

function writeIndex(reports: StoredReportMeta[]) {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(reports, null, 2), "utf-8");
}

function csvPath(id: string) {
  return path.join(REPORTS_DIR, `${id}.csv`);
}

export function listReports(): StoredReportMeta[] {
  ensureSeedReport();
  return readIndex().sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

export function getLatestReportMeta(): StoredReportMeta | null {
  const list = listReports(); // newest uploadedAt first
  // Prefer the most recently uploaded store-sales report so Data Analyst
  // uploads update Sales Dashboard, chat, voice, and rank-detail.
  const storeSales = list.find(
    (r) => r.schema === "store_sales" || r.reportCategory === "sales"
  );
  return storeSales ?? list[0] ?? null;
}

export function getReportMeta(id: string): StoredReportMeta | null {
  return readIndex().find((r) => r.id === id) ?? null;
}

export function readReportCsv(id: string): string | null {
  const file = csvPath(id);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf-8");
}

export function saveReport(
  fileName: string,
  csvText: string,
  options?: {
    label?: string;
    reportPeriod?: import("./types").ReportPeriod;
    reportCategory?: import("./types").ReportCategory;
    reportDate?: string | null;
    dateRange?: { from: string; to: string };
  }
): { meta: StoredReportMeta; summary: ReportSummary } {
  ensureDir();
  const id = uuidv4();
  const uploadedAt = new Date().toISOString();
  const displayLabel = options?.label?.trim() || fileName.replace(/\.csv$/i, "");

  const {
    rowCount,
    columns,
    reportDate,
    summary,
    reportPeriod,
    reportCategory,
    vendorCode,
    schema,
    dateRange,
  } = summarizeCsvText(csvText, {
    reportId: id,
    reportLabel: displayLabel,
    fileName,
    reportPeriod: options?.reportPeriod,
    reportCategory: options?.reportCategory,
  });

  const meta: StoredReportMeta = {
    id,
    fileName,
    label: displayLabel,
    uploadedAt,
    reportDate: options?.reportDate ?? reportDate,
    rowCount,
    columns,
    reportPeriod,
    reportCategory,
    vendorCode,
    schema,
    dateRange: options?.dateRange ?? dateRange,
  };

  if (options?.dateRange || options?.reportDate) {
    summary.reportDate = options?.reportDate ?? options?.dateRange?.to ?? summary.reportDate;
    summary.dateRange = options?.dateRange ?? summary.dateRange;
    summary.reportLabel = displayLabel;
  }

  fs.writeFileSync(csvPath(id), csvText, "utf-8");
  const reports = readIndex();
  reports.unshift(meta);
  writeIndex(reports);

  return { meta, summary };
}

export function deleteReport(id: string): boolean {
  const reports = readIndex();
  const idx = reports.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  reports.splice(idx, 1);
  writeIndex(reports);
  const file = csvPath(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return true;
}

/** Remove every stored report (used when replacing bundled sales data). */
export function clearAllReports(): number {
  ensureDir();
  const reports = readIndex();
  for (const r of reports) {
    const file = csvPath(r.id);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  if (fs.existsSync(INDEX_FILE)) fs.unlinkSync(INDEX_FILE);
  return reports.length;
}

export function getLatestReportWithSummary(options?: {
  filterDate?: string;
  filterDateFrom?: string;
  filterDateTo?: string;
  filterStore?: string;
  filterStores?: string[];
  filterDepartment?: string;
  filterDepartments?: string[];
  filterDesign?: string;
  filterDesigns?: string[];
  filterClass?: string;
  filterClasses?: string[];
  filterVendor?: string;
  filterVendors?: string[];
}): {
  meta: StoredReportMeta;
  summary: ReportSummary;
  csv: string;
  availableDates: string[];
  availableStores: string[];
  availableDepartments: string[];
  availableDesigns: string[];
  availableClasses: string[];
  availableVendors: string[];
} | null {
  ensureSeedReport();
  const meta = getLatestReportMeta();
  if (!meta) return null;
  const csv = readReportCsv(meta.id);
  if (!csv) return null;
  const dims = extractReportDimensions(csv);
  const availableDates =
    dims.dates.length > 0
      ? dims.dates
      : meta.dateRange
        ? datesInIsoRange(meta.dateRange.from, meta.dateRange.to)
        : [];
  const { summary } = summarizeCsvText(csv, {
    reportId: meta.id,
    reportLabel: meta.label,
    fileName: meta.fileName,
    reportPeriod: meta.reportPeriod,
    reportCategory: meta.reportCategory,
    filterDate: options?.filterDate,
    filterDateFrom: options?.filterDateFrom,
    filterDateTo: options?.filterDateTo,
    filterStore: options?.filterStore,
    filterStores: options?.filterStores,
    filterDepartment: options?.filterDepartment,
    filterDepartments: options?.filterDepartments,
    filterDesign: options?.filterDesign,
    filterDesigns: options?.filterDesigns,
    filterClass: options?.filterClass,
    filterClasses: options?.filterClasses,
    filterVendor: options?.filterVendor,
    filterVendors: options?.filterVendors,
  });
  return {
    meta,
    summary,
    csv,
    availableDates,
    availableStores: dims.stores,
    availableDepartments: dims.departments,
    availableDesigns: dims.designs,
    availableClasses: dims.classes,
    availableVendors: dims.vendors,
  };
}

export function getReportSummaryForSales(): ReportSummary | null {
  const latest = getLatestReportWithSummary();
  return latest?.summary ?? null;
}
