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
  it("labels July 1 2026 as Wednesday", () => {
    expect(formatHrDateLabel("2026-07-01")).toBe("Wed · Jul 1");
    expect(formatHrDateLabel("2026-07-06")).toBe("Mon · Jul 6");
    expect(formatHrDateLabel("2026-07-31")).toBe("Fri · Jul 31");
  });

  it("locks the attendance window to July 1–31 2026", () => {
    expect(HR_ATTENDANCE_FROM).toBe("2026-07-01");
    expect(HR_ATTENDANCE_TO).toBe("2026-07-31");
    expect(HR_ATTENDANCE_DATES).toHaveLength(31);
    expect(HR_ATTENDANCE_DATES[0]).toBe("2026-07-01");
    expect(HR_ATTENDANCE_DATES.at(-1)).toBe("2026-07-31");
    expect(formatHrAttendanceWindowCaption()).toBe("July 1 – 31, 2026");
    expect(MISSING_PUNCH_LABEL).toBe("missing.");
  });

  it("defaults to the last date with punches, not empty July 31", () => {
    expect(lastHrAttendanceDateWithData(["2026-07-30"], ["2026-07-07"])).toBe("2026-07-30");
    expect(lastHrAttendanceDateWithData(["2026-07-30"], ["2026-07-31"])).toBe("2026-07-30");
    expect(lastHrAttendanceDateWithData([], ["2026-07-07"])).toBe("2026-07-07");
  });
});

describe("July 2026 seed files", () => {
  const timecardPath = path.join(process.cwd(), "data/hr/Timecard-July-2026.csv");
  const schedulePath = path.join(process.cwd(), "data/hr/Schedule-July-2026.csv");
  const timecard = fs.readFileSync(timecardPath, "utf8");
  const schedule = fs.readFileSync(schedulePath, "utf8");

  it("parses remapped July punch dates (no leftover June)", () => {
    const rows = parseTimecardCsv(timecard);
    expect(rows.length).toBeGreaterThan(1000);
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    expect(dates[0]).toBe("2026-07-01");
    expect(dates.at(-1)).toBe("2026-07-30");
    expect(dates.every((d) => d.startsWith("2026-07-"))).toBe(true);
    expect(rows.some((r) => r.date.startsWith("2026-06-"))).toBe(false);
  });

  it("parses the ADP week as Wed 07/01 through Tue 07/07 2026", () => {
    const { entries, dateFrom, dateTo } = parseScheduleCsv(schedule);
    expect(dateFrom).toBe("2026-07-01");
    expect(dateTo).toBe("2026-07-07");
    expect(entries.length).toBeGreaterThan(50);
    expect(entries.every((e) => e.date >= "2026-07-01" && e.date <= "2026-07-07")).toBe(true);
  });

  it("repeats week-1 shifts onto weeks 2–4 and leftover July dates", () => {
    const { entries } = parseScheduleCsv(schedule);
    const expanded = expandWeeklyScheduleToWindow(entries);
    const dates = [...new Set(expanded.map((e) => e.date))].sort();
    expect(dates[0]).toBe("2026-07-01");
    expect(dates.at(-1)).toBe("2026-07-31");
    const wednesdays = ["2026-07-01", "2026-07-08", "2026-07-15", "2026-07-22", "2026-07-29"];
    const week1 = entries.find(
      (e) => e.date === "2026-07-01" && /1, security guard/i.test(e.employeeName)
    );
    expect(week1).toBeTruthy();
    for (const d of wednesdays) {
      const hit = expanded.find(
        (e) => e.date === d && /1, security guard/i.test(e.employeeName)
      );
      expect(hit?.start).toBe(week1!.start);
      expect(hit?.end).toBe(week1!.end);
    }
    const thuWeek1 = entries.find(
      (e) => e.date === "2026-07-02" && /1, security guard/i.test(e.employeeName)
    );
    expect(thuWeek1).toBeFalsy();
    expect(
      expanded.some(
        (e) => e.date === "2026-07-09" && /1, security guard/i.test(e.employeeName)
      )
    ).toBe(false);
  });

  it("matches security guard 1 on July 1 worked hours vs 24h punches", () => {
    const rows = parseTimecardCsv(timecard);
    const { entries } = parseScheduleCsv(schedule);
    const punches = rows.filter(
      (r) => r.date === "2026-07-01" && /1, security guard/i.test(r.employeeName)
    );
    const day = analyzeEmployeeDay("1, security guard", "2026-07-01", punches, entries);
    expect(day.schedule?.start).toMatch(/09:20 AM/);
    expect(day.totalWorkLabel).toBe("10:37");
    expect(day.lateMinutes).toBeNull();
    expect(day.segments[0]!.timeIn).toBe("9:28");
    expect(day.segments[0]!.timeOut).toBe("14:24");
  });

  it("shows missing punches for a scheduled employee with no clock-ins", () => {
    const { entries } = parseScheduleCsv(schedule);
    const scheduled = entries.find((e) => e.date === "2026-07-01");
    expect(scheduled).toBeTruthy();
    const day = analyzeEmployeeDay(scheduled!.employeeName, "2026-07-01", [], entries);
    expect(day.segments).toHaveLength(1);
    expect(day.segments[0]!.timeIn).toBeNull();
    expect(day.segments[0]!.timeOut).toBeNull();
    expect(day.violations.filter((v) => v.type === "missing_punch")).toHaveLength(2);
  });

  it("flags both missing Time In and Time Out on a punch row", () => {
    const punches: HrTimecardRow[] = [
      {
        employeeName: "Test, employee",
        date: "2026-07-01",
        timeIn: null,
        timeOut: null,
        gapFromPrevious: null,
        hoursLabel: null,
      },
    ];
    const day = analyzeEmployeeDay("Test, employee", "2026-07-01", punches, []);
    expect(day.violations.filter((v) => v.type === "missing_punch")).toHaveLength(2);
  });

  it("includes every scheduled name for July 1 even without punches", () => {
    const rows = parseTimecardCsv(timecard).filter((r) => r.date === "2026-07-01");
    const { entries } = parseScheduleCsv(schedule);
    const employees = analyzeDay("2026-07-01", rows, entries);
    const scheduled = entries.filter((e) => e.date === "2026-07-01");
    for (const entry of scheduled) {
      expect(employees.some((emp) => namesMatch(emp.employeeName, entry.employeeName))).toBe(
        true
      );
    }
  });
});
