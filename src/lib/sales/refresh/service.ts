import Papa from "papaparse";
import { filterExcludedSalesRows, SALES_EXCLUSION_RULES_VERSION } from "@/lib/utils";
import { TOP_MODELS_MARGIN_RULES_VERSION } from "@/lib/sales/top-models-wholesale-margin";
import {
  getLatestReportMeta,
  getReportMeta,
  readReportCsv,
} from "@/lib/reports/store";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import { buildSalesDashboardSnapshot } from "@/lib/sales/snapshot/builder";
import { salesDashboardSnapshotSchema } from "@/lib/sales/snapshot/schema";
import {
  hashSalesSource,
  makeDataVersion,
  readActivePointer,
  readVersionMetadata,
  writeActivePointer,
  writeSalesVersion,
} from "@/lib/sales/data/version-store";
import { invalidateSalesQueryCache } from "@/lib/sales/query-cache";
import { setActiveSalesContext, clearActiveSalesContext } from "@/lib/sales/active-context";
import { clearSalesWorkingMemory } from "@/lib/sales/sales-working-memory";

let refreshLock: Promise<RefreshSalesResult> | null = null;

export interface RefreshSalesResult {
  success: boolean;
  dataVersion: string | null;
  skipped?: boolean;
  rowsProcessed: number;
  validRows: number;
  rejectedRows: number;
  dateRange: { from: string | null; to: string | null };
  generatedAt: string;
  warnings: string[];
  errors: string[];
}

/**
 * Atomic sales refresh: parse → normalize → snapshot → activate.
 * Keeps previous active version if validation fails.
 */
export async function refreshSalesData(options?: {
  force?: boolean;
  clearMemory?: boolean;
}): Promise<RefreshSalesResult> {
  if (refreshLock) return refreshLock;

  refreshLock = (async () => {
    const generatedAt = new Date().toISOString();
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const meta = getLatestReportMeta();
      if (!meta) {
        return {
          success: false,
          dataVersion: null,
          rowsProcessed: 0,
          validRows: 0,
          rejectedRows: 0,
          dateRange: { from: null, to: null },
          generatedAt,
          warnings,
          errors: ["No sales report is currently loaded."],
        };
      }

      const csv = readReportCsv(meta.id);
      if (!csv) {
        return {
          success: false,
          dataVersion: null,
          rowsProcessed: 0,
          validRows: 0,
          rejectedRows: 0,
          dateRange: { from: null, to: null },
          generatedAt,
          warnings,
          errors: ["Sales report CSV is missing on disk."],
        };
      }

      const fileHash = meta.contentHash ?? hashSalesSource(csv);
      const pointer = readActivePointer();
      if (pointer.activeVersion && !options?.force) {
        const existing = readVersionMetadata(pointer.activeVersion);
        if (
          existing?.fileHash === fileHash &&
          existing.exclusionRulesVersion === SALES_EXCLUSION_RULES_VERSION &&
          existing.topModelsMarginRulesVersion === TOP_MODELS_MARGIN_RULES_VERSION
        ) {
          return {
            success: true,
            dataVersion: pointer.activeVersion,
            skipped: true,
            rowsProcessed: existing.rowCount,
            validRows: existing.validRowCount,
            rejectedRows: existing.rejectedRowCount,
            dateRange: existing.dateRange,
            generatedAt,
            warnings: ["Active version already matches latest report hash."],
            errors: [],
          };
        }
      }

      const parsed = Papa.parse<Record<string, unknown>>(csv, {
        header: true,
        skipEmptyLines: true,
      });
      const { rows: rawRows } = parseVendorPosRows(parsed.data ?? []);
      const validRows = filterExcludedSalesRows(rawRows);
      const rejectedRows = rawRows.length - validRows.length;
      if (!validRows.length) {
        return {
          success: false,
          dataVersion: pointer.activeVersion,
          rowsProcessed: rawRows.length,
          validRows: 0,
          rejectedRows,
          dateRange: { from: null, to: null },
          generatedAt,
          warnings,
          errors: ["No valid sales rows after normalization and exclusions."],
        };
      }

      const availableDates = [
        ...new Set(validRows.map((r) => r.date).filter(Boolean)),
      ].sort();

      const dataVersion = makeDataVersion();
      const snapshot = buildSalesDashboardSnapshot({
        dataVersion,
        rows: validRows,
        rejectedCount: rejectedRows,
        fileName: meta.fileName,
        fileHash,
        warnings,
      });

      const validated = salesDashboardSnapshotSchema.safeParse(snapshot);
      if (!validated.success) {
        errors.push(...validated.error.issues.map((i) => i.message));
        return {
          success: false,
          dataVersion: pointer.activeVersion,
          rowsProcessed: rawRows.length,
          validRows: validRows.length,
          rejectedRows,
          dateRange: snapshot.source.dateRange,
          generatedAt,
          warnings,
          errors,
        };
      }

      if (!snapshot.status.isValidated) {
        errors.push(...snapshot.status.validationErrors);
        return {
          success: false,
          dataVersion: pointer.activeVersion,
          rowsProcessed: rawRows.length,
          validRows: validRows.length,
          rejectedRows,
          dateRange: snapshot.source.dateRange,
          generatedAt,
          warnings,
          errors,
        };
      }

      writeSalesVersion({
        dataVersion,
        metadata: {
          dataVersion,
          fileName: meta.fileName,
          fileHash,
          exclusionRulesVersion: SALES_EXCLUSION_RULES_VERSION,
          topModelsMarginRulesVersion: TOP_MODELS_MARGIN_RULES_VERSION,
          reportId: meta.id,
          generatedAt,
          refreshedAt: generatedAt,
          dataThrough: snapshot.dataThrough,
          rowCount: rawRows.length,
          validRowCount: validRows.length,
          rejectedRowCount: rejectedRows,
          dateRange: snapshot.source.dateRange,
          availableDates,
          warnings,
        },
        snapshot: validated.data,
        // Store raw parsed rows; query layer filters (Rozina can skip for full CSV).
        rows: rawRows,
        rejectedRows: [],
        validationReport: { ok: true, reconciledNetSales: snapshot.summary.netSales },
      });

      writeActivePointer(dataVersion);
      invalidateSalesQueryCache();
      // Drop stale dashboard/voice filters from the previous report (stores, dates, etc.).
      clearActiveSalesContext();
      setActiveSalesContext({
        dataVersion,
      });
      if (options?.clearMemory) clearSalesWorkingMemory();

      return {
        success: true,
        dataVersion,
        rowsProcessed: rawRows.length,
        validRows: validRows.length,
        rejectedRows,
        dateRange: snapshot.source.dateRange,
        generatedAt,
        warnings,
        errors: [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        dataVersion: readActivePointer().activeVersion,
        rowsProcessed: 0,
        validRows: 0,
        rejectedRows: 0,
        dateRange: { from: null, to: null },
        generatedAt,
        warnings,
        errors: [message],
      };
    } finally {
      refreshLock = null;
    }
  })();

  return refreshLock;
}

/** Ensure an active version exists and matches latest report + exclusion rules. */
export async function ensureActiveSalesVersion(): Promise<string | null> {
  const pointer = readActivePointer();
  if (pointer.activeVersion) {
    const existing = readVersionMetadata(pointer.activeVersion);
    const latestHash = peekLatestReportHash();
    const rulesMatch =
      existing?.exclusionRulesVersion === SALES_EXCLUSION_RULES_VERSION &&
      existing?.topModelsMarginRulesVersion === TOP_MODELS_MARGIN_RULES_VERSION;
    const hashMatch =
      !latestHash || !existing?.fileHash || existing.fileHash === latestHash;
    if (rulesMatch && hashMatch) {
      return pointer.activeVersion;
    }
  }
  const result = await refreshSalesData({ force: true, clearMemory: true });
  return result.success ? result.dataVersion : pointer.activeVersion;
}

/** Prefer stored contentHash on report meta — avoids reading 7MB CSV on every ensure. */
export function peekLatestReportHash(): string | null {
  const meta = getLatestReportMeta();
  if (!meta) return null;
  if (meta.contentHash) return meta.contentHash;
  // Legacy reports without contentHash: hash once from disk.
  try {
    const csv = readReportCsv(meta.id);
    return csv ? hashSalesSource(csv) : null;
  } catch {
    return null;
  }
}

/** Report meta for the active sales version (no CSV summarize). */
export function getActiveVersionReportMeta() {
  const pointer = readActivePointer();
  if (!pointer.activeVersion) return null;
  const versionMeta = readVersionMetadata(pointer.activeVersion);
  if (!versionMeta) return null;
  const report =
    (versionMeta.reportId ? getReportMeta(versionMeta.reportId) : null) ??
    getLatestReportMeta();
  return { pointer, versionMeta, report };
}
