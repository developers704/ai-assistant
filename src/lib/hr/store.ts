import fs from "fs";
import path from "path";
import type { HrScheduleEntry, HrTimecardRow, HrUploadMeta } from "./types";
import { parseTimecardFile, timecardDateRange } from "./parse-timecard";
import { parseScheduleCsv, parseScheduleXlsx } from "./parse-schedule";

const DATA_DIR = path.join(process.cwd(), ".data", "hr");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

type HrIndex = {
  timecards: HrUploadMeta[];
  schedules: HrUploadMeta[];
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "timecards"), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "schedules"), { recursive: true });
}

function readIndex(): HrIndex {
  ensureDir();
  if (!fs.existsSync(INDEX_PATH)) {
    return { timecards: [], schedules: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as HrIndex;
  } catch {
    return { timecards: [], schedules: [] };
  }
}

function writeIndex(index: HrIndex) {
  ensureDir();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
}

function newId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ext(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i).toLowerCase() : "";
}

export function listHrUploads(): HrIndex {
  return readIndex();
}

export function saveTimecardUpload(
  fileName: string,
  data: Buffer | string
): {
  meta: HrUploadMeta;
  rows: HrTimecardRow[];
} {
  ensureDir();
  const rows = parseTimecardFile(fileName, data);
  const range = timecardDateRange(rows);
  const id = newId();
  const meta: HrUploadMeta = {
    id,
    kind: "timecard",
    fileName,
    uploadedAt: new Date().toISOString(),
    dateFrom: range?.from,
    dateTo: range?.to,
  };

  const suffix = ext(fileName) || ".dat";
  if (typeof data === "string") {
    fs.writeFileSync(path.join(DATA_DIR, "timecards", `${id}${suffix}`), data, "utf8");
  } else {
    fs.writeFileSync(path.join(DATA_DIR, "timecards", `${id}${suffix}`), data);
  }
  fs.writeFileSync(
    path.join(DATA_DIR, "timecards", `${id}.json`),
    JSON.stringify(rows),
    "utf8"
  );

  const index = readIndex();
  index.timecards.unshift(meta);
  index.timecards = index.timecards.slice(0, 60);
  writeIndex(index);

  return { meta, rows };
}

export function saveScheduleUpload(
  fileName: string,
  data: Buffer | string
): {
  meta: HrUploadMeta;
  entries: HrScheduleEntry[];
} {
  ensureDir();
  const lower = fileName.toLowerCase();
  const parsed =
    lower.endsWith(".xlsx") || lower.endsWith(".xls")
      ? parseScheduleXlsx(Buffer.isBuffer(data) ? data : Buffer.from(data as string))
      : parseScheduleCsv(typeof data === "string" ? data : data.toString("utf8"));

  const { entries, dateFrom, dateTo } = parsed;
  const id = newId();
  const meta: HrUploadMeta = {
    id,
    kind: "schedule",
    fileName,
    uploadedAt: new Date().toISOString(),
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
  };

  const suffix = ext(fileName) || ".dat";
  if (typeof data === "string") {
    fs.writeFileSync(path.join(DATA_DIR, "schedules", `${id}${suffix}`), data, "utf8");
  } else {
    fs.writeFileSync(path.join(DATA_DIR, "schedules", `${id}${suffix}`), data);
  }
  fs.writeFileSync(
    path.join(DATA_DIR, "schedules", `${id}.json`),
    JSON.stringify(entries),
    "utf8"
  );

  const index = readIndex();
  index.schedules.unshift(meta);
  index.schedules = index.schedules.slice(0, 30);
  writeIndex(index);

  return { meta, entries };
}

export function loadActiveTimecardRows(): HrTimecardRow[] {
  const index = readIndex();
  const latest = index.timecards[0];
  if (!latest) return [];
  const jsonPath = path.join(DATA_DIR, "timecards", `${latest.id}.json`);
  if (!fs.existsSync(jsonPath)) return [];
  return JSON.parse(fs.readFileSync(jsonPath, "utf8")) as HrTimecardRow[];
}

export function loadActiveScheduleEntries(): HrScheduleEntry[] {
  const index = readIndex();
  const latest = index.schedules[0];
  if (!latest) return [];
  const jsonPath = path.join(DATA_DIR, "schedules", `${latest.id}.json`);
  if (!fs.existsSync(jsonPath)) return [];
  return JSON.parse(fs.readFileSync(jsonPath, "utf8")) as HrScheduleEntry[];
}
