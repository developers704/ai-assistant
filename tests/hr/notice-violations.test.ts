import { describe, expect, it } from "vitest";
import {
  noticeViolationKeys,
  restrictNoticeToViolations,
  type HrNoticeEmployee,
} from "@/lib/hr/warning-notice";
import { writeUpDescriptionForEmployee } from "@/lib/hr/write-up-notice";
import { buildMyAttendance } from "@/lib/hr/my-schedule";
import type { HrEmployeeDay } from "@/lib/hr/types";

const templates = {
  lateIn: "{{employeeName}} was {{lateMinutes}} minutes late on {{date}}.",
  lateOut: "late out",
  earlyIn: "early in",
  earlyOut: "{{employeeName}} left {{earlyOutMinutes}} minutes early on {{date}}.",
  absent: "absent",
  missingSchedule: "missing schedule",
};

const lateAndEarly: HrNoticeEmployee = {
  employeeName: "Ahmed, Shazia",
  date: "2026-08-07",
  employeeCode: "SA2",
  jobTitle: null,
  manager: null,
  lateMinutes: 29,
  earlyOutMinutes: 40,
  violations: [
    { type: "late", message: "late", severity: "warning" },
    { type: "early_out", message: "early", severity: "warning" },
  ],
};

describe("notice violations", () => {
  it("lists every violation on a day", () => {
    expect(noticeViolationKeys(lateAndEarly)).toEqual(["lateIn", "earlyOut"]);
  });

  it("write-up covers both violations by default, one paragraph each", () => {
    expect(writeUpDescriptionForEmployee(lateAndEarly, templates)).toBe(
      "Shazia Ahmed was 29 minutes late on August 7, 2026.\n\n" +
        "Shazia Ahmed left 40 minutes early on August 7, 2026."
    );
  });

  it("HR can pick just one violation", () => {
    const early = restrictNoticeToViolations(lateAndEarly, ["earlyOut"]);
    expect(noticeViolationKeys(early)).toEqual(["earlyOut"]);
    expect(writeUpDescriptionForEmployee(early, templates)).toBe(
      "Shazia Ahmed left 40 minutes early on August 7, 2026."
    );
  });

  it("a choice that did not happen that day is ignored", () => {
    const same = restrictNoticeToViolations(lateAndEarly, ["absent", "nonsense"]);
    expect(noticeViolationKeys(same)).toEqual(["lateIn", "earlyOut"]);
  });

  it("meal-only days never claim a missing schedule", () => {
    const meal: HrNoticeEmployee = {
      ...lateAndEarly,
      lateMinutes: null,
      earlyOutMinutes: null,
      violations: [{ type: "long_meal", message: "Meal break 75 min", severity: "warning" }],
    };
    expect(noticeViolationKeys(meal)).toEqual([]);
    expect(writeUpDescriptionForEmployee(meal, templates)).not.toMatch(/missing schedule/i);
  });
});

describe("employee attendance record", () => {
  const day = (over: Partial<HrEmployeeDay>): HrEmployeeDay =>
    ({
      employeeName: "Ahmed, Shazia",
      displayName: "Shazia Ahmed",
      employeeCode: "SA2",
      jobTitle: null,
      store: null,
      manager: null,
      guardsName: null,
      schedule: { start: "10:00", end: "18:00", scheduledMinutes: 480, scheduledLabel: "8:00" },
      shiftTier: null,
      segments: [
        { timeIn: "10:02", timeOut: "18:00", gapFromPrevious: null, gapMinutes: null, gapKind: "none", workMinutes: 478, workLabel: "7:58", violations: [] },
      ],
      mealBreaks: [],
      shortBreaks: [],
      totalWorkMinutes: 478,
      totalWorkLabel: "7:58",
      totalMealMinutes: 0,
      totalMealLabel: "0:00",
      expectedMealMinutes: 0,
      expectedMealCount: 0,
      lateMinutes: null,
      earlyInMinutes: null,
      earlyOutMinutes: null,
      lateOutMinutes: null,
      violations: [],
      ...over,
    }) as HrEmployeeDay;

  it("counts days, violations and notices (waived ones excluded)", () => {
    const { days, totals } = buildMyAttendance(
      [
        day({ date: "2026-08-02" }),
        day({
          date: "2026-08-01",
          lateMinutes: 29,
          earlyOutMinutes: 40,
          violations: lateAndEarly.violations!,
        }),
        day({
          date: "2026-08-03",
          segments: [],
          violations: [{ type: "absent", message: "absent", severity: "error" }],
        }),
        day({
          date: "2026-08-04",
          segments: [],
          violations: [{ type: "absent", message: "absent", severity: "error" }],
        }),
      ],
      [
        { date: "2026-08-01", employeeName: "Ahmed, Shazia", kind: "writeup", caseId: "HR-WRITEUP-SA2-2026-08-01", waivedAt: null },
        { date: "2026-08-03", employeeName: "Ahmed, Shazia", kind: "warning", caseId: "HR-ABSENT-SA2-2026-08-03", waivedAt: "2026-08-05" },
      ],
      (d) => d.date === "2026-08-04"
    );
    expect(days.map((d) => d.date)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"]);
    expect(days[0]).toMatchObject({ clockIn: "10:02", violations: ["lateIn", "earlyOut"], writeUpSent: true });
    expect(days[3]).toMatchObject({ violations: [], absenceWaived: true });
    expect(totals).toEqual({
      scheduledDays: 4,
      presentDays: 3,
      absentDays: 1,
      lateDays: 1,
      earlyOutDays: 1,
      warnings: 0,
      writeUps: 1,
    });
  });
});
