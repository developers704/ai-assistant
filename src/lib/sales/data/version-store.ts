import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type { VendorPosRow } from "@/lib/reports/types";
import {
  salesDashboardSnapshotSchema,
  type SalesDashboardSnapshot,
} from "../snapshot/schema";

const ROOT = path.join(process.cwd(), ".data", "sales");

export interface SalesVersionPointer {
  activeVersion: string | null;
  activatedAt: string | null;
}

export interface SalesVersionMetadata {
  dataVersion: string;
  fileName?: string;
  fileHash: string;
  /** When exclusion / return-pair rules change, refresh rebuilds even if fileHash matches. */
  exclusionRulesVersion?: number;
  reportId?: string;
  generatedAt: string;
  refreshedAt: string;
  dataThrough: string | null;
  rowCount: number;
  validRowCount: number;
  rejectedRowCount: number;
  dateRange: { from: string | null; to: string | null };
  /** Sorted unique transaction dates (ISO) — avoids re-parsing CSV for filter UI. */
  availableDates?: string[];
  warnings: string[];
}

/** Process-local caches — invalidated on write. */
let cachedPointer: SalesVersionPointer | null = null;
let cachedRowsVersion: string | null = null;
let cachedRows: VendorPosRow[] | null = null;
let cachedSnapshotVersion: string | null = null;
let cachedSnapshot: SalesDashboardSnapshot | null = null;
let cachedMetaVersion: string | null = null;
let cachedMeta: SalesVersionMetadata | null = null;

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.mkdirSync(path.join(ROOT, "versions"), { recursive: true });
}

function pointerPath() {
  return path.join(ROOT, "current.json");
}

function versionDir(version: string) {
  return path.join(ROOT, "versions", version);
}

export function hashSalesSource(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

export function makeDataVersion(now = new Date()): string {
  const d = now.toISOString().slice(0, 10).replace(/-/g, "_");
  const t = now.toISOString().slice(11, 19).replace(/:/g, "");
  return `sales_${d}_${t}`;
}

export function invalidateSalesVersionCaches() {
  cachedPointer = null;
  cachedRowsVersion = null;
  cachedRows = null;
  cachedSnapshotVersion = null;
  cachedSnapshot = null;
  cachedMetaVersion = null;
  cachedMeta = null;
}

export function readActivePointer(): SalesVersionPointer {
  if (cachedPointer) return cachedPointer;
  ensureRoot();
  try {
    const raw = fs.readFileSync(pointerPath(), "utf8");
    const parsed = JSON.parse(raw) as SalesVersionPointer;
    cachedPointer = {
      activeVersion: parsed.activeVersion ?? null,
      activatedAt: parsed.activatedAt ?? null,
    };
    return cachedPointer;
  } catch {
    cachedPointer = { activeVersion: null, activatedAt: null };
    return cachedPointer;
  }
}

export function writeActivePointer(version: string): SalesVersionPointer {
  ensureRoot();
  const next: SalesVersionPointer = {
    activeVersion: version,
    activatedAt: new Date().toISOString(),
  };
  const tmp = `${pointerPath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmp, pointerPath());
  if (cachedPointer?.activeVersion !== version) {
    cachedRowsVersion = null;
    cachedRows = null;
    cachedSnapshotVersion = null;
    cachedSnapshot = null;
    cachedMetaVersion = null;
    cachedMeta = null;
  }
  cachedPointer = next;
  return next;
}

export function readVersionMetadata(version: string): SalesVersionMetadata | null {
  if (cachedMetaVersion === version && cachedMeta) return cachedMeta;
  try {
    const raw = fs.readFileSync(path.join(versionDir(version), "metadata.json"), "utf8");
    cachedMeta = JSON.parse(raw) as SalesVersionMetadata;
    cachedMetaVersion = version;
    return cachedMeta;
  } catch {
    return null;
  }
}

export function readActiveSnapshot(): SalesDashboardSnapshot | null {
  const { activeVersion } = readActivePointer();
  if (!activeVersion) return null;
  return readVersionSnapshot(activeVersion);
}

export function readVersionSnapshot(version: string): SalesDashboardSnapshot | null {
  if (cachedSnapshotVersion === version && cachedSnapshot) return cachedSnapshot;
  try {
    const raw = fs.readFileSync(
      path.join(versionDir(version), "dashboard-snapshot.json"),
      "utf8"
    );
    const parsed = salesDashboardSnapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    cachedSnapshot = parsed.data;
    cachedSnapshotVersion = version;
    return cachedSnapshot;
  } catch {
    return null;
  }
}

export function readNormalizedRows(version?: string): VendorPosRow[] | null {
  const v = version ?? readActivePointer().activeVersion;
  if (!v) return null;
  if (cachedRowsVersion === v && cachedRows) return cachedRows;
  try {
    const raw = fs.readFileSync(path.join(versionDir(v), "normalized-rows.json"), "utf8");
    cachedRows = JSON.parse(raw) as VendorPosRow[];
    cachedRowsVersion = v;
    return cachedRows;
  } catch {
    return null;
  }
}

export function writeSalesVersion(args: {
  dataVersion: string;
  metadata: SalesVersionMetadata;
  snapshot: SalesDashboardSnapshot;
  rows: VendorPosRow[];
  rejectedRows?: unknown[];
  validationReport?: Record<string, unknown>;
}): void {
  ensureRoot();
  const dir = versionDir(args.dataVersion);
  fs.mkdirSync(dir, { recursive: true });

  const writeAtomic = (file: string, data: unknown) => {
    const full = path.join(dir, file);
    const tmp = `${full}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), "utf8");
    fs.renameSync(tmp, full);
  };

  writeAtomic("metadata.json", args.metadata);
  writeAtomic("dashboard-snapshot.json", args.snapshot);
  writeAtomic("normalized-rows.json", args.rows);
  writeAtomic("rejected-rows.json", args.rejectedRows ?? []);
  writeAtomic("validation-report.json", args.validationReport ?? { ok: true });

  invalidateSalesVersionCaches();
  cachedRows = args.rows;
  cachedRowsVersion = args.dataVersion;
  cachedSnapshot = args.snapshot;
  cachedSnapshotVersion = args.dataVersion;
  cachedMeta = args.metadata;
  cachedMetaVersion = args.dataVersion;
}

export function getActiveSalesStatus() {
  const pointer = readActivePointer();
  const meta = pointer.activeVersion
    ? readVersionMetadata(pointer.activeVersion)
    : null;
  return {
    activeVersion: pointer.activeVersion,
    activatedAt: pointer.activatedAt,
    metadata: meta,
    hasSnapshot: Boolean(pointer.activeVersion && readVersionSnapshot(pointer.activeVersion!)),
  };
}
