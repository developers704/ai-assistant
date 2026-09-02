import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { HrTimecardRow } from "./types";
import { isoDateFromCell, parseDurationLabel } from "./time-utils";

function cellStr(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim() || null;
}

function findKey(keys: string[], pattern: RegExp): string | undefined {
  return keys.find((k) => pattern.test(k.trim()));
}

function rowsFromKeyed(records: Record<string, unknown>[]): HrTimecardRow[] {
  const out: HrTimecardRow[] = [];
  for (const row of records) {
    const keys = Object.keys(row);
    const nameKey =
      findKey(keys, /payroll\s*name/i) ?? findKey(keys, /employee\s*name/i);
    const dateKey = findKey(keys, /in\s*date/i) ?? findKey(keys, /^date$/i);
    const inKey = findKey(keys, /^time\s*in$/i);
    const outKey = findKey(keys, /^time\s*out$/i);
    const gapKey = findKey(keys, /gap/i);
    const hoursKey = findKey(keys, /hours/i);
    const codeKey = findKey(keys, /^(employee\s*)?code$/i);
    const titleKey = findKey(keys, /designation|job\s*title/i);
    const storeKey = findKey(keys, /^store$/i);
    const managerKey = findKey(keys, /^manager$/i);
    const guardsKey = findKey(keys, /guards?\s*name/i);

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
      employeeCode: codeKey ? cellStr(row[codeKey]) : null,
      jobTitle: titleKey ? cellStr(row[titleKey]) : null,
      store: storeKey ? cellStr(row[storeKey]) : null,
      manager: managerKey ? cellStr(row[managerKey]) : null,
      guardsName: guardsKey ? cellStr(row[guardsKey]) : null,
    });
  }
  return out;
}

function colIndex(header: unknown[], pattern: RegExp): number {
  return header.findIndex((h) => pattern.test(String(h ?? "").trim()));
}

function at(r: unknown[], i: number): string | null {
  if (i < 0) return null;
  return cellStr(r[i]);
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
  const header = (matrix[headerIdx] as unknown[]) ?? [];
  const nameI = colIndex(header, /payroll\s*name/i);
  const dateI = colIndex(header, /in\s*date/i);
  const inI = colIndex(header, /^time\s*in$/i);
  const outI = colIndex(header, /^time\s*out$/i);
  const gapI = colIndex(header, /gap/i);
  const hoursI = colIndex(header, /hours/i);
  const codeI = colIndex(header, /^(employee\s*)?code$/i);
  const titleI = colIndex(header, /designation|job\s*title/i);
  const storeI = colIndex(header, /^store$/i);
  const managerI = colIndex(header, /^manager$/i);
  const guardsI = colIndex(header, /guards?\s*name/i);
  const legacy = dateI < 0;
  const out: HrTimecardRow[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i] as unknown[];
    if (!r?.length) continue;
    const name = at(r, nameI >= 0 ? nameI : 0);
    const date = isoDateFromCell(r[legacy ? 1 : dateI]);
    if (!name || !date) continue;
    out.push({
      employeeName: name,
      date,
      timeIn: legacy ? cellStr(r[2]) : at(r, inI),
      timeOut: legacy ? cellStr(r[3]) : at(r, outI),
      gapFromPrevious: legacy ? cellStr(r[4]) : at(r, gapI),
      hoursLabel: legacy ? cellStr(r[5]) : at(r, hoursI),
      employeeCode: at(r, codeI),
      jobTitle: at(r, titleI),
      store: at(r, storeI),
      manager: at(r, managerI),
      guardsName: at(r, guardsI),
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
