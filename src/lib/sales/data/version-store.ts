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
  reportId?: string;
  generatedAt: string;
  refreshedAt: string;
  dataThrough: string | null;
  rowCount: number;
  validRowCount: number;
  rejectedRowCount: number;
  dateRange: { from: string | null; to: string | null };
  warnings: string[];
}

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

export function readActivePointer(): SalesVersionPointer {
  ensureRoot();
  try {
    const raw = fs.readFileSync(pointerPath(), "utf8");
    const parsed = JSON.parse(raw) as SalesVersionPointer;
    return {
      activeVersion: parsed.activeVersion ?? null,
      activatedAt: parsed.activatedAt ?? null,
    };
  } catch {
    return { activeVersion: null, activatedAt: null };
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
  return next;
}

export function readVersionMetadata(version: string): SalesVersionMetadata | null {
  try {
    const raw = fs.readFileSync(path.join(versionDir(version), "metadata.json"), "utf8");
    return JSON.parse(raw) as SalesVersionMetadata;
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
  try {
    const raw = fs.readFileSync(
      path.join(versionDir(version), "dashboard-snapshot.json"),
      "utf8"
    );
    const parsed = salesDashboardSnapshotSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readNormalizedRows(version?: string): VendorPosRow[] | null {
  const v = version ?? readActivePointer().activeVersion;
  if (!v) return null;
  try {
    const raw = fs.readFileSync(path.join(versionDir(v), "normalized-rows.json"), "utf8");
    return JSON.parse(raw) as VendorPosRow[];
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
