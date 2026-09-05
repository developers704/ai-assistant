import { describe, expect, it } from "vitest";
import {
  buildWarningNoticeHtml,
  buildWarningNoticeText,
  draftWarningNotice,
  extractWarningCaseId,
  formatNoticeDate,
  matchesAttendanceCard,
  matchesViolationFilter,
  normalizeViolationFilters,
  warningCaseId,
  warningDescription,
  warningMailPlainText,
} from "@/lib/hr/warning-notice";
import { isEligibleForHrNotice } from "@/lib/hr/warning-notice";

const shazia = {
  employeeName: "Ahmed, Shazia",
  date: "2026-06-07",
  employeeCode: "SA2",
  jobTitle: "Corporate Manager",
  manager: "AJ",
  lateMinutes: 29,
};

describe("late warning notice", () => {
  it("sends a text warning without a PDF attachment copy", () => {
    const draft = draftWarningNotice(shazia);
    expect(draft.caseId).toBe("HR-LATE-SA2-2026-06-07");
    expect(draft.subject).toBe(
      "[HR-LATE-SA2-2026-06-07] Employee Warning Notice — Ahmed, Shazia"
    );
    expect(draft.from).toBe("umairj@valliani.app");
    expect(draft.to).toBe("umairjam.arrakconsulting@gmail.com");
    expect(draft.text).toContain("Hi, Ahmed, Shazia");
    expect(draft.text).toContain("arrived store late");
    expect(draft.text).toContain("June 7, 2026");
    expect(draft.text).toContain("pls confirm the reason");
    expect(draft.text).toContain("automated writeup");
    expect(draft.text).not.toContain("attached PDF");
    expect(draft.html).not.toContain("Type of Offenses");
    expect(draft.html).not.toContain("application/pdf");
    expect("pdfFilename" in draft).toBe(false);
    expect(extractWarningCaseId(`Re: ${draft.subject}`)).toBe("HR-LATE-SA2-2026-06-07");
    expect(
      extractWarningCaseId("[HR-WRITEUP-SA2-2026-06-07] Disciplinary Action Form — Ahmed, Shazia")
    ).toBe("HR-WRITEUP-SA2-2026-06-07");
    expect(
      extractWarningCaseId("[HR-EARLY-SA2-2026-06-07] Employee Warning Notice — Ahmed, Shazia")
    ).toBe("HR-EARLY-SA2-2026-06-07");
    expect(
      extractWarningCaseId("[HR-LEAVE-SA2-2026-06-07] Employee Warning Notice — Ahmed, Shazia")
    ).toBe("HR-LEAVE-SA2-2026-06-07");
    expect(
      extractWarningCaseId("[HR-MEAL-FM2-2026-06-07] Employee Warning Notice — Martinez, Filemon")
    ).toBe("HR-MEAL-FM2-2026-06-07");
    expect(warningCaseId(null, "2026-06-07", "Ahmed, Shazia")).toBe(
      "HR-LATE-AHMEDSHAZIA-2026-06-07"
    );
  });

  it("uses the security-guard proper name in the greeting", () => {
    const draft = draftWarningNotice({
      employeeName: "1, security guard",
      displayName: "Syed Muqeet Asim",
      date: "2026-08-04",
      employeeCode: "MS3",
      jobTitle: "Sales Associate",
      manager: "shaun",
      lateMinutes: 15,
    });
    expect(draft.text.startsWith("Hi, Syed Muqeet Asim")).toBe(true);
    expect(draft.subject).toContain("Syed Muqeet Asim");
    expect(draft.employeeName).toBe("1, security guard");
  });

  it("describes late minutes for write-ups and formats the notice date", () => {
    expect(warningDescription(29)).toBe("Late Arrival by 29 minutes.");
    expect(formatNoticeDate("2026-06-07")).toBe("06.07.2026");
    expect(buildWarningNoticeText(shazia)).toContain("arrived store late");
    expect(buildWarningNoticeHtml(shazia)).toContain("arrived store late");
    expect(buildWarningNoticeHtml(shazia)).not.toContain("Type of Offenses");
  });

  it("describes early arrival and leaving early — not meal breaks", () => {
    const early = draftWarningNotice({
      ...shazia,
      lateMinutes: null,
      earlyInMinutes: 18,
    });
    expect(early.caseId).toBe("HR-EARLY-SA2-2026-06-07");
    expect(early.description).toBe("Early Arrival by 18 minutes.");
    expect(early.text).toContain("arrived store early");

    const leftEarly = draftWarningNotice({
      ...shazia,
      lateMinutes: null,
      earlyOutMinutes: 22,
    });
    expect(leftEarly.caseId).toBe("HR-LEAVE-SA2-2026-06-07");
    expect(leftEarly.description).toBe("Left Early by 22 minutes.");
    expect(leftEarly.text).toContain("left store early");

    expect(
      isEligibleForHrNotice({
        employeeName: "Martinez, Filemon",
        date: "2026-06-07",
        employeeCode: "FM2",
        jobTitle: "Jewelry Technician",
        manager: "Fahad",
        lateMinutes: null,
        shiftTier: "ten",
        mealBreaks: [{ gapMinutes: 82, gapLabel: "1:22" }],
        totalMealMinutes: 82,
        violations: [
          {
            type: "long_meal",
            message: "Meal break 1:22 exceeds 75 min limit",
            severity: "error",
          },
        ],
      })
    ).toBe(false);
  });

  it("filters late, early, no-schedule, and absent from cards — not meal", () => {
    const mealEmp = {
      ...shazia,
      lateMinutes: null,
      violations: [
        { type: "long_meal" as const, message: "Meal break 1:22 exceeds 75 min limit", severity: "error" as const },
      ],
    };
    const earlyEmp = { ...shazia, lateMinutes: null, earlyInMinutes: 14 };
    expect(matchesViolationFilter(shazia, "all")).toBe(true);
    expect(matchesViolationFilter(shazia, [])).toBe(true);
    expect(matchesViolationFilter(shazia, "late")).toBe(true);
    expect(matchesViolationFilter(earlyEmp, "early")).toBe(true);
    expect(matchesViolationFilter(earlyEmp, "late")).toBe(false);
    expect(matchesAttendanceCard(mealEmp, "flagged")).toBe(true);
    expect(matchesAttendanceCard(shazia, "late")).toBe(true);
    expect(matchesAttendanceCard(earlyEmp, "early")).toBe(true);
    expect(normalizeViolationFilters(["all"], ["all", "late"])).toEqual(["late"]);
    expect(normalizeViolationFilters(["late"], ["late", "all"])).toEqual(["all"]);
    expect(normalizeViolationFilters(["late"], ["late", "early"])).toEqual(["late", "early"]);
    expect(normalizeViolationFilters(["late", "early"], [])).toEqual(["all"]);
    expect(
      matchesViolationFilter(
        { ...shazia, lateMinutes: null, violations: [{ type: "no_schedule", message: "Schedule missing", severity: "warning" }] },
        "no_schedule"
      )
    ).toBe(true);
    expect(matchesViolationFilter(shazia, "no_schedule")).toBe(false);
    expect(
      matchesViolationFilter(
        {
          ...shazia,
          lateMinutes: null,
          violations: [{ type: "absent", message: "Absent — scheduled, no punch", severity: "error" }],
        },
        "absent"
      )
    ).toBe(true);
    expect(matchesViolationFilter(shazia, "absent")).toBe(false);
    expect(
      warningMailPlainText("Umair", "2026-08-04", ["arrived store late"]).split("\n")
    ).toEqual([
      "Hi, Umair",
      "you arrived store late from your scheduled time on August 4, 2026 pls confirm the reason",
      "note:",
      "pls confirm reason otherwise you will get automated writeup.",
    ]);
  });
});
