import { describe, expect, it } from "vitest";
import { attendancePasses } from "@/lib/hr/commission";
import { absenceWaiverAppliesTo, normalizeWaiverComment, unwaivedAbsentDates } from "@/lib/hr/warning-store";
import { absenceWriteUpCount, countedCommissionViolations, presentDaysWithWaivedAbsences } from "@/lib/hr/commission-attendance";
import type { HrWarningNotice } from "@/lib/hr/types";

describe("commission extra gates", () => {
  it("dissolves bonuses on four write-ups", () => {
    expect(attendancePasses(0, 0)).toBe(true);
    expect(attendancePasses(3, 0)).toBe(true);
    expect(attendancePasses(4, 0)).toBe(false);
    expect(3 <= 3).toBe(3 < 4);
  });

  it("dissolves bonuses on one absence write-up", () => {
    expect(attendancePasses(1, 1)).toBe(false);
    expect(attendancePasses(0, 0)).toBe(true);
  });

  it("recognizes an absence write-up by its attendance date", () => {
    expect(
      absenceWriteUpCount(
        [{ date: "2026-08-04" }, { date: "2026-08-05" }],
        ["2026-08-04"]
      )
    ).toBe(1);
  });
});

describe("absence waivers", () => {
  it("matches by employee code or payroll name", () => {
    const waiver = {
      employeeName: "Alvarez, Lynette L",
      employeeCode: "LY",
      date: "2026-08-04",
    };
    expect(
      absenceWaiverAppliesTo(waiver, {
        employeeName: "Alvarez, Lynette L",
        employeeCode: "LY",
        date: "2026-08-04",
      })
    ).toBe(true);
    expect(
      absenceWaiverAppliesTo(waiver, {
        employeeName: "Lynette Alvarez",
        employeeCode: "LY",
        date: "2026-08-04",
      })
    ).toBe(true);
    expect(
      absenceWaiverAppliesTo(waiver, {
        employeeName: "Ahmed, Shazia",
        employeeCode: "SA2",
        date: "2026-08-04",
      })
    ).toBe(false);
  });

  it("drops waived dates from the absence count", () => {
    const remaining = unwaivedAbsentDates(
      ["2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25"],
      [
        {
          employeeName: "Alvarez, Lynette L",
          employeeCode: "LY",
          date: "2026-08-04",
          waivedAt: "2026-09-05T00:00:00.000Z",
        },
        {
          employeeName: "Alvarez, Lynette L",
          employeeCode: "LY",
          date: "2026-08-11",
          waivedAt: "2026-09-05T00:00:00.000Z",
        },
        {
          employeeName: "Alvarez, Lynette L",
          employeeCode: "LY",
          date: "2026-08-18",
          waivedAt: "2026-09-05T00:00:00.000Z",
        },
        {
          employeeName: "Alvarez, Lynette L",
          employeeCode: "LY",
          date: "2026-08-25",
          waivedAt: "2026-09-05T00:00:00.000Z",
        },
      ],
      { employeeName: "Alvarez, Lynette L", employeeCode: "LY" }
    );
    expect(remaining).toEqual([]);
    expect(attendancePasses(0, 0)).toBe(true);
  });

  it("counts waived scheduled days as present so 0 absent reads as 21/21", () => {
    const rawAbsent = ["2026-08-27"];
    const remaining = unwaivedAbsentDates(
      rawAbsent,
      [
        {
          employeeName: "8, security guard",
          employeeCode: "SA4",
          date: "2026-08-27",
          waivedAt: "2026-09-05T00:00:00.000Z",
        },
      ],
      { employeeName: "8, security guard", employeeCode: "SA4" }
    );
    expect(remaining).toEqual([]);
    expect(presentDaysWithWaivedAbsences(20, rawAbsent, remaining)).toBe(21);
    expect(presentDaysWithWaivedAbsences(20, rawAbsent, rawAbsent)).toBe(20);
  });

  it("requires a trimmed waive note", () => {
    expect(normalizeWaiverComment("  doctor visit  ")).toBe("doctor visit");
    expect(normalizeWaiverComment("   ")).toBe("");
    expect(normalizeWaiverComment(null)).toBe("");
  });

  it("counts an absence again when the waiver is gone", () => {
    const remaining = unwaivedAbsentDates(
      ["2026-08-06"],
      [],
      { employeeName: "Evangelista, Karla M", employeeCode: "KB" }
    );
    expect(remaining).toEqual(["2026-08-06"]);
    expect(attendancePasses(0, 0)).toBe(true);
  });
});

describe("commission Violations list", () => {
  it("lists only the counted absent and sent write-up", () => {
    const warning: HrWarningNotice = {
      caseId: "HR-LEAVE-SA4-2026-08-13",
      employeeName: "Sultan Ansari",
      employeeCode: "SA4",
      jobTitle: null,
      manager: null,
      date: "2026-08-13",
      lateMinutes: 399,
      description: "Left Early by 399 minutes.",
      from: "",
      to: "",
      subject: "warning",
      sentAt: "2026-09-05T00:00:00.000Z",
      messageId: null,
      remarks: [],
    };
    const issues = countedCommissionViolations({
      unwaivedAbsentDates: ["2026-08-02"],
      writeUps: [warning],
    });
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.label).sort()).toEqual(["Absent", "Left Early by 399 minutes"]);
    expect(issues.some((i) => /arrived early|left early 27/i.test(i.label))).toBe(false);
    expect(attendancePasses(1, 1)).toBe(false);
    expect(attendancePasses(1, 0)).toBe(true);
  });
});
