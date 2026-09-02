import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { formatHrDateLabel, parseClockToMinutes } from "@/lib/hr/time-utils";
import { parseTimecardCsv } from "@/lib/hr/parse-timecard";
import { expandWeeklyScheduleToWindow, parseScheduleCsv } from "@/lib/hr/parse-schedule";
import { analyzeDay, analyzeEmployeeDay } from "@/lib/hr/analyze";
import { namesMatch } from "@/lib/hr/name-match";
import {
  formatHrAttendanceWindowCaption,
  HR_ATTENDANCE_DATES,
  HR_ATTENDANCE_FROM,
  HR_ATTENDANCE_TO,
  lastHrAttendanceDateWithData,
  MISSING_PUNCH_LABEL,
} from "@/lib/hr/window";
import type { HrTimecardRow } from "@/lib/hr/types";

describe("parseClockToMinutes 24h", () => {
  it("parses 24-hour punches against AM/PM schedule times", () => {
    expect(parseClockToMinutes("9:28")).toBe(9 * 60 + 28);
    expect(parseClockToMinutes("14:24")).toBe(14 * 60 + 24);
    expect(parseClockToMinutes("09:20 AM")).toBe(9 * 60 + 20);
    expect(parseClockToMinutes("9:28")! - parseClockToMinutes("09:20 AM")!).toBe(8);
  });
});

describe("HR date labels", () => {
  it("labels June 1 2026 as Monday", () => {
    expect(formatHrDateLabel("2026-06-01")).toBe("Mon · Jun 1");
    expect(formatHrDateLabel("2026-06-07")).toBe("Sun · Jun 7");
  });

  it("locks the attendance window to June 1–7 2026", () => {
    expect(HR_ATTENDANCE_FROM).toBe("2026-06-01");
    expect(HR_ATTENDANCE_TO).toBe("2026-06-07");
    expect(HR_ATTENDANCE_DATES).toHaveLength(7);
    expect(HR_ATTENDANCE_DATES[0]).toBe("2026-06-01");
    expect(HR_ATTENDANCE_DATES.at(-1)).toBe("2026-06-07");
    expect(formatHrAttendanceWindowCaption()).toBe("June 1 – 7, 2026");
    expect(MISSING_PUNCH_LABEL).toBe("missing.");
    expect(HR_ATTENDANCE_DATES).not.toContain("2026-06-08");
    expect(HR_ATTENDANCE_DATES).not.toContain("2026-06-30");
  });

  it("defaults to the last date with punches in the week", () => {
    expect(lastHrAttendanceDateWithData(["2026-06-07"], ["2026-06-01"])).toBe("2026-06-07");
    expect(lastHrAttendanceDateWithData([], ["2026-06-07"])).toBe("2026-06-07");
  });
});

describe("June 2026 seed files", () => {
  const timecardPath = path.join(process.cwd(), "data/hr/Timecard-June-2026.csv");
  const schedulePath = path.join(process.cwd(), "data/hr/Schedule-June-2026.csv");
  const timecard = fs.readFileSync(timecardPath, "utf8");
  const schedule = fs.readFileSync(schedulePath, "utf8");

  it("parses June punch dates (no July leftover)", () => {
    const rows = parseTimecardCsv(timecard);
    expect(rows.length).toBeGreaterThan(1000);
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    expect(dates[0]).toBe("2026-06-01");
    expect(dates.every((d) => d.startsWith("2026-06-"))).toBe(true);
    expect(rows.some((r) => r.date.startsWith("2026-07-"))).toBe(false);
    const inWindow = rows.filter(
      (r) => r.date >= HR_ATTENDANCE_FROM && r.date <= HR_ATTENDANCE_TO
    );
    const windowDates = [...new Set(inWindow.map((r) => r.date))].sort();
    expect(windowDates[0]).toBe("2026-06-01");
    expect(windowDates.at(-1)).toBe("2026-06-07");
    expect(windowDates).toHaveLength(7);
  });

  it("parses the ADP week as Mon 06/01 through Sun 06/07 2026", () => {
    const { entries, dateFrom, dateTo } = parseScheduleCsv(schedule);
    expect(dateFrom).toBe("2026-06-01");
    expect(dateTo).toBe("2026-06-07");
    expect(entries.length).toBeGreaterThan(50);
    expect(entries.every((e) => e.date >= "2026-06-01" && e.date <= "2026-06-07")).toBe(true);
  });

  it("keeps schedule and punches on June 1–7 only", () => {
    const { entries } = parseScheduleCsv(schedule);
    const expanded = expandWeeklyScheduleToWindow(entries);
    const dates = [...new Set(expanded.map((e) => e.date))].sort();
    expect(dates[0]).toBe("2026-06-01");
    expect(dates.at(-1)).toBe("2026-06-07");
    expect(dates).toHaveLength(7);
    expect(expanded.some((e) => e.date > "2026-06-07")).toBe(false);
    const week1 = entries.find(
      (e) => e.date === "2026-06-01" && /1, security guard/i.test(e.employeeName)
    );
    expect(week1).toBeTruthy();
    expect(
      expanded.some(
        (e) => e.date === "2026-06-08" && /1, security guard/i.test(e.employeeName)
      )
    ).toBe(false);
  });

  it("matches security guard 1 on June 1 worked hours vs 24h punches", () => {
    const rows = parseTimecardCsv(timecard);
    const { entries } = parseScheduleCsv(schedule);
    const punches = rows.filter(
      (r) => r.date === "2026-06-01" && /1, security guard/i.test(r.employeeName)
    );
    const day = analyzeEmployeeDay("1, security guard", "2026-06-01", punches, entries);
    expect(day.schedule?.start).toMatch(/09:20 AM/);
    expect(day.totalWorkLabel).toBe("10:37");
    expect(day.lateMinutes).toBeNull();
    expect(day.segments[0]!.timeIn).toBe("9:28");
    expect(day.segments[0]!.timeOut).toBe("14:24");
  });

  it("shows missing punches for a scheduled employee with no clock-ins", () => {
    const { entries } = parseScheduleCsv(schedule);
    const scheduled = entries.find((e) => e.date === "2026-06-01");
    expect(scheduled).toBeTruthy();
    const day = analyzeEmployeeDay(scheduled!.employeeName, "2026-06-01", [], entries);
    expect(day.segments).toHaveLength(1);
    expect(day.segments[0]!.timeIn).toBeNull();
    expect(day.segments[0]!.timeOut).toBeNull();
    expect(day.violations.filter((v) => v.type === "missing_punch")).toHaveLength(2);
  });

  it("flags both missing Time In and Time Out on a punch row", () => {
    const punches: HrTimecardRow[] = [
      {
        employeeName: "Test, employee",
        date: "2026-06-01",
        timeIn: null,
        timeOut: null,
        gapFromPrevious: null,
        hoursLabel: null,
      },
    ];
    const day = analyzeEmployeeDay("Test, employee", "2026-06-01", punches, []);
    expect(day.violations.filter((v) => v.type === "missing_punch")).toHaveLength(2);
  });

  it("flags Shazia Ahmed 29 minutes late on Jun 7 with Manager AJ", () => {
    const rows = parseTimecardCsv(timecard);
    const { entries } = parseScheduleCsv(schedule);
    const punches = rows.filter(
      (r) => r.date === "2026-06-07" && /ahmed,\s*shazia/i.test(r.employeeName)
    );
    expect(punches.length).toBeGreaterThan(0);
    expect(punches[0]!.employeeCode).toBe("SA2");
    expect(punches[0]!.jobTitle).toBe("Corporate Manager");
    expect(punches[0]!.manager).toBe("AJ");
    expect(punches[0]!.store).toBe("Admin");
    expect(punches[0]!.timeIn).toBe("11:29");
    const day = analyzeEmployeeDay("Ahmed, Shazia", "2026-06-07", punches, entries);
    expect(day.lateMinutes).toBe(29);
    expect(day.employeeCode).toBe("SA2");
    expect(day.manager).toBe("AJ");
    expect(day.jobTitle).toBe("Corporate Manager");
    expect(day.schedule?.start).toMatch(/11:00 AM/);
  });

  it("includes every scheduled name for June 1 even without punches", () => {
    const rows = parseTimecardCsv(timecard).filter((r) => r.date === "2026-06-01");
    const { entries } = parseScheduleCsv(schedule);
    const employees = analyzeDay("2026-06-01", rows, entries);
    const scheduled = entries.filter((e) => e.date === "2026-06-01");
    for (const entry of scheduled) {
      expect(employees.some((emp) => namesMatch(emp.employeeName, entry.employeeName))).toBe(
        true
      );
    }
  });
});
