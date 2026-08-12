import Papa from "papaparse";
import {
  getLatestReportMeta,
  getLatestReportWithSummary,
  getReportMeta,
  readReportCsv,
} from "@/lib/reports/store";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import type { VendorPosRow } from "@/lib/reports/types";
import { filterExcludedSalesRows } from "@/lib/utils";
import { isSalesUnifiedIntelligenceEnabled } from "@/lib/sales/flags";
import {
  readActivePointer,
  readNormalizedRows,
} from "@/lib/sales/data/version-store";

/** Load normalized sales rows for rank / detail APIs. */
export function loadRankRows(
  reportId?: string,
  opts?: { skipSalesExclusions?: boolean }
): VendorPosRow[] | null {
  const skip = opts?.skipSalesExclusions === true;
  const latestMeta = getLatestReportMeta();
  const useVersion =
    isSalesUnifiedIntelligenceEnabled() &&
    (!reportId || !latestMeta || reportId === latestMeta.id);

  if (useVersion) {
    const pointer = readActivePointer();
    if (pointer.activeVersion) {
      const versionRows = readNormalizedRows(pointer.activeVersion);
      if (versionRows?.length) {
        return skip ? versionRows : filterExcludedSalesRows(versionRows);
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
  const rows = parseVendorPosRows(parsed.data ?? []).rows;
  return skip ? rows : filterExcludedSalesRows(rows);
}
