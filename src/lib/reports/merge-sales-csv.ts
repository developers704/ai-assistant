import Papa from "papaparse";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";
import { normalizeDailySalesCsv } from "@/lib/reports/normalize-daily-sales-csv";
import { normalizeSalesImageDir } from "@/lib/reports/product-image";

function normalizeRowDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getUTCFullYear()}-${String(raw.getUTCMonth() + 1).padStart(2, "0")}-${String(raw.getUTCDate()).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  const parsed = parseReportFilterDate(s);
  if (parsed && isValidIsoDate(parsed)) return parsed;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const iso = s.slice(0, 10);
    return isValidIsoDate(iso) ? iso : null;
  }
  return null;
}

function findDateColumn(fields: string[]): string | null {
  return (
    fields.find((f) => /transaction\s*date/i.test(f.trim())) ??
    fields.find((f) => /^date$/i.test(f.trim())) ??
    null
  );
}

function findImageDirColumn(fields: string[]): string | null {
  return fields.find((f) => /^image\s*dir\.?$/i.test(f.trim())) ?? null;
}

function parseCsvRows(csvText: string): {
  fields: string[];
  rows: Record<string, string>[];
} {
  // Drop spacer empty columns + force Image Dir. → webp before header parse
  const normalized = normalizeDailySalesCsv(csvText);
  const parsed = Papa.parse<Record<string, string>>(normalized, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const fields = (parsed.meta.fields ?? []).filter((f) => String(f ?? "").trim());
  const imageCol = findImageDirColumn(fields);
  const rows = parsed.data
    .filter((r) => Object.values(r).some((v) => String(v ?? "").trim()))
    .map((r) => {
      const out: Record<string, string> = {};
      for (const f of fields) {
        let v = String(r[f] ?? "");
        if (imageCol && f === imageCol) v = normalizeSalesImageDir(v);
        out[f] = v;
      }
      return out;
    });
  return { fields, rows };
}

function shortLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export type MergeSalesCsvResult = {
  csvText: string;
  /** Distinct ISO dates present in the uploaded (new) file */
  newDates: string[];
  /** Dates removed from the previous report because they appear in the new file */
  replacedDates: string[];
  dateRange: { from: string; to: string } | null;
  keptOldRows: number;
  appendedRows: number;
  totalRows: number;
  suggestedLabel: string;
};

/**
 * Append a daily (or multi-day) sales CSV into the current live report.
 * Rows in the old report whose Transaction Date appears in the new file are dropped
 * (re-uploading the same day replaces that day — no double-count), then new rows are appended.
 */
export function mergeSalesCsvAppend(
  previousCsvText: string,
  newCsvText: string
): MergeSalesCsvResult {
  const prev = parseCsvRows(previousCsvText);
  const next = parseCsvRows(newCsvText);

  if (next.rows.length === 0) {
    throw new Error("The daily CSV has no data rows.");
  }

  const nextDateCol = findDateColumn(next.fields);
  if (!nextDateCol) {
    throw new Error(
      'Daily append needs a "Transaction Date" column in the new CSV so days can be merged.'
    );
  }

  const newDates = new Set<string>();
  for (const row of next.rows) {
    const iso = normalizeRowDate(row[nextDateCol]);
    if (iso) newDates.add(iso);
  }

  if (newDates.size === 0) {
    throw new Error(
      "Could not read any valid Transaction Date values in the daily CSV. Check the date column."
    );
  }

  const prevDateCol = findDateColumn(prev.fields);
  const keptOld: Record<string, string>[] = [];
  const replacedDatesSet = new Set<string>();

  if (prevDateCol) {
    for (const row of prev.rows) {
      const iso = normalizeRowDate(row[prevDateCol]);
      if (iso && newDates.has(iso)) {
        replacedDatesSet.add(iso);
        continue;
      }
      keptOld.push(row);
    }
  } else {
    // No date column on old file — keep all old rows (new days still append)
    keptOld.push(...prev.rows);
  }

  // Union headers: previous order first, then any new columns
  const fieldSet = new Set<string>([...prev.fields, ...next.fields]);
  if (!fieldSet.has(nextDateCol) && nextDateCol) fieldSet.add(nextDateCol);
  const fields = Array.from(fieldSet);

  const skuField =
    fields.find((f) => /^sku\s*#?$/i.test(f.trim())) ?? null;
  const itemField =
    fields.find((f) => /^item\s*#?$/i.test(f.trim())) ?? null;
  const vendorModelField =
    fields.find((f) => /^vendor\s*model$/i.test(f.trim())) ?? null;
  const vendorModel1Field =
    fields.find((f) => /^vendormodel1$/i.test(f.trim()) || /^vendor\s*model\s*1$/i.test(f.trim())) ??
    null;

  const normalizeRow = (row: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const f of fields) out[f] = row[f] ?? "";
    // Daily format → canonical columns used by the historical seed
    if (skuField && itemField) {
      const sku = out[skuField]?.trim();
      const item = out[itemField]?.trim();
      if (!sku && item) out[skuField] = item;
      if (!item && sku) out[itemField] = sku;
    }
    if (vendorModelField && vendorModel1Field) {
      const vm = out[vendorModelField]?.trim();
      const vm1 = out[vendorModel1Field]?.trim();
      if (!vm && vm1) out[vendorModelField] = vm1;
      if (!vm1 && vm) out[vendorModel1Field] = vm;
    }
    return out;
  };

  const mergedRows = [...keptOld.map(normalizeRow), ...next.rows.map(normalizeRow)];

  const allDates = new Set<string>();
  const dateCol = findDateColumn(fields) ?? nextDateCol;
  for (const row of mergedRows) {
    const iso = normalizeRowDate(row[dateCol]);
    if (iso) allDates.add(iso);
  }
  const sortedDates = [...allDates].sort();
  const dateRange =
    sortedDates.length > 0
      ? { from: sortedDates[0], to: sortedDates[sortedDates.length - 1] }
      : null;

  const csvText = Papa.unparse({
    fields,
    data: mergedRows.map((r) => fields.map((f) => r[f] ?? "")),
  });

  const newSorted = [...newDates].sort();
  const suggestedLabel = dateRange
    ? dateRange.from === dateRange.to
      ? `Store Sales Report ${shortLabel(dateRange.from)}`
      : `Store Sales Report ${shortLabel(dateRange.from)}–${shortLabel(dateRange.to)}`
    : "Store Sales Report (merged)";

  return {
    csvText,
    newDates: newSorted,
    replacedDates: [...replacedDatesSet].sort(),
    dateRange,
    keptOldRows: keptOld.length,
    appendedRows: next.rows.length,
    totalRows: mergedRows.length,
    suggestedLabel,
  };
}

/** True when upload should append into the current sales report. */
export function shouldAppendSalesUpload(options: {
  uploadMode?: string | null;
  reportPeriod?: string | null;
  reportCategory?: string | null;
}): boolean {
  const mode = (options.uploadMode ?? "").toLowerCase().trim();
  if (mode === "replace" || mode === "overwrite") return false;
  if (mode === "append" || mode === "merge") return true;

  // Default: Daily store-sales uploads append
  const cat = (options.reportCategory ?? "").toLowerCase();
  const period = (options.reportPeriod ?? "").toLowerCase();
  const isSales = !cat || cat === "sales";
  return isSales && period === "daily";
}
