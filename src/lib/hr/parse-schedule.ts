import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { HrScheduleEntry } from "./types";
import { namesMatch } from "./name-match";
import {
  isoDateFromCell,
  parseClockToMinutes,
  parseScheduleColumnDate,
  parseScheduleRange,
} from "./time-utils";
import { datesInIsoRange, HR_ATTENDANCE_FROM, HR_ATTENDANCE_TO } from "./window";

function normalizeScheduleCell(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // "08:00 AM - 04:00 PM\nVacation" → use time line only
  const firstLine = s.split(/\r?\n/)[0]!.trim();
  if (/^vacation$/i.test(firstLine)) return "";
  return firstLine;
}

function headerCells(row: unknown[]): string[] {
  return row.map((c) => String(c ?? "").trim());
}

function isLongFormatHeader(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase());
  return (
    lower.some((h) => /^date$/.test(h)) &&
    lower.some((h) => /employee/.test(h)) &&
    lower.some((h) => /^time\s*in$/.test(h)) &&
    lower.some((h) => /^time\s*out$/.test(h))
  );
}

function colIndex(headers: string[], pattern: RegExp): number {
  return headers.findIndex((h) => pattern.test(h.trim()));
}

function clockCell(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return parseClockToMinutes(s) != null ? s : null;
}

/** Date, Employee Name, Time In, Time Out — one scheduled shift per row. */
export function parseLongFormatSchedule(matrix: unknown[][]): {
  entries: HrScheduleEntry[];
  dateFrom: string | null;
  dateTo: string | null;
} {
  const rows = matrix.filter(
    (r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim())
  ) as unknown[][];
  const headerRowIdx = rows.findIndex((r) => isLongFormatHeader(headerCells(r)));
  if (headerRowIdx < 0) {
    return { entries: [], dateFrom: null, dateTo: null };
  }
  const headers = headerCells(rows[headerRowIdx]!);
  const dateI = colIndex(headers, /^date$/i);
  const nameI = colIndex(headers, /employee/i);
  const inI = colIndex(headers, /^time\s*in$/i);
  const outI = colIndex(headers, /^time\s*out$/i);
  const entries: HrScheduleEntry[] = [];
  const dates: string[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]!;
    const employeeName = String(row[nameI] ?? "").trim();
    const date = isoDateFromCell(row[dateI]);
    const start = clockCell(row[inI]);
    const end = clockCell(row[outI]);
    if (!employeeName || !date || !start || !end) continue;
    entries.push({ employeeName, date, start, end });
    dates.push(date);
  }
  dates.sort();
  return {
    entries,
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
  };
}

export function parseScheduleMatrix(matrix: unknown[][]): {
  entries: HrScheduleEntry[];
  dateFrom: string | null;
  dateTo: string | null;
} {
  const rows = matrix.filter(
    (r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim())
  ) as unknown[][];

  if (rows.some((r) => isLongFormatHeader(headerCells(r)))) {
    return parseLongFormatSchedule(rows);
  }

  let year = Number(HR_ATTENDANCE_FROM.slice(0, 4)) || new Date().getFullYear();
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

function utcWeekday(iso: string): number {
  return new Date(`${iso}T12:00:00.000Z`).getUTCDay();
}

/**
 * A weekly ADP grid is one week of shifts. Repeat that weekday pattern across
 * the HR attendance window. Files that already span more than 8 distinct dates
 * (including the August long-format month file) are left as-is.
 */
export function expandWeeklyScheduleToWindow(
  entries: HrScheduleEntry[],
  fromIso = HR_ATTENDANCE_FROM,
  toIso = HR_ATTENDANCE_TO
): HrScheduleEntry[] {
  if (!entries.length) return entries;
  const uniqueDates = [...new Set(entries.map((e) => e.date))].sort();
  if (uniqueDates.length > 8) return entries;

  const windowDates = datesInIsoRange(fromIso, toIso);
  if (!windowDates.length) return entries;

  const templates: HrScheduleEntry[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const key = `${e.employeeName}\0${utcWeekday(e.date)}\0${e.start}\0${e.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    templates.push(e);
  }

  const out: HrScheduleEntry[] = [];
  const outSeen = new Set<string>();
  for (const d of windowDates) {
    const wd = utcWeekday(d);
    for (const t of templates) {
      if (utcWeekday(t.date) !== wd) continue;
      const key = `${t.employeeName}\0${d}\0${t.start}\0${t.end}`;
      if (outSeen.has(key)) continue;
      outSeen.add(key);
      out.push({
        employeeName: t.employeeName,
        date: d,
        start: t.start,
        end: t.end,
      });
    }
  }
  return out;
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
  return (
    entries.find((e) => e.date === date && namesMatch(e.employeeName, employeeName)) ?? null
  );
}
