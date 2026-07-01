import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { summarizeCsvText, extractReportDates } from "./summarize-csv";
import type { ReportSummary, StoredReportMeta } from "./types";

const REPORTS_DIR = path.join(process.cwd(), ".data", "reports");
const INDEX_FILE = path.join(REPORTS_DIR, "index.json");

function ensureDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
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
  return readIndex().sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

export function getLatestReportMeta(): StoredReportMeta | null {
  const list = listReports();
  return list[0] ?? null;
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
    reportDate,
    rowCount,
    columns,
    reportPeriod,
    reportCategory,
    vendorCode,
    schema,
    dateRange,
  };

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

export function getLatestReportWithSummary(options?: { filterDate?: string }): {
  meta: StoredReportMeta;
  summary: ReportSummary;
  csv: string;
  availableDates: string[];
} | null {
  const meta = getLatestReportMeta();
  if (!meta) return null;
  const csv = readReportCsv(meta.id);
  if (!csv) return null;
  const availableDates = extractReportDates(csv);
  const { summary } = summarizeCsvText(csv, {
    reportId: meta.id,
    reportLabel: meta.label,
    fileName: meta.fileName,
    reportPeriod: meta.reportPeriod,
    reportCategory: meta.reportCategory,
    filterDate: options?.filterDate,
  });
  return { meta, summary, csv, availableDates };
}

export function getReportSummaryForSales(): ReportSummary | null {
  const latest = getLatestReportWithSummary();
  return latest?.summary ?? null;
}
