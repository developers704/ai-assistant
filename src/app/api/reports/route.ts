import { NextRequest, NextResponse } from "next/server";
import {
  deleteReport,
  getLatestReportMeta,
  listReports,
  readReportCsv,
  saveReport,
} from "@/lib/reports/store";
import { clearSalesWorkingMemory } from "@/lib/sales/sales-working-memory";
import { clearActiveSalesContext } from "@/lib/sales/active-context";
import { readActivePointer } from "@/lib/sales/data/version-store";
import { readSessionFromCookies } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const reports = listReports();
  return NextResponse.json({
    reports,
    latest: getLatestReportMeta() ?? reports[0] ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await readSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv")) {
    return NextResponse.json({ error: "Only CSV files are supported. Save Excel as CSV first." }, { status: 400 });
  }

  const label = String(formData.get("label") ?? "").trim();
  const reportPeriod = String(formData.get("reportPeriod") ?? "").trim() || undefined;
  const reportCategory = String(formData.get("reportCategory") ?? "").trim() || undefined;
  const uploadMode = String(formData.get("uploadMode") ?? "").trim() || undefined;
  const paycodeFile = formData.get("paycodeFile") as File | null;
  let csvText = await file.text();

  if (!csvText.trim()) {
    return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  }

  try {
    const {
      shouldAppendSalesUpload,
      mergeSalesCsvAppend,
    } = await import("@/lib/reports/merge-sales-csv");
    const { normalizeDailySalesCsv } = await import(
      "@/lib/reports/normalize-daily-sales-csv"
    );

    const wantsSales =
      !reportCategory || reportCategory === "sales";
    // Normalize spacer empty columns + Image Dir. → webp before append/save
    if (wantsSales) {
      csvText = normalizeDailySalesCsv(csvText);
    }
    const append =
      wantsSales &&
      shouldAppendSalesUpload({
        uploadMode,
        reportPeriod,
        reportCategory,
      });

    let mergeInfo: ReturnType<typeof mergeSalesCsvAppend> | null = null;
    let saveLabel = label || undefined;
    let savePeriod = reportPeriod as import("@/lib/reports/types").ReportPeriod | undefined;
    let saveDateRange: { from: string; to: string } | undefined;

    if (append) {
      const latest = getLatestReportMeta();
      const isLatestSales =
        latest &&
        (latest.schema === "store_sales" || latest.reportCategory === "sales");
      if (isLatestSales) {
        const prevCsv = readReportCsv(latest.id);
        if (prevCsv?.trim()) {
          mergeInfo = mergeSalesCsvAppend(prevCsv, csvText);
          csvText = mergeInfo.csvText;
          saveLabel = label || mergeInfo.suggestedLabel;
          savePeriod = "custom";
          saveDateRange = mergeInfo.dateRange ?? undefined;
        }
      }
    }

    const { meta, summary } = saveReport(file.name, csvText, {
      label: saveLabel,
      reportPeriod: savePeriod,
      reportCategory: reportCategory as import("@/lib/reports/types").ReportCategory | undefined,
      dateRange: saveDateRange,
    });

    // Optional companion paycode CSV (Transaction # → Pay Codes) for Discounting V1
    let paycodeSaved: {
      fileName: string;
      date: string;
      singleTenderTxnCount: number;
    } | null = null;
    if (wantsSales && paycodeFile && paycodeFile.size > 0) {
      const payName = paycodeFile.name.toLowerCase();
      if (!payName.endsWith(".csv")) {
        return NextResponse.json(
          { error: "Paycode file must be CSV." },
          { status: 400 }
        );
      }
      const payText = await paycodeFile.text();
      const { saveTxnPaycodesCsv } = await import(
        "@/lib/discounting/save-txn-paycodes"
      );
      const preferredDate =
        mergeInfo?.newDates?.sort().at(-1) ??
        meta.dateRange?.to ??
        summary.dateRange?.to ??
        null;
      paycodeSaved = saveTxnPaycodesCsv(payText, { preferredDate });
    }

    // New store-sales upload becomes the live source for dashboard / chat / voice
    const isLiveSales =
      meta.schema === "store_sales" || meta.reportCategory === "sales";
    let dataVersion: string | null = null;
    if (isLiveSales) {
      clearSalesWorkingMemory();
      clearActiveSalesContext();
      try {
        const { refreshSalesData } = await import("@/lib/sales/refresh/service");
        const refreshed = await refreshSalesData({ force: true, clearMemory: true });
        dataVersion = refreshed.dataVersion;
      } catch (err) {
        console.warn("Sales intelligence refresh failed after upload:", err);
      }
    }

    const mergedDays = mergeInfo?.newDates?.join(", ") ?? null;
    const payNote = paycodeSaved
      ? ` Paycodes saved (${paycodeSaved.fileName}, ${paycodeSaved.singleTenderTxnCount} single-tender txns).`
      : "";
    return NextResponse.json({
      report: meta,
      summary,
      liveForSales: isLiveSales,
      appended: Boolean(mergeInfo),
      merge: mergeInfo
        ? {
            newDates: mergeInfo.newDates,
            replacedDates: mergeInfo.replacedDates,
            keptOldRows: mergeInfo.keptOldRows,
            appendedRows: mergeInfo.appendedRows,
            totalRows: mergeInfo.totalRows,
            dateRange: mergeInfo.dateRange,
          }
        : null,
      paycode: paycodeSaved,
      dataVersion: dataVersion ?? readActivePointer().activeVersion,
      dateRange: meta.dateRange ?? summary.dateRange ?? null,
      message: mergeInfo
        ? `Appended ${mergeInfo.newDates.length} day(s) (${mergedDays}) into the live sales report (${mergeInfo.totalRows.toLocaleString()} rows total). Dashboard, chat, and voice now use the combined file.${payNote}`
        : isLiveSales
          ? `Saved as the latest sales report. Sales Dashboard, chat, and voice will use this file.${payNote}`
          : `Report saved.${payNote}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await readSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Report id required" }, { status: 400 });
  }
  if (!deleteReport(id)) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  clearSalesWorkingMemory();
  clearActiveSalesContext();
  let dataVersion: string | null = null;
  try {
    const { refreshSalesData } = await import("@/lib/sales/refresh/service");
    const refreshed = await refreshSalesData({ force: true, clearMemory: true });
    dataVersion = refreshed.dataVersion;
  } catch (err) {
    console.warn("Sales intelligence refresh failed after delete:", err);
  }

  return NextResponse.json({
    ok: true,
    dataVersion: dataVersion ?? readActivePointer().activeVersion,
  });
}
