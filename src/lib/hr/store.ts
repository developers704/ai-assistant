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
import { hrLog } from "./logger";
import { clearHrRuntimeCache } from "./hr-runtime-cache";
import { resetHrNoticeStore } from "./warning-store";

const DATA_DIR = path.join(process.cwd(), ".data", "hr");
const INDEX_PATH = path.join(DATA_DIR, "index.json");
const SEED_TIMECARD = path.join(process.cwd(), "data", "hr", "Timecard-August-2026.csv");
const SEED_SCHEDULE = path.join(process.cwd(), "data", "hr", "Schedule-August-2026.csv");
/** Marks that the operator replaced seed data — never auto-restore August files. */
const USER_DATA_KEY = "user";

/** One-shot: drop stacked August uploads + test warnings on deploy. */
const HR_RUNTIME_RESET_KEY = "fresh-august-2026-09-10";

type HrIndex = {
  timecards: HrUploadMeta[];
  schedules: HrUploadMeta[];
  seedKey?: string;
  runtimeResetKey?: string;
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
    return `august2026:${tc.mtimeMs}:${tc.size}:${sc.mtimeMs}:${sc.size}`;
  } catch {
    return null;
  }
}

function wipeHrFiles() {
  for (const sub of ["timecards", "schedules"] as const) {
    retainOnlyUpload(sub, null);
  }
}

/** Keep only the active upload id (or wipe the folder). Drops orphan month/week files. */
function retainOnlyUpload(kind: "timecards" | "schedules", keepId: string | null) {
  const dir = path.join(DATA_DIR, kind);
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (keepId && (name.startsWith(`${keepId}.`) || name === keepId)) continue;
    fs.unlinkSync(path.join(dir, name));
    hrLog.info("db.delete", {
      file: path.join(dir, name),
      reason: keepId ? "replace-active-upload" : "seed-refresh",
    });
  }
}

function purgeOrphanUploads(index: HrIndex) {
  retainOnlyUpload("timecards", index.timecards[0]?.id ?? null);
  retainOnlyUpload("schedules", index.schedules[0]?.id ?? null);
}

function isTestEnv() {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/**
 * Seed August demo files once on a virgin install.
 * Never wipe / restore seed after the operator uploads or clears data —
 * that was re-injecting thousands of old employees on every request.
 *
 * One-shot runtime reset: stacked month+week August files and test
 * warnings/write-ups are dropped, then the latest seed CSVs are loaded.
 */
function ensureSeedHr() {
  const key = seedFingerprint();
  if (!key) return;
  ensureDir();
  const index = readIndexRaw();

  if (!isTestEnv() && index.runtimeResetKey !== HR_RUNTIME_RESET_KEY) {
    wipeHrFiles();
    resetHrNoticeStore();
    clearHrRuntimeCache();
    writeIndex({
      timecards: [],
      schedules: [],
      seedKey: key,
      runtimeResetKey: HR_RUNTIME_RESET_KEY,
    });
    saveTimecardUpload("Timecard-August-2026.csv", fs.readFileSync(SEED_TIMECARD, "utf8"), {
      asSeed: true,
    });
    saveScheduleUpload("Schedule-August-2026.csv", fs.readFileSync(SEED_SCHEDULE, "utf8"), {
      asSeed: true,
    });
    const after = readIndexRaw();
    after.seedKey = key;
    after.runtimeResetKey = HR_RUNTIME_RESET_KEY;
    writeIndex(after);
    return;
  }

  purgeOrphanUploads(index);
  if (index.seedKey === USER_DATA_KEY) return;
  if (index.timecards.length > 0 || index.schedules.length > 0) return;
  if (index.seedKey === key) return;

  wipeHrFiles();
  writeIndex({
    timecards: [],
    schedules: [],
    seedKey: key,
    runtimeResetKey: index.runtimeResetKey ?? HR_RUNTIME_RESET_KEY,
  });
  saveTimecardUpload("Timecard-August-2026.csv", fs.readFileSync(SEED_TIMECARD, "utf8"), {
    asSeed: true,
  });
  saveScheduleUpload("Schedule-August-2026.csv", fs.readFileSync(SEED_SCHEDULE, "utf8"), {
    asSeed: true,
  });
  const after = readIndexRaw();
  after.seedKey = key;
  after.runtimeResetKey = index.runtimeResetKey ?? HR_RUNTIME_RESET_KEY;
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
  hrLog.info("db.write", {
    file: INDEX_PATH,
    table: "hr_upload_index",
    timecardCount: index.timecards.length,
    scheduleCount: index.schedules.length,
    seedKey: index.seedKey,
    runtimeResetKey: index.runtimeResetKey,
  });
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
  data: Buffer | string,
  opts?: { asSeed?: boolean }
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
  index.timecards = [meta];
  if (!opts?.asSeed) index.seedKey = USER_DATA_KEY;
  writeIndex(index);
  retainOnlyUpload("timecards", id);
  clearHrRuntimeCache();
  hrLog.info("db.insert", {
    file: `${DATA_DIR}/timecards/${id}.json`,
    table: "hr_timecards",
    id,
    fileName,
    rowCount: rows.length,
    dateRange: range,
  });

  return { meta, rows };
}

export function saveScheduleUpload(
  fileName: string,
  data: Buffer | string,
  opts?: { asSeed?: boolean }
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
  index.schedules = [meta];
  if (!opts?.asSeed) index.seedKey = USER_DATA_KEY;
  writeIndex(index);
  retainOnlyUpload("schedules", id);
  clearHrRuntimeCache();
  hrLog.info("db.insert", {
    file: `${DATA_DIR}/schedules/${id}.json`,
    table: "hr_schedules",
    id,
    fileName,
    entryCount: entries.length,
    dateFrom,
    dateTo,
  });

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
