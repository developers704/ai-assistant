import { NextResponse } from "next/server";
import { getActiveSalesStatus } from "@/lib/sales/data/version-store";
import { getLatestReportMeta } from "@/lib/reports/store";
import { ensureActiveSalesVersion } from "@/lib/sales/refresh/service";

export async function GET() {
  await ensureActiveSalesVersion();
  const status = getActiveSalesStatus();
  const latest = getLatestReportMeta();
  return NextResponse.json({
    ok: true,
    activeVersion: status.activeVersion,
    activatedAt: status.activatedAt,
    hasSnapshot: status.hasSnapshot,
    metadata: status.metadata
      ? {
          dataVersion: status.metadata.dataVersion,
          fileName: status.metadata.fileName,
          dataThrough: status.metadata.dataThrough,
          rowCount: status.metadata.rowCount,
          validRowCount: status.metadata.validRowCount,
          rejectedRowCount: status.metadata.rejectedRowCount,
          dateRange: status.metadata.dateRange,
          refreshedAt: status.metadata.refreshedAt,
          warnings: status.metadata.warnings,
        }
      : null,
    latestReport: latest
      ? { id: latest.id, label: latest.label, fileName: latest.fileName, uploadedAt: latest.uploadedAt }
      : null,
  });
}
