import { NextRequest, NextResponse } from "next/server";
import { requireHrManagement } from "@/lib/auth/hr-guard";
import {
  listHrUploads,
  loadActiveScheduleEntries,
  loadActiveTimecardRows,
  saveScheduleUpload,
  saveTimecardUpload,
} from "@/lib/hr/store";
import { analyzeDays, distinctTimecardDates } from "@/lib/hr/analyze";
import { namesMatch } from "@/lib/hr/name-match";
import { listWarningNotices, noticeKind, findAbsenceWaiver } from "@/lib/hr/warning-store";
import {
  HR_ATTENDANCE_DATES,
  HR_ATTENDANCE_FROM,
  HR_ATTENDANCE_TO,
  lastHrAttendanceDateWithData,
} from "@/lib/hr/window";
import { routeLog } from "@/lib/hr/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireHrManagement();
  if (denied) return denied;

  const date = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  const fromParam = req.nextUrl.searchParams.get("from")?.trim() ?? "";
  const toParam = req.nextUrl.searchParams.get("to")?.trim() ?? "";
  routeLog("src/app/api/hr/route.ts", "GET attendance", { date, from: fromParam, to: toParam });
  const uploads = listHrUploads();
  const timecardRows = loadActiveTimecardRows();
  const scheduleEntries = loadActiveScheduleEntries();
  const dates = HR_ATTENDANCE_DATES;
  const punchDates = distinctTimecardDates(timecardRows);
  const scheduleDates = [...new Set(scheduleEntries.map((e) => e.date))];

  let activeDates: string[] = [];
  if (fromParam && toParam) {
    const from = fromParam <= toParam ? fromParam : toParam;
    const to = fromParam <= toParam ? toParam : fromParam;
    activeDates = dates.filter((d) => d >= from && d <= to);
  } else if (date && dates.includes(date)) {
    activeDates = [date];
  } else {
    const fallback = lastHrAttendanceDateWithData(punchDates, scheduleDates);
    activeDates = fallback ? [fallback] : [];
  }

  const activeDate = activeDates.at(-1) ?? null;
  const employees = activeDates.length
    ? analyzeDays(activeDates, timecardRows, scheduleEntries)
    : [];
  const notices = listWarningNotices();
  const withWarnings = employees.map((emp) => {
    const absenceWaiver = findAbsenceWaiver(emp.employeeName, emp.date, emp.employeeCode);
    return {
      ...emp,
      warning:
        notices.find(
          (n) =>
            n.date === emp.date &&
            namesMatch(n.employeeName, emp.employeeName) &&
            noticeKind(n) === "warning"
        ) ?? null,
      writeUp:
        notices.find(
          (n) =>
            n.date === emp.date &&
            namesMatch(n.employeeName, emp.employeeName) &&
            noticeKind(n) === "writeup"
        ) ?? null,
      absenceWaiver,
      absenceWaived: Boolean(absenceWaiver),
    };
  });

  const hasContactEmails = timecardRows.some(
    (r) => Boolean(r.userEmail?.trim()) || Boolean(r.mail?.trim())
  );
  const response = {
    uploads,
    dates,
    activeDate,
    activeDates,
    employees: withWarnings,
    hasTimecard: timecardRows.length > 0,
    hasSchedule: scheduleEntries.length > 0,
    hasContactEmails,
    dateFrom: HR_ATTENDANCE_FROM,
    dateTo: HR_ATTENDANCE_TO,
    scheduleDateFrom: uploads.schedules[0]?.dateFrom ?? null,
    scheduleDateTo: uploads.schedules[0]?.dateTo ?? null,
  };
  routeLog("src/app/api/hr/route.ts", "GET attendance complete", {
    activeDates,
    employeeCount: withWarnings.length,
    warningCount: withWarnings.filter((e) => e.warning).length,
    writeUpCount: withWarnings.filter((e) => e.writeUp).length,
    timecardRows: timecardRows.length,
    scheduleEntries: scheduleEntries.length,
  });
  return NextResponse.json(response);
}

export async function POST(req: NextRequest) {
  const denied = await requireHrManagement();
  if (denied) return denied;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const kind = String(formData.get("kind") ?? "").trim();
  const file = formData.get("file") as File | null;
  routeLog("src/app/api/hr/route.ts", "POST upload", { kind, fileName: file?.name, fileSize: file?.size });
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
    const hasContactEmails = rows.some(
      (r) => Boolean(r.userEmail?.trim()) || Boolean(r.mail?.trim())
    );
    routeLog("src/app/api/hr/route.ts", "POST timecard complete", {
      fileName: file.name,
      rowCount: rows.length,
      hasContactEmails,
      meta,
    });
    return NextResponse.json({
      ok: true,
      meta,
      rowCount: rows.length,
      hasContactEmails,
      warning: hasContactEmails
        ? undefined
        : "Timecard uploaded, but UserEmail / Mail columns were not found. Warning chat and email need those columns.",
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
    routeLog("src/app/api/hr/route.ts", "POST schedule complete", { fileName: file.name, entryCount: entries.length, meta });
    return NextResponse.json({
      ok: true,
      meta,
      entryCount: entries.length,
    });
  }

  return NextResponse.json({ error: "kind must be timecard or schedule" }, { status: 400 });
}
