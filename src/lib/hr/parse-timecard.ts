import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { HrTimecardRow } from "./types";
import { isoDateFromCell, parseDurationLabel } from "./time-utils";

function cellStr(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim() || null;
}

function rowsFromKeyed(records: Record<string, unknown>[]): HrTimecardRow[] {
  const out: HrTimecardRow[] = [];
  for (const row of records) {
    const keys = Object.keys(row);
    const nameKey =
      keys.find((k) => /payroll\s*name/i.test(k)) ?? keys.find((k) => /employee/i.test(k));
    const dateKey =
      keys.find((k) => /in\s*date/i.test(k)) ?? keys.find((k) => /^date$/i.test(k));
    const inKey = keys.find((k) => /time\s*in/i.test(k));
    const outKey = keys.find((k) => /time\s*out/i.test(k));
    const gapKey = keys.find((k) => /gap/i.test(k));
    const hoursKey = keys.find((k) => /hours/i.test(k));

    const name = nameKey ? cellStr(row[nameKey]) : null;
    const date = dateKey ? isoDateFromCell(row[dateKey]) : null;
    if (!name || !date) continue;

    out.push({
      employeeName: name,
      date,
      timeIn: inKey ? cellStr(row[inKey]) : null,
      timeOut: outKey ? cellStr(row[outKey]) : null,
      gapFromPrevious: gapKey ? cellStr(row[gapKey]) : null,
      hoursLabel: hoursKey ? cellStr(row[hoursKey]) : null,
    });
  }
  return out;
}

function rowsFromMatrix(matrix: unknown[][]): HrTimecardRow[] {
  const headerIdx = matrix.findIndex(
    (r) =>
      Array.isArray(r) &&
      String(r[0] ?? "")
        .toLowerCase()
        .includes("payroll")
  );
  if (headerIdx < 0) return [];
  const out: HrTimecardRow[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i] as unknown[];
    if (!r?.length) continue;
    const name = cellStr(r[0]);
    const date = isoDateFromCell(r[1]);
    if (!name || !date) continue;
    out.push({
      employeeName: name,
      date,
      timeIn: cellStr(r[2]),
      timeOut: cellStr(r[3]),
      gapFromPrevious: cellStr(r[4]),
      hoursLabel: cellStr(r[5]),
    });
  }
  return out;
}

export function parseTimecardCsv(text: string): HrTimecardRow[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return rowsFromKeyed(parsed.data ?? []);
}

export function parseTimecardXlsx(buffer: Buffer): HrTimecardRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    return rowsFromMatrix(matrix as unknown[][]);
  }

  return rowsFromKeyed(rows);
}

export function parseTimecardFile(fileName: string, data: Buffer | string): HrTimecardRow[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = typeof data === "string" ? data : data.toString("utf8");
    return parseTimecardCsv(text);
  }
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return parseTimecardXlsx(buffer);
}

export function timecardDateRange(rows: HrTimecardRow[]): { from: string; to: string } | null {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  if (!dates.length) return null;
  return { from: dates[0]!, to: dates[dates.length - 1]! };
}

export function workMinutesFromRow(row: HrTimecardRow): number {
  if (row.hoursLabel) return parseDurationLabel(row.hoursLabel);
  return 0;
}
