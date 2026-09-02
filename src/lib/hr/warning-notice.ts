import type { HrEmployeeDay, HrWarningNotice } from "./types";

export const HR_WARNING_FROM = "umairj@valliani.app";
export const HR_WARNING_TO = "umairjam.arrakconsulting@gmail.com";
export const LATE_WARNING_THRESHOLD_MINUTES = 12;
export const HR_WARNING_CASE_RE = /HR-LATE-[A-Z0-9]+-\d{4}-\d{2}-\d{2}/i;
/** Warning (`HR-LATE-…`) or write-up (`HR-WRITEUP-…`) case token in a subject. */
export const HR_NOTICE_CASE_RE = /HR-(?:LATE|WRITEUP)-[A-Z0-9]+-\d{4}-\d{2}-\d{2}/i;

export type WarningNoticeDraft = {
  caseId: string;
  employeeName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  manager: string | null;
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

export function noticeEmployeeSlug(code: string | null, name: string): string {
  const fromCode = (code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (fromCode) return fromCode;
  const fromName = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  return fromName || "EMP";
}

export function warningCaseId(code: string | null, date: string, name: string): string {
  return `HR-LATE-${noticeEmployeeSlug(code, name)}-${date}`;
}

export function warningSubject(caseId: string, employeeName: string): string {
  return `[${caseId}] Employee Warning Notice — ${employeeName}`;
}

/** Template date style: 06.07.2026 */
export function formatNoticeDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[2]}.${m[3]}.${m[1]}`;
}

export function warningDescription(lateMinutes: number): string {
  const unit = lateMinutes === 1 ? "minute" : "minutes";
  return `Late Arrival by ${lateMinutes} ${unit}.`;
}

export function isLateForWarning(lateMinutes: number | null | undefined): boolean {
  return lateMinutes != null && lateMinutes >= LATE_WARNING_THRESHOLD_MINUTES;
}

export function extractWarningCaseId(subject: string | null | undefined): string | null {
  const m = String(subject ?? "").match(HR_NOTICE_CASE_RE);
  return m ? m[0]!.toUpperCase() : null;
}

function fieldRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 8px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;white-space:nowrap;vertical-align:top;">
      <strong>${escapeHtml(label)} :-</strong>
    </td>
    <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;vertical-align:top;">
      ${escapeHtml(value || "—")}
    </td>
  </tr>`;
}

function offenseLine(checked: boolean, label: string): string {
  const box = checked ? "☑" : "☐";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;padding:3px 0;">${box} ${escapeHtml(label)}</div>`;
}

function sectionBar(title: string): string {
  return `<tr>
    <td colspan="2" style="background:#000;color:#fff;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.4px;padding:8px 12px;">
      ${escapeHtml(title)}
    </td>
  </tr>`;
}

export function buildWarningNoticeHtml(input: {
  employeeName: string;
  date: string;
  employeeCode: string | null;
  jobTitle: string | null;
  manager: string | null;
  lateMinutes: number;
}): string {
  const description = warningDescription(input.lateMinutes);
  const logo = `<div style="width:56px;height:56px;border-radius:50%;background:#111;margin:0 auto 10px;line-height:56px;text-align:center;">
    <span style="display:inline-block;width:22px;height:22px;border:3px solid #c9a227;border-radius:50%;vertical-align:middle;box-shadow:0 0 0 2px #111, inset 0 0 0 3px #111;"></span>
  </div>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#ffffff;color:#111111;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:640px;border-collapse:collapse;background:#ffffff;">
    <tr>
      <td colspan="2" style="text-align:center;padding:8px 0 16px;">
        ${logo}
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:2px;font-weight:700;color:#111;">VALLIANI JEWELERS</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;margin-top:10px;color:#111;">Employee Warning Notice</div>
      </td>
    </tr>
    ${sectionBar("Employee Information")}
    <tr>
      <td colspan="2" style="padding:12px 8px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td width="50%" style="vertical-align:top;padding-right:12px;">
              <table role="presentation" cellpadding="0" cellspacing="0">${fieldRow("Employee Name", input.employeeName)}${fieldRow("Employee Code", input.employeeCode ?? "")}${fieldRow("Manager", input.manager ?? "")}</table>
            </td>
            <td width="50%" style="vertical-align:top;padding-left:12px;">
              <table role="presentation" cellpadding="0" cellspacing="0">${fieldRow("Date", formatNoticeDate(input.date))}${fieldRow("Job Title", input.jobTitle ?? "")}</table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${sectionBar("Type of Offenses")}
    <tr>
      <td colspan="2" style="padding:12px 8px 18px;">
        ${offenseLine(false, "Tardiness/Leaving Early")}
        ${offenseLine(false, "Absenteeism")}
        ${offenseLine(true, "Violation of Company Policies")}
        ${offenseLine(false, "Substandard Work")}
        ${offenseLine(false, "Violation of Safety Rules")}
        ${offenseLine(false, "Rudeness to Customers / Co workers")}
        ${offenseLine(true, "Other :- Schedule Violation")}
      </td>
    </tr>
    ${sectionBar("Details")}
    <tr>
      <td colspan="2" style="padding:14px 8px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;">
        <div style="font-weight:700;text-decoration:underline;margin-bottom:8px;">Description of infraction :-</div>
        <div>${escapeHtml(description)}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildWarningNoticeText(input: {
  employeeName: string;
  date: string;
  employeeCode: string | null;
  jobTitle: string | null;
  manager: string | null;
  lateMinutes: number;
}): string {
  const description = warningDescription(input.lateMinutes);
  return [
    "VALLIANI JEWELERS",
    "Employee Warning Notice",
    "",
    "Employee Information",
    `Employee Name :- ${input.employeeName}`,
    `Date :- ${formatNoticeDate(input.date)}`,
    `Employee Code :- ${input.employeeCode ?? ""}`,
    `Job Title :- ${input.jobTitle ?? ""}`,
    `Manager :- ${input.manager ?? ""}`,
    "",
    "Type of Offenses",
    "[ ] Tardiness/Leaving Early",
    "[ ] Absenteeism",
    "[x] Violation of Company Policies",
    "[ ] Substandard Work",
    "[ ] Violation of Safety Rules",
    "[ ] Rudeness to Customers / Co workers",
    "[x] Other :- Schedule Violation",
    "",
    "Details",
    `Description of infraction :- ${description}`,
  ].join("\n");
}

export function warningPdfFilename(code: string | null, date: string, name: string): string {
  return `Employee-Warning-Notice-${noticeEmployeeSlug(code, name)}-${date}.pdf`;
}

export function warningCoverText(input: {
  employeeName: string;
  lateMinutes: number;
  pdfFilename: string;
}): string {
  return [
    `Please see the attached PDF: ${input.pdfFilename}`,
    "",
    `${input.employeeName} — ${warningDescription(input.lateMinutes)}`,
    "",
    "Reply to this email if you have remarks.",
  ].join("\n");
}

export function warningCoverHtml(input: {
  employeeName: string;
  lateMinutes: number;
  pdfFilename: string;
}): string {
  return `<p>Please see the attached Employee Warning Notice (PDF): <strong>${escapeHtml(input.pdfFilename)}</strong></p>
<p>${escapeHtml(input.employeeName)} — ${escapeHtml(warningDescription(input.lateMinutes))}</p>
<p>Reply to this email if you have remarks.</p>`;
}

export function draftWarningNotice(emp: Pick<
  HrEmployeeDay,
  "employeeName" | "date" | "employeeCode" | "jobTitle" | "manager" | "lateMinutes"
>): WarningNoticeDraft {
  if (!isLateForWarning(emp.lateMinutes)) {
    throw new Error("Employee is not late enough for a warning notice");
  }
  const lateMinutes = emp.lateMinutes!;
  const caseId = warningCaseId(emp.employeeCode, emp.date, emp.employeeName);
  const payload = {
    employeeName: emp.employeeName,
    date: emp.date,
    employeeCode: emp.employeeCode,
    jobTitle: emp.jobTitle,
    manager: emp.manager,
    lateMinutes,
  };
  return {
    caseId,
    ...payload,
    from: HR_WARNING_FROM,
    to: HR_WARNING_TO,
    subject: warningSubject(caseId, emp.employeeName),
    html: warningCoverHtml({
      employeeName: emp.employeeName,
      lateMinutes,
      pdfFilename: warningPdfFilename(emp.employeeCode, emp.date, emp.employeeName),
    }),
    text: warningCoverText({
      employeeName: emp.employeeName,
      lateMinutes,
      pdfFilename: warningPdfFilename(emp.employeeCode, emp.date, emp.employeeName),
    }),
    description: warningDescription(lateMinutes),
    pdfFilename: warningPdfFilename(emp.employeeCode, emp.date, emp.employeeName),
  };
}

export function noticeFromDraft(
  draft: WarningNoticeDraft,
  extras?: { sentAt?: string; messageId?: string | null }
): HrWarningNotice {
  return {
    caseId: draft.caseId,
    kind: "warning",
    employeeName: draft.employeeName,
    employeeCode: draft.employeeCode,
    jobTitle: draft.jobTitle,
    manager: draft.manager,
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
