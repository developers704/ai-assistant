import { NextResponse } from "next/server";
import {
  getLatestReportWithSummary,
  getReportMeta,
  readReportCsv,
} from "@/lib/reports/store";
import { summarizeCsvText } from "@/lib/reports/summarize-csv";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const meta = getReportMeta(id);
    if (!meta) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    const csv = readReportCsv(id);
    if (!csv) {
      return NextResponse.json({ error: "Report file missing" }, { status: 404 });
    }
    const { summary } = summarizeCsvText(csv, { reportId: meta.id, reportLabel: meta.label });
    return NextResponse.json({ report: meta, summary, csv });
  }

  const latest = getLatestReportWithSummary();
  if (!latest) {
    return NextResponse.json({ report: null, summary: null, csv: null });
  }
  return NextResponse.json(latest);
}
