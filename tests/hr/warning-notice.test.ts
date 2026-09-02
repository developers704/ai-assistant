import { describe, expect, it } from "vitest";
import {
  buildWarningNoticeHtml,
  buildWarningNoticeText,
  draftWarningNotice,
  extractWarningCaseId,
  formatNoticeDate,
  warningCaseId,
  warningDescription,
} from "@/lib/hr/warning-notice";

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
    expect(extractWarningCaseId(`Re: ${draft.subject}`)).toBe("HR-LATE-SA2-2026-06-07");
    expect(warningCaseId(null, "2026-06-07", "Ahmed, Shazia")).toBe(
      "HR-LATE-AHMEDSHAZIA-2026-06-07"
    );
  });
});
