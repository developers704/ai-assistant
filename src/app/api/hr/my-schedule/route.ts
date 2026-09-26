import { NextResponse } from "next/server";
import { requireHrSalesAccess } from "@/lib/auth/hr-guard";
import { readSessionFromCookies } from "@/lib/auth/session";
import { findAuthUser } from "@/lib/auth/users";
import { listHrUploads, loadActiveScheduleEntries, loadActiveTimecardRows } from "@/lib/hr/store";
import { buildMyAttendance, buildMySchedule, scheduleNamesForUser } from "@/lib/hr/my-schedule";
import { analyzeDays } from "@/lib/hr/analyze";
import { namesMatch } from "@/lib/hr/name-match";
import { findAbsenceWaiver, listWarningNotices } from "@/lib/hr/warning-store";
import { HR_ATTENDANCE_DATES, HR_ATTENDANCE_FROM, HR_ATTENDANCE_TO } from "@/lib/hr/window";
import { formatMinutes } from "@/lib/hr/time-utils";
import { AUGUST_COMMISSION_FROM, AUGUST_COMMISSION_TO } from "@/lib/hr/august-2026-commission-data";
import { routeLog } from "@/lib/hr/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Assigned shifts for the signed-in user only. Open to HR Sales employees as
 * well as HR Management; the response never includes another employee's schedule.
 */
export async function GET() {
  const denied = await requireHrSalesAccess();
  if (denied) return denied;

  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const live = findAuthUser(session.username);
  const user = {
    name: live?.name ?? session.name,
    employeeCode: live?.employeeCode ?? null,
  };
  const scheduleMeta = listHrUploads().schedules[0] ?? null;
  const entries = loadActiveScheduleEntries();
  const punches = loadActiveTimecardRows();
  const { matchedNames, shifts } = buildMySchedule(user, entries, punches);

  // This HR month's attendance for the signed-in employee only.
  const ownNames = scheduleNamesForUser(user, punches);
  const ownDays = analyzeDays(HR_ATTENDANCE_DATES, punches, entries).filter((day) =>
    ownNames.some((n) => namesMatch(day.employeeName, n))
  );
  const attendance = buildMyAttendance(ownDays, listWarningNotices(), (day) =>
    Boolean(findAbsenceWaiver(day.employeeName, day.date, day.employeeCode))
  );
  const scheduledMinutes = shifts.reduce((sum, s) => sum + s.scheduledMinutes, 0);

  routeLog("src/app/api/hr/my-schedule/route.ts", "GET my schedule", {
    actor: session.username,
    matchedNames,
    shiftCount: shifts.length,
  });

  return NextResponse.json({
    employeeName: user.name,
    matchedNames,
    hasScheduleUpload: entries.length > 0,
    from: scheduleMeta?.dateFrom ?? null,
    to: scheduleMeta?.dateTo ?? null,
    fileName: scheduleMeta?.fileName ?? null,
    shifts,
    totals: {
      shiftCount: shifts.length,
      scheduledMinutes,
      scheduledLabel: formatMinutes(scheduledMinutes),
    },
    // Commission structure, timecard, and schedule cover the same HR month.
    attendanceFrom: HR_ATTENDANCE_FROM,
    attendanceTo: HR_ATTENDANCE_TO,
    attendance: attendance.days,
    attendanceTotals: attendance.totals,
    commissionFrom: AUGUST_COMMISSION_FROM,
    commissionTo: AUGUST_COMMISSION_TO,
  });
}
