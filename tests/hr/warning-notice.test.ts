import { describe, expect, it } from "vitest";
import {
  buildWarningNoticeHtml,
  buildWarningNoticeText,
  draftWarningNotice,
  extractWarningCaseId,
  formatNoticeDate,
  matchesViolationFilter,
  warningCaseId,
  warningDescription,
  warningPdfFilename,
} from "@/lib/hr/warning-notice";
import { buildWarningNoticePdf } from "@/lib/hr/warning-notice-pdf";

const shazia = {
  employeeName: "Ahmed, Shazia",
  date: "2026-06-07",
  employeeCode: "SA2",
  jobTitle: "Corporate Manager",
  manager: "AJ",
  lateMinutes: 29,
};

describe("late warning notice", () => {
  it("puts Manager from the timecard where the sheet had #REF!", () => {
    const html = buildWarningNoticeHtml(shazia);
    const text = buildWarningNoticeText(shazia);
    expect(html).toContain("Manager");
    expect(html).toContain("AJ");
    expect(html).not.toContain("#REF!");
    expect(text).toContain("Manager :- AJ");
    expect(html).toContain("SA2");
    expect(html).toContain("Corporate Manager");
    expect(html).toContain("Ahmed, Shazia");
  });

  it("omits Plan for Improvement and Consequences of Further Infraction", () => {
    const html = buildWarningNoticeHtml(shazia);
    const text = buildWarningNoticeText(shazia);
    expect(html).not.toMatch(/Plan for Improvement/i);
    expect(html).not.toMatch(/Consequences of Further Infraction/i);
    expect(text).not.toMatch(/Plan for Improvement/i);
    expect(text).not.toMatch(/Consequences of Further Infraction/i);
  });

  it("describes the actual late minutes", () => {
    expect(warningDescription(29)).toBe("Late Arrival by 29 minutes.");
    expect(buildWarningNoticeHtml(shazia)).toContain("Late Arrival by 29 minutes.");
    expect(buildWarningNoticeHtml(shazia)).not.toContain("Late Leaving");
    expect(formatNoticeDate("2026-06-07")).toBe("06.07.2026");
  });

  it("checks company policy + schedule violation", () => {
    const html = buildWarningNoticeHtml(shazia);
    expect(html).toContain("Violation of Company Policies");
    expect(html).toContain("Other :- Schedule Violation");
    expect(html).toMatch(/☑ Violation of Company Policies/);
    expect(html).toMatch(/☑ Other :- Schedule Violation/);
  });

  it("builds a unique case id for reply matching", () => {
    const draft = draftWarningNotice(shazia);
    expect(draft.caseId).toBe("HR-LATE-SA2-2026-06-07");
    expect(draft.subject).toBe(
      "[HR-LATE-SA2-2026-06-07] Employee Warning Notice — Ahmed, Shazia"
    );
    expect(draft.from).toBe("umairj@valliani.app");
    expect(draft.to).toBe("umairjam.arrakconsulting@gmail.com");
    expect(draft.pdfFilename).toBe("Employee-Warning-Notice-SA2-2026-06-07.pdf");
    expect(draft.text).toContain("attached PDF");
    expect(draft.text).not.toContain("Type of Offenses");
    expect(draft.html).not.toContain("Type of Offenses");
    expect(extractWarningCaseId(`Re: ${draft.subject}`)).toBe("HR-LATE-SA2-2026-06-07");
    expect(
      extractWarningCaseId("[HR-WRITEUP-SA2-2026-06-07] Disciplinary Action Form — Ahmed, Shazia")
    ).toBe("HR-WRITEUP-SA2-2026-06-07");
    expect(
      extractWarningCaseId("[HR-EARLY-SA2-2026-06-07] Employee Warning Notice — Ahmed, Shazia")
    ).toBe("HR-EARLY-SA2-2026-06-07");
    expect(
      extractWarningCaseId("[HR-MEAL-FM2-2026-06-07] Employee Warning Notice — Martinez, Filemon")
    ).toBe("HR-MEAL-FM2-2026-06-07");
    expect(warningCaseId(null, "2026-06-07", "Ahmed, Shazia")).toBe(
      "HR-LATE-AHMEDSHAZIA-2026-06-07"
    );
    expect(warningPdfFilename("SA2", "2026-06-07", "Ahmed, Shazia")).toBe(
      "Employee-Warning-Notice-SA2-2026-06-07.pdf"
    );
  });

  it("builds a PDF form instead of dumping the notice in the email body", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await buildWarningNoticePdf(shazia);
    const header = Buffer.from(pdf.subarray(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(800);
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPageCount()).toBe(1);
    const page = loaded.getPage(0);
    const { width, height } = page.getSize();
    expect(width).toBe(612);
    expect(height).toBe(792);
  });

  it("describes early arrival and long meal breaks on the same warning format", () => {
    const early = draftWarningNotice({
      ...shazia,
      lateMinutes: null,
      earlyInMinutes: 18,
    });
    expect(early.caseId).toBe("HR-EARLY-SA2-2026-06-07");
    expect(early.description).toBe("Early Arrival by 18 minutes.");
    expect(early.text).toContain("Early Arrival by 18 minutes.");

    const meal = draftWarningNotice({
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
    });
    expect(meal.caseId).toBe("HR-MEAL-FM2-2026-06-07");
    expect(meal.description).toBe(
      "Took a long meal break of 82 minutes (exceeds 75 min limit)."
    );
    expect(meal.text).toContain("long meal break of 82 minutes");
  });

  it("filters late, early, and long meal break violations", () => {
    const mealEmp = {
      ...shazia,
      lateMinutes: null,
      violations: [
        { type: "long_meal" as const, message: "Meal break 1:22 exceeds 75 min limit", severity: "error" as const },
      ],
    };
    const earlyEmp = { ...shazia, lateMinutes: null, earlyInMinutes: 14 };
    expect(matchesViolationFilter(shazia, "all")).toBe(true);
    expect(matchesViolationFilter(shazia, "late")).toBe(true);
    expect(matchesViolationFilter(earlyEmp, "early")).toBe(true);
    expect(matchesViolationFilter(earlyEmp, "late")).toBe(false);
    expect(matchesViolationFilter(mealEmp, "meal")).toBe(true);
    expect(matchesViolationFilter(shazia, "meal")).toBe(false);
  });
});
