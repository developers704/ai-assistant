import { NextRequest, NextResponse } from "next/server";
import {
  deleteReport,
  getLatestReportMeta,
  getLatestReportWithSummary,
  listReports,
  saveReport,
} from "@/lib/reports/store";

export const runtime = "nodejs";

export async function GET() {
  const reports = listReports();
  return NextResponse.json({
    reports,
    latest: getLatestReportMeta() ?? reports[0] ?? null,
  });
}

export async function POST(req: NextRequest) {
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
  const csvText = await file.text();

  if (!csvText.trim()) {
    return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  }

  try {
    const { meta, summary } = saveReport(file.name, csvText, {
      label: label || undefined,
      reportPeriod: reportPeriod as import("@/lib/reports/types").ReportPeriod | undefined,
      reportCategory: reportCategory as import("@/lib/reports/types").ReportCategory | undefined,
    });
    return NextResponse.json({ report: meta, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Report id required" }, { status: 400 });
  }
  if (!deleteReport(id)) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
