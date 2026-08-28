import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { HrScheduleEntry } from "./types";
import { parseScheduleColumnDate, parseScheduleRange } from "./time-utils";

function normalizeScheduleCell(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // "08:00 AM - 04:00 PM\nVacation" → use time line only
  const firstLine = s.split(/\r?\n/)[0]!.trim();
  if (/^vacation$/i.test(firstLine)) return "";
  return firstLine;
}

export function parseScheduleMatrix(matrix: unknown[][]): {
  entries: HrScheduleEntry[];
  dateFrom: string | null;
  dateTo: string | null;
} {
  const rows = matrix.filter(
    (r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim())
  ) as unknown[][];

  let year = new Date().getFullYear();
  const title = String(rows[0]?.[0] ?? "");
  const yearMatch = title.match(/(\d{4})/);
  if (yearMatch) year = Number(yearMatch[1]);

  const headerRowIdx = rows.findIndex((r) =>
    /^employee$/i.test(String(r[0] ?? "").trim())
  );
  if (headerRowIdx < 0) {
    return { entries: [], dateFrom: null, dateTo: null };
  }

  const headers = rows[headerRowIdx]!.map((h) => String(h ?? "").trim());
  const dateCols: { idx: number; date: string }[] = [];
  for (let i = 1; i < headers.length; i++) {
    const d = parseScheduleColumnDate(headers[i]!, year);
    if (d) dateCols.push({ idx: i, date: d });
  }

  const entries: HrScheduleEntry[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]!;
    const employeeName = String(row[0] ?? "").trim();
    if (!employeeName) continue;
    for (const col of dateCols) {
      const cell = normalizeScheduleCell(row[col.idx]);
      const range = parseScheduleRange(cell);
      if (!range) continue;
      entries.push({
        employeeName,
        date: col.date,
        start: range.start,
        end: range.end,
      });
    }
  }

  const dates = dateCols.map((c) => c.date).sort();
  return {
    entries,
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
  };
}

export function parseScheduleCsv(text: string): {
  entries: HrScheduleEntry[];
  dateFrom: string | null;
  dateTo: string | null;
} {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const matrix = (parsed.data ?? []).filter(
    (r) => Array.isArray(r) && r.some((c) => String(c).trim())
  );
  return parseScheduleMatrix(matrix as unknown[][]);
}

export function parseScheduleXlsx(buffer: Buffer): {
  entries: HrScheduleEntry[];
  dateFrom: string | null;
  dateTo: string | null;
} {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return { entries: [], dateFrom: null, dateTo: null };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });
  return parseScheduleMatrix(matrix as unknown[][]);
}

export function scheduleForEmployeeDate(
  entries: HrScheduleEntry[],
  employeeName: string,
  date: string
): HrScheduleEntry | null {
  const norm = employeeName.trim().toLowerCase();
  return (
    entries.find(
      (e) => e.date === date && e.employeeName.trim().toLowerCase() === norm
    ) ?? null
  );
}
