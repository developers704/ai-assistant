import { describe, expect, it } from "vitest";
import { writeUpCoverText, writeUpEmailText } from "@/lib/hr/write-up-notice";
import type { HrWarningNotice } from "@/lib/hr/types";

const notice: HrWarningNotice = {
  caseId: "HR-WRITEUP-MR3-2026-08-01",
  kind: "writeup",
  employeeName: "Al Ridwan, Md",
  employeeCode: "MR3",
  jobTitle: null,
  manager: null,
  date: "2026-08-01",
  lateMinutes: 0,
  description: "Left Early by 27 minutes.",
  from: "hr@valliani.app",
  to: "md@example.com",
  subject: "[HR-WRITEUP-MR3-2026-08-01] Disciplinary Action Form — Al Ridwan, Md",
  sentAt: "2026-09-23T05:57:00Z",
  messageId: null,
  remarks: [],
};

describe("write-up email body", () => {
  it("returns the stored email text when present", () => {
    expect(writeUpEmailText({ ...notice, text: "exact email" })).toBe("exact email");
  });

  it("rebuilds the sent email for older records", () => {
    const text = writeUpEmailText(notice);
    expect(text).toContain("Please see the attached PDF: Disciplinary-Action-Form-MR3-2026-08-01.pdf");
    expect(text).toContain("Al Ridwan, Md — Left Early by 27 minutes.");
    expect(text).toContain("Reply to this email if you have remarks.");
  });

  it("cover email carries every violation paragraph, not only the first", () => {
    const text = writeUpCoverText({
      employeeName: "Shazia Ahmed",
      description: "Was 29 minutes late.\n\nLeft 40 minutes early.",
      pdfFilename: "form.pdf",
    });
    expect(text).toContain("Was 29 minutes late.");
    expect(text).toContain("Left 40 minutes early.");
  });
});
