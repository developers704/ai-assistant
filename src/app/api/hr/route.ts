import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import {
  listHrUploads,
  loadActiveScheduleEntries,
  loadActiveTimecardRows,
  saveScheduleUpload,
  saveTimecardUpload,
} from "@/lib/hr/store";
import { analyzeDay, distinctTimecardDates } from "@/lib/hr/analyze";
import {
  HR_ATTENDANCE_DATES,
  HR_ATTENDANCE_FROM,
  HR_ATTENDANCE_TO,
  lastHrAttendanceDateWithData,
} from "@/lib/hr/window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminOnly() {
  return readSessionFromCookies().then((session) => {
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    return null;
  });
}

export async function GET(req: NextRequest) {
  const denied = await adminOnly();
  if (denied) return denied;

  const date = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  const uploads = listHrUploads();
  const timecardRows = loadActiveTimecardRows();
  const scheduleEntries = loadActiveScheduleEntries();
  const dates = HR_ATTENDANCE_DATES;
  const punchDates = distinctTimecardDates(timecardRows);
  const scheduleDates = [...new Set(scheduleEntries.map((e) => e.date))];

  const activeDate =
    date && dates.includes(date)
      ? date
      : lastHrAttendanceDateWithData(punchDates, scheduleDates);

  const employees = activeDate
    ? analyzeDay(activeDate, timecardRows, scheduleEntries)
    : [];

  return NextResponse.json({
    uploads,
    dates,
    activeDate,
    employees,
    hasTimecard: timecardRows.length > 0,
    hasSchedule: scheduleEntries.length > 0,
    dateFrom: HR_ATTENDANCE_FROM,
    dateTo: HR_ATTENDANCE_TO,
    scheduleDateFrom: uploads.schedules[0]?.dateFrom ?? null,
    scheduleDateTo: uploads.schedules[0]?.dateTo ?? null,
  });
}

export async function POST(req: NextRequest) {
  const denied = await adminOnly();
  if (denied) return denied;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const kind = String(formData.get("kind") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (kind === "timecard") {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Upload Daily Timecard as .xlsx or .csv" },
        { status: 400 }
      );
    }
    const payload =
      name.endsWith(".csv") ? await file.text() : Buffer.from(await file.arrayBuffer());
    const { meta, rows } = saveTimecardUpload(file.name, payload);
    return NextResponse.json({
      ok: true,
      meta,
      rowCount: rows.length,
      dates: distinctTimecardDates(rows),
    });
  }

  if (kind === "schedule") {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Upload ADP schedule as .csv or .xlsx" },
        { status: 400 }
      );
    }
    const payload =
      name.endsWith(".csv") ? await file.text() : Buffer.from(await file.arrayBuffer());
    const { meta, entries } = saveScheduleUpload(file.name, payload);
    return NextResponse.json({
      ok: true,
      meta,
      entryCount: entries.length,
    });
  }

  return NextResponse.json({ error: "kind must be timecard or schedule" }, { status: 400 });
}
