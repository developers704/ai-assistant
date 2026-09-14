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
import { keepHrAttendanceEmployee } from "@/lib/hr/attendance-roster";

describe("parseClockToMinutes AM/PM", () => {
  it("parses AM/PM punches against schedule times", () => {
    expect(parseClockToMinutes("9:22 AM")).toBe(9 * 60 + 22);
    expect(parseClockToMinutes("2:20 PM")).toBe(14 * 60 + 20);
    expect(parseClockToMinutes("09:15 AM")).toBe(9 * 60 + 15);
    expect(parseClockToMinutes("9:22 AM")! - parseClockToMinutes("09:15 AM")!).toBe(7);
  });
});

describe("HR date labels", () => {
  it("labels August 1 2026 as Saturday", () => {
    expect(formatHrDateLabel("2026-08-01")).toBe("Sat · Aug 1");
    expect(formatHrDateLabel("2026-08-31")).toBe("Mon · Aug 31");
  });

  it("locks the attendance window to August 1–31 2026", () => {
    expect(HR_ATTENDANCE_FROM).toBe("2026-08-01");
    expect(HR_ATTENDANCE_TO).toBe("2026-08-31");
    expect(HR_ATTENDANCE_DATES).toHaveLength(31);
    expect(HR_ATTENDANCE_DATES[0]).toBe("2026-08-01");
    expect(HR_ATTENDANCE_DATES.at(-1)).toBe("2026-08-31");
    expect(formatHrAttendanceWindowCaption()).toBe("August 1 – 31, 2026");
    expect(MISSING_PUNCH_LABEL).toBe("missing.");
    expect(HR_ATTENDANCE_DATES).not.toContain("2026-07-31");
    expect(HR_ATTENDANCE_DATES).not.toContain("2026-09-01");
    expect(HR_ATTENDANCE_DATES).not.toContain("2026-06-01");
  });

  it("defaults to the last date with punches in the month", () => {
    expect(lastHrAttendanceDateWithData(["2026-08-31"], ["2026-08-01"])).toBe("2026-08-31");
    expect(lastHrAttendanceDateWithData([], ["2026-08-31"])).toBe("2026-08-31");
  });
});

describe("August 2026 seed files", () => {
  const timecardPath = path.join(process.cwd(), "data/hr/Timecard-August-2026.csv");
  const schedulePath = path.join(process.cwd(), "data/hr/Schedule-August-2026.csv");
  const timecard = fs.readFileSync(timecardPath, "utf8");
  const schedule = fs.readFileSync(schedulePath, "utf8");

  it("parses August punch dates (no June leftover)", () => {
    const rows = parseTimecardCsv(timecard);
    expect(rows.length).toBeGreaterThan(1000);
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    expect(dates[0]).toBe("2026-08-01");
    expect(dates.at(-1)).toBe("2026-08-31");
    expect(dates.every((d) => d.startsWith("2026-08-"))).toBe(true);
    expect(rows.some((r) => r.date.startsWith("2026-06-"))).toBe(false);
    expect(rows.some((r) => r.date.startsWith("2026-07-"))).toBe(false);
    const inWindow = rows.filter(
      (r) => r.date >= HR_ATTENDANCE_FROM && r.date <= HR_ATTENDANCE_TO
    );
    const windowDates = [...new Set(inWindow.map((r) => r.date))].sort();
    expect(windowDates[0]).toBe("2026-08-01");
    expect(windowDates.at(-1)).toBe("2026-08-31");
    expect(windowDates).toHaveLength(31);
  });

  it("parses the long-format schedule for August 1–31 2026", () => {
    const { entries, dateFrom, dateTo } = parseScheduleCsv(schedule);
    expect(dateFrom).toBe("2026-08-01");
    expect(dateTo).toBe("2026-08-31");
    expect(entries.length).toBeGreaterThan(50);
    expect(entries.every((e) => e.date >= "2026-08-01" && e.date <= "2026-08-31")).toBe(true);
    const guard1 = entries.find(
      (e) => e.date === "2026-08-01" && namesMatch(e.employeeName, "1, security guard")
    );
    expect(guard1?.start).toMatch(/9:15 AM/i);
    expect(guard1?.end).toMatch(/9:00 PM/i);
  });

  it("does not expand the full-month schedule across extra weeks", () => {
    const { entries } = parseScheduleCsv(schedule);
    const expanded = expandWeeklyScheduleToWindow(entries);
    const dates = [...new Set(expanded.map((e) => e.date))].sort();
    expect(dates[0]).toBe("2026-08-01");
    expect(dates.at(-1)).toBe("2026-08-31");
    expect(dates).toHaveLength(31);
    expect(expanded).toHaveLength(entries.length);
    expect(expanded.some((e) => e.date.startsWith("2026-06-"))).toBe(false);
  });

  it("keeps sales associates and managers only (drops guard 1 / Syed Muqeet Asim)", () => {
    const rows = parseTimecardCsv(timecard);
    expect(rows.every((r) => /sales associate|manager/i.test(r.jobTitle ?? ""))).toBe(true);
    expect(
      rows.some(
        (r) =>
          namesMatch(r.employeeName, "1, security guard") ||
          /syed\s+muqeet\s+asim/i.test(r.employeeName) ||
          /syed\s+muqeet\s+asim/i.test(r.guardsName ?? "")
      )
    ).toBe(false);
    const punches = rows.filter(
      (r) => r.date === "2026-08-01" && namesMatch(r.employeeName, "2, security guard")
    );
    const { entries } = parseScheduleCsv(schedule);
    const day = analyzeEmployeeDay("2, Security Guard", "2026-08-01", punches, entries);
    expect(punches.length).toBeGreaterThan(0);
    expect(punches[0]!.jobTitle).toBe("Sales Associate");
    expect(day.displayName).toBe("Muhammad Aleem");
    expect(day.employeeCode).toBe("AM5");
    expect(day.schedule?.start).toMatch(/9:15 AM/i);
    expect(day.totalWorkLabel).toBe("11:09");
    expect(day.totalMealLabel).toBe("1:01");
    expect(day.lateMinutes).toBeNull();
    expect(day.segments[0]!.timeIn).toBe("9:09 AM");
    expect(day.segments[0]!.timeOut).toBe("1:53 PM");
    expect(day.violations.some((v) => v.type === "no_schedule")).toBe(false);
  });

  it("pairs Last, First payroll names with Last First schedule names", () => {
    const rows = parseTimecardCsv(timecard);
    const { entries } = parseScheduleCsv(schedule);
    const punches = rows.filter(
      (r) => r.date === "2026-08-01" && /altaf,\s*fahad/i.test(r.employeeName)
    );
    expect(punches.length).toBeGreaterThan(0);
    expect(punches[0]!.employeeCode).toBe("FA");
    expect(punches[0]!.jobTitle).toBe("Manager");
    expect(punches[0]!.manager).toBe("AJ");
    expect(punches[0]!.store).toBe("Oakridge");
    const day = analyzeEmployeeDay("Altaf, Fahad", "2026-08-01", punches, entries);
    expect(day.lateMinutes).toBe(18);
    expect(day.schedule?.start).toMatch(/9:00 AM/i);
    expect(day.violations.some((v) => v.type === "no_schedule")).toBe(false);
  });

  it("highlights timecard-only employees as schedule missing", () => {
    const rows = parseTimecardCsv(timecard);
    const { entries } = parseScheduleCsv(schedule);
    const punches = rows.filter(
      (r) => r.date === "2026-08-01" && /flores,\s*jorge\s*a/i.test(r.employeeName)
    );
    expect(punches.length).toBeGreaterThan(0);
    const day = analyzeEmployeeDay("Flores, Jorge A", "2026-08-01", punches, entries);
    expect(day.schedule).toBeNull();
    expect(day.violations.some((v) => v.type === "no_schedule" && v.message === "Schedule missing")).toBe(
      true
    );
  });

  it("marks a scheduled employee with no clock-ins as a single absent issue", () => {
    const { entries } = parseScheduleCsv(schedule);
    const scheduled = entries.find((e) => e.date === "2026-08-01");
    expect(scheduled).toBeTruthy();
    const day = analyzeEmployeeDay(scheduled!.employeeName, "2026-08-01", [], entries);
    expect(day.segments).toHaveLength(1);
    expect(day.segments[0]!.timeIn).toBeNull();
    expect(day.segments[0]!.timeOut).toBeNull();
    expect(day.violations.filter((v) => v.type === "missing_punch")).toHaveLength(0);
    expect(day.violations.filter((v) => v.type === "absent")).toHaveLength(1);
    expect(day.violations).toHaveLength(1);
  });

  it("flags both missing Time In and Time Out on a punch row", () => {
    const punches: HrTimecardRow[] = [
      {
        employeeName: "Test, employee",
        date: "2026-08-01",
        timeIn: null,
        timeOut: null,
        gapFromPrevious: null,
        hoursLabel: null,
      },
    ];
    const day = analyzeEmployeeDay("Test, employee", "2026-08-01", punches, []);
    expect(day.violations.filter((v) => v.type === "missing_punch")).toHaveLength(2);
    expect(day.violations.some((v) => v.type === "no_schedule")).toBe(true);
    expect(day.violations.some((v) => v.type === "absent")).toBe(false);
  });

  it("includes scheduled sales associates and managers for August 1 even without punches", () => {
    const allRows = parseTimecardCsv(timecard);
    const { entries } = parseScheduleCsv(schedule);
    const employees = analyzeDay("2026-08-01", allRows, entries);
    expect(
      employees.some(
        (emp) =>
          namesMatch(emp.employeeName, "1, security guard") ||
          /syed\s+muqeet\s+asim/i.test(emp.displayName)
      )
    ).toBe(false);
    const scheduled = entries.filter((e) => e.date === "2026-08-01");
    for (const entry of scheduled) {
      const profile = allRows.filter((r) => namesMatch(r.employeeName, entry.employeeName));
      if (!keepHrAttendanceEmployee(entry.employeeName, profile)) continue;
      expect(employees.some((emp) => namesMatch(emp.employeeName, entry.employeeName))).toBe(
        true
      );
    }
  });
});
