/**
 * Append a daily payment-transactions CSV into the live overlay file.
 *
 * Same-day dumps (a date with many rows in the new file) replace that date
 * so re-uploading Aug 29 does not double-count. Sparse older dates in the
 * daily file (OL/CR leftovers) are upserted by Transaction # + Pay Code + date
 * so they do not wipe other days already in the overlay.
 */
import Papa from "papaparse";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";

function normalizeRowDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const parsed = parseReportFilterDate(s);
  if (parsed && isValidIsoDate(parsed)) return parsed;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const iso = s.slice(0, 10);
    return isValidIsoDate(iso) ? iso : null;
  }
  return null;
}

function collapseEmptyHeaders(csvText: string): string {
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: "greedy",
  });
  const table = (parsed.data ?? []).filter(
    (row) => Array.isArray(row) && row.some((c) => String(c ?? "").trim())
  ) as string[][];
  if (!table.length) return csvText;
  const header = table[0].map((h) => String(h ?? "").trim());
  const keepIdx = header
    .map((h, i) => (h.length > 0 ? i : -1))
    .filter((i) => i >= 0);
  if (!keepIdx.length) return csvText;
  const fields = keepIdx.map((i) => header[i]);
  const data = table.slice(1).map((row) => keepIdx.map((i) => String(row[i] ?? "")));
  return Papa.unparse({ fields, data });
}

function parseCsvRows(csvText: string): {
  fields: string[];
  rows: Record<string, string>[];
} {
  const parsed = Papa.parse<Record<string, string>>(collapseEmptyHeaders(csvText), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const fields = (parsed.meta.fields ?? []).filter((f) => String(f ?? "").trim());
  const rows = (parsed.data ?? [])
    .filter((r) => Object.values(r).some((v) => String(v ?? "").trim()))
    .map((r) => {
      const out: Record<string, string> = {};
      for (const f of fields) out[f] = String(r[f] ?? "");
      return out;
    });
  return { fields, rows };
}

function findCol(fields: string[], ...tests: RegExp[]): string | null {
  for (const re of tests) {
    const hit = fields.find((c) => re.test(c.trim()));
    if (hit) return hit;
  }
  return null;
}

function moneyKey(raw: string): string {
  const s = String(raw ?? "")
    .replace(/[$,]/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

function rowKey(
  row: Record<string, string>,
  cols: { txn: string | null; date: string | null; pay: string | null; applied: string | null }
): string {
  const tid = cols.txn ? String(row[cols.txn] ?? "").trim().toUpperCase() : "";
  const iso = cols.date ? normalizeRowDate(row[cols.date]) ?? "" : "";
  const pay = cols.pay ? String(row[cols.pay] ?? "").replace(/,+\s*$/, "").trim().toUpperCase() : "";
  const amt = cols.applied ? moneyKey(row[cols.applied] ?? "") : "";
  return `${tid}|${iso}|${pay}|${amt}`;
}

export type MergePaymentCsvResult = {
  csvText: string;
  newDates: string[];
  replacedDates: string[];
  keptOldRows: number;
  appendedRows: number;
  skippedDuplicateRows: number;
  totalRows: number;
};

/** Dates with at least this many new rows are treated as a full daily replace. */
const FULL_DAY_MIN_ROWS = 10;

export function mergePaymentCsvAppend(
  previousCsvText: string,
  newCsvText: string
): MergePaymentCsvResult {
  const prev = parseCsvRows(previousCsvText);
  const next = parseCsvRows(newCsvText);
  if (!next.rows.length) {
    throw new Error("The payment CSV has no data rows.");
  }

  const dateCol =
    findCol(next.fields, /^transaction\s*date$/i) ??
    findCol(prev.fields, /^transaction\s*date$/i);
  const txnCol =
    findCol(next.fields, /^transaction\s*#$/i) ??
    findCol(prev.fields, /^transaction\s*#$/i);
  const payCol =
    findCol(next.fields, /^pay\s*code$/i) ?? findCol(prev.fields, /^pay\s*code$/i);
  const appliedCol =
    findCol(next.fields, /^applied\s*amt$/i) ??
    findCol(prev.fields, /^applied\s*amt$/i);

  const dateCounts = new Map<string, number>();
  for (const row of next.rows) {
    const iso = dateCol ? normalizeRowDate(row[dateCol]) : null;
    if (!iso) continue;
    dateCounts.set(iso, (dateCounts.get(iso) ?? 0) + 1);
  }
  const replaceDates = new Set(
    [...dateCounts.entries()]
      .filter(([, n]) => n >= FULL_DAY_MIN_ROWS)
      .map(([d]) => d)
  );

  const cols = { txn: txnCol, date: dateCol, pay: payCol, applied: appliedCol };
  const prevDateCol = findCol(prev.fields, /^transaction\s*date$/i) ?? dateCol;

  const keptOld: Record<string, string>[] = [];
  for (const row of prev.rows) {
    const iso = prevDateCol ? normalizeRowDate(row[prevDateCol]) : null;
    if (iso && replaceDates.has(iso)) continue;
    keptOld.push(row);
  }

  const keptKeys = new Set(keptOld.map((r) => rowKey(r, cols)));
  const appended: Record<string, string>[] = [];
  let skippedDuplicateRows = 0;
  for (const row of next.rows) {
    const key = rowKey(row, cols);
    if (keptKeys.has(key)) {
      skippedDuplicateRows += 1;
      continue;
    }
    keptKeys.add(key);
    appended.push(row);
  }

  const fieldSet = new Set<string>([...prev.fields, ...next.fields]);
  const fields = Array.from(fieldSet);
  const normalizeRow = (row: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const f of fields) out[f] = row[f] ?? "";
    return out;
  };
  const merged = [...keptOld.map(normalizeRow), ...appended.map(normalizeRow)];
  const csvText = Papa.unparse({
    fields,
    data: merged.map((r) => fields.map((f) => r[f] ?? "")),
  });

  return {
    csvText,
    newDates: [...dateCounts.keys()].sort(),
    replacedDates: [...replaceDates].sort(),
    keptOldRows: keptOld.length,
    appendedRows: appended.length,
    skippedDuplicateRows,
    totalRows: merged.length,
  };
}
