import type { HrWarningNotice } from "./types";
import {
  HR_WARNING_FROM,
  HR_WARNING_TO,
  isEligibleForHrNotice,
  noticeDescriptionForEmployee,
  noticeEmployeeSlug,
  type HrNoticeEmployee,
} from "./warning-notice";
import { formatHrMailTo, type HrMailRouting } from "./mail-routing";

export type WriteUpDraft = {
  caseId: string;
  kind: "writeup";
  employeeName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  manager: string | null;
  store: string | null;
  date: string;
  lateMinutes: number;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  description: string;
  pdfFilename: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function suggestedWriteUpDescription(emp: HrNoticeEmployee): string {
  return noticeDescriptionForEmployee(emp);
}

export function writeUpCaseId(code: string | null, date: string, name: string): string {
  return `HR-WRITEUP-${noticeEmployeeSlug(code, name)}-${date}`;
}

export function writeUpSubject(caseId: string, employeeName: string): string {
  return `[${caseId}] Disciplinary Action Form — ${employeeName}`;
}

export function writeUpPdfFilename(code: string | null, date: string, name: string): string {
  return `Disciplinary-Action-Form-${noticeEmployeeSlug(code, name)}-${date}.pdf`;
}

export function requireWriteUpDescription(description: string): string {
  const trimmed = description.replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    throw new Error("Write a description before sending the write-up");
  }
  return trimmed;
}

export function writeUpCoverText(input: {
  employeeName: string;
  description: string;
  pdfFilename: string;
}): string {
  const preview = input.description.split("\n").find((line) => line.trim()) ?? input.description;
  return [
    `Please see the attached PDF: ${input.pdfFilename}`,
    "",
    `${input.employeeName} — ${preview}`,
    "",
    "Reply to this email if you have remarks.",
  ].join("\n");
}

export function writeUpCoverHtml(input: {
  employeeName: string;
  description: string;
  pdfFilename: string;
}): string {
  const preview = input.description.split("\n").find((line) => line.trim()) ?? input.description;
  return `<p>Please see the attached Disciplinary Action Form (PDF): <strong>${escapeHtml(input.pdfFilename)}</strong></p>
<p>${escapeHtml(input.employeeName)} — ${escapeHtml(preview)}</p>
<p>Reply to this email if you have remarks.</p>`;
}

export function draftWriteUpNotice(
  emp: HrNoticeEmployee,
  description: string,
  routing?: HrMailRouting | null
): WriteUpDraft {
  if (!isEligibleForHrNotice(emp)) {
    throw new Error("No attendance violation for a write-up");
  }
  const lateMinutes = emp.lateMinutes ?? 0;
  const text = requireWriteUpDescription(description);
  const caseId = writeUpCaseId(emp.employeeCode, emp.date, emp.employeeName);
  const pdfFilename = writeUpPdfFilename(emp.employeeCode, emp.date, emp.employeeName);
  return {
    caseId,
    kind: "writeup",
    employeeName: emp.employeeName,
    employeeCode: emp.employeeCode,
    jobTitle: emp.jobTitle,
    manager: emp.manager,
    store: emp.store ?? null,
    date: emp.date,
    lateMinutes,
    from: routing?.from?.trim() || HR_WARNING_FROM,
    to: routing?.to?.length ? formatHrMailTo(routing.to) : HR_WARNING_TO,
    subject: writeUpSubject(caseId, emp.employeeName),
    html: writeUpCoverHtml({
      employeeName: emp.employeeName,
      description: text,
      pdfFilename,
    }),
    text: writeUpCoverText({
      employeeName: emp.employeeName,
      description: text,
      pdfFilename,
    }),
    description: text,
    pdfFilename,
  };
}

export function writeUpFromDraft(
  draft: WriteUpDraft,
  extras?: { sentAt?: string; messageId?: string | null }
): HrWarningNotice {
  return {
    caseId: draft.caseId,
    kind: "writeup",
    employeeName: draft.employeeName,
    employeeCode: draft.employeeCode,
    jobTitle: draft.jobTitle,
    manager: draft.manager,
    store: draft.store,
    date: draft.date,
    lateMinutes: draft.lateMinutes,
    description: draft.description,
    from: draft.from,
    to: draft.to,
    subject: draft.subject,
    sentAt: extras?.sentAt ?? new Date().toISOString(),
    messageId: extras?.messageId ?? null,
    remarks: [],
  };
}
