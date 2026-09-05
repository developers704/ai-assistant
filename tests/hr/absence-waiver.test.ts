import { describe, expect, it } from "vitest";
import { attendancePasses } from "@/lib/hr/commission";
import { absenceWaiverAppliesTo, unwaivedAbsentDates } from "@/lib/hr/warning-store";
import { countedCommissionViolations } from "@/lib/hr/commission-attendance";
import type { HrWarningNotice } from "@/lib/hr/types";

describe("commission extra gates", () => {
  it("treats schedule warnings ≤ 3 the same as < 4", () => {
    expect(attendancePasses(0, 0)).toBe(true);
    expect(attendancePasses(0, 3)).toBe(true);
    expect(attendancePasses(0, 4)).toBe(false);
    expect(3 <= 3).toBe(3 < 4);
  });

  it("blocks extras on one unwaived absence even with zero warnings", () => {
    expect(attendancePasses(1, 0)).toBe(false);
    expect(attendancePasses(0, 0)).toBe(true);
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
    expect(attendancePasses(remaining.length, 0)).toBe(true);
  });
});

describe("commission Violations list", () => {
  it("lists only the counted absent and sent schedule warning", () => {
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
      warnings: [warning],
    });
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.label).sort()).toEqual(["Absent", "Left Early by 399 minutes"]);
    expect(issues.some((i) => /arrived early|left early 27/i.test(i.label))).toBe(false);
    expect(attendancePasses(1, 1)).toBe(false);
    expect(attendancePasses(0, 1)).toBe(true);
  });
});
