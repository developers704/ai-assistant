import fs from "fs";
import path from "path";
import type { HrScheduleEntry, HrTimecardRow, HrUploadMeta } from "./types";
import { parseTimecardFile, timecardDateRange } from "./parse-timecard";
import {
  expandWeeklyScheduleToWindow,
  parseScheduleCsv,
  parseScheduleXlsx,
} from "./parse-schedule";
import { HR_ATTENDANCE_FROM, HR_ATTENDANCE_TO } from "./window";

const DATA_DIR = path.join(process.cwd(), ".data", "hr");
const INDEX_PATH = path.join(DATA_DIR, "index.json");
const SEED_TIMECARD = path.join(process.cwd(), "data", "hr", "Timecard-July-2026.csv");
const SEED_SCHEDULE = path.join(process.cwd(), "data", "hr", "Schedule-July-2026.csv");

type HrIndex = {
  timecards: HrUploadMeta[];
  schedules: HrUploadMeta[];
  seedKey?: string;
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "timecards"), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "schedules"), { recursive: true });
}

function seedFingerprint(): string | null {
  try {
    const tc = fs.statSync(SEED_TIMECARD);
    const sc = fs.statSync(SEED_SCHEDULE);
    return `july2026w2:${tc.mtimeMs}:${tc.size}:${sc.mtimeMs}:${sc.size}`;
  } catch {
    return null;
  }
}

function wipeHrFiles() {
  for (const sub of ["timecards", "schedules"] as const) {
    const dir = path.join(DATA_DIR, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      fs.unlinkSync(path.join(dir, name));
    }
  }
}

function ensureSeedHr() {
  const key = seedFingerprint();
  if (!key) return;
  ensureDir();
  const index = readIndexRaw();
  if (index.seedKey === key && index.timecards.length > 0 && index.schedules.length > 0) {
    return;
  }
  wipeHrFiles();
  writeIndex({ timecards: [], schedules: [], seedKey: key });
  saveTimecardUpload("Timecard-July-2026.csv", fs.readFileSync(SEED_TIMECARD, "utf8"));
  saveScheduleUpload("Schedule-July-2026.csv", fs.readFileSync(SEED_SCHEDULE, "utf8"));
  const after = readIndexRaw();
  after.seedKey = key;
  writeIndex(after);
}

function readIndexRaw(): HrIndex {
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

function readIndex(): HrIndex {
  ensureSeedHr();
  return readIndexRaw();
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

  const index = readIndexRaw();
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

  const entries = expandWeeklyScheduleToWindow(parsed.entries);
  const dates = [...new Set(entries.map((e) => e.date))].sort();
  const dateFrom = dates[0] ?? parsed.dateFrom;
  const dateTo = dates[dates.length - 1] ?? parsed.dateTo;
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

  const index = readIndexRaw();
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
  const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as HrTimecardRow[];
  return rows.filter(
    (r) => r.date >= HR_ATTENDANCE_FROM && r.date <= HR_ATTENDANCE_TO
  );
}

export function loadActiveScheduleEntries(): HrScheduleEntry[] {
  const index = readIndex();
  const latest = index.schedules[0];
  if (!latest) return [];
  const jsonPath = path.join(DATA_DIR, "schedules", `${latest.id}.json`);
  if (!fs.existsSync(jsonPath)) return [];
  const entries = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as HrScheduleEntry[];
  return entries.filter(
    (e) => e.date >= HR_ATTENDANCE_FROM && e.date <= HR_ATTENDANCE_TO
  );
}
