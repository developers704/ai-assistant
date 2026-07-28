import Papa from "papaparse";
import {
  getLatestReportMeta,
  getLatestReportWithSummary,
  getReportMeta,
  readReportCsv,
} from "@/lib/reports/store";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import type { VendorPosRow } from "@/lib/reports/types";
import {
  filterExcludedSalesRows,
  SALES_EXCLUSION_RULES_VERSION,
} from "@/lib/utils";
import { isSalesUnifiedIntelligenceEnabled } from "@/lib/sales/flags";
import {
  readActivePointer,
  readNormalizedRows,
  readVersionMetadata,
} from "@/lib/sales/data/version-store";

/** Load normalized sales rows for rank / detail APIs. */
export function loadRankRows(reportId?: string): VendorPosRow[] | null {
  const latestMeta = getLatestReportMeta();
  const useVersion =
    isSalesUnifiedIntelligenceEnabled() &&
    (!reportId || !latestMeta || reportId === latestMeta.id);

  if (useVersion) {
    const pointer = readActivePointer();
    if (pointer.activeVersion) {
      const versionRows = readNormalizedRows(pointer.activeVersion);
      if (versionRows?.length) {
        const versionMeta = readVersionMetadata(pointer.activeVersion);
        if (versionMeta?.exclusionRulesVersion === SALES_EXCLUSION_RULES_VERSION) {
          return versionRows;
        }
        return filterExcludedSalesRows(versionRows);
      }
    }
  }

  let csv: string | null = null;
  if (reportId) {
    if (!getReportMeta(reportId)) return null;
    csv = readReportCsv(reportId);
  } else {
    const latest = getLatestReportWithSummary();
    csv = latest?.csv ?? null;
  }
  if (!csv) return null;
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return filterExcludedSalesRows(parseVendorPosRows(parsed.data ?? []).rows);
}
