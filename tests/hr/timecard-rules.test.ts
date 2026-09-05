import { describe, expect, it } from "vitest";
import { classifyGapMinutes, checkMealViolations, shiftTierFromScheduledMinutes } from "@/lib/hr/meal-break-rules";
import { analyzeEmployeeDay } from "@/lib/hr/analyze";
import type { HrScheduleEntry, HrTimecardRow } from "@/lib/hr/types";

describe("HR gap classification", () => {
  it("treats 10-29 min as short rest", () => {
    expect(classifyGapMinutes(11)).toBe("short_break");
    expect(classifyGapMinutes(29)).toBe("short_break");
  });
  it("treats 30+ min as meal", () => {
    expect(classifyGapMinutes(30)).toBe("meal_break");
    expect(classifyGapMinutes(63)).toBe("meal_break");
  });
});

describe("security guard 1 sample day", () => {
  const punches: HrTimecardRow[] = [
    {
      employeeName: "1, security guard",
      date: "2026-08-04",
      timeIn: "09:25 AM",
      timeOut: "01:49 PM",
      gapFromPrevious: null,
      hoursLabel: "4:24",
    },
    {
      employeeName: "1, security guard",
      date: "2026-08-04",
      timeIn: "02:52 PM",
      timeOut: "08:12 PM",
      gapFromPrevious: "01:03",
      hoursLabel: "5:20",
    },
  ];

  const schedule: HrScheduleEntry[] = [
    {
      employeeName: "1, security guard",
      date: "2026-08-04",
      start: "09:15 AM",
      end: "07:15 PM",
    },
  ];

  it("sums work segments and counts meal gap", () => {
    const day = analyzeEmployeeDay("1, security guard", "2026-08-04", punches, schedule);
    expect(day.totalWorkMinutes).toBe(4 * 60 + 24 + 5 * 60 + 20);
    expect(day.mealBreaks).toHaveLength(1);
    expect(day.mealBreaks[0]!.gapMinutes).toBe(63);
    expect(day.shortBreaks).toHaveLength(0);
  });

  it("flags no long meal for 63 min break on 10h shift", () => {
    const day = analyzeEmployeeDay("1, security guard", "2026-08-04", punches, schedule);
    expect(day.violations.some((v) => v.type === "long_meal")).toBe(false);
    expect(day.displayName).toBe("Syed Muqeet Asim");
  });

  it("does not treat a long meal as a flag or warning case", () => {
    const longMeal: HrTimecardRow[] = [
      {
        employeeName: "1, security guard",
        date: "2026-08-04",
        timeIn: "09:25 AM",
        timeOut: "01:00 PM",
        gapFromPrevious: null,
        hoursLabel: "3:35",
      },
      {
        employeeName: "1, security guard",
        date: "2026-08-04",
        timeIn: "02:30 PM",
        timeOut: "08:12 PM",
        gapFromPrevious: "01:30",
        hoursLabel: "5:42",
      },
    ];
    const day = analyzeEmployeeDay("1, security guard", "2026-08-04", longMeal, schedule);
    expect(day.mealBreaks[0]?.gapMinutes).toBe(90);
    expect(day.totalMealMinutes).toBe(90);
    expect(day.violations.some((v) => v.type === "long_meal" || v.type === "excessive_meal_total")).toBe(
      false
    );
  });
});

describe("shift tiers", () => {
  it("11h schedule is eleven tier", () => {
    expect(shiftTierFromScheduledMinutes(11 * 60)).toBe("eleven");
  });
  it("12h schedule is twelve tier with 120 expected meal", () => {
    const v = checkMealViolations("twelve", [60, 60]);
    expect(v.some((x) => x.type === "excessive_meal_total")).toBe(false);
    const bad = checkMealViolations("twelve", [80, 60]);
    expect(bad.some((x) => x.type === "long_meal")).toBe(true);
  });
});
