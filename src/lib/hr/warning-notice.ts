import type { HrEmployeeDay, HrWarningNotice, HrViolation } from "./types";
import {
  DEFAULT_HR_MAIL_FROM,
  DEFAULT_HR_MAIL_TO,
  formatHrMailTo,
  parseHrMailAddresses,
  type HrMailRouting,
} from "./mail-routing";
import { resolveHrEmployeeDisplayName } from "./security-guard-names";
import { parseClockToMinutes } from "./time-utils";
import type { HrWarningTemplateKey, HrWarningTemplates } from "./notice-settings-shared";

export const HR_WARNING_FROM = DEFAULT_HR_MAIL_FROM;
export const HR_WARNING_TO = DEFAULT_HR_MAIL_TO[0]!;
export const LATE_WARNING_THRESHOLD_MINUTES = 12;
export const EARLY_WARNING_THRESHOLD_MINUTES = 10;
export const HR_WARNING_CASE_RE = /HR-(?:LATE|EARLY|LEAVE|ABSENT|MEAL)-[A-Z0-9]+-\d{4}-\d{2}-\d{2}/i;
/** Warning (`HR-LATE-` / `HR-EARLY-` / `HR-LEAVE-` / `HR-ABSENT-` / legacy `HR-MEAL-`) or write-up (`HR-WRITEUP-`). */
export const HR_NOTICE_CASE_RE = /HR-(?:LATE|EARLY|LEAVE|ABSENT|MEAL|WRITEUP)-[A-Z0-9]+-\d{4}-\d{2}-\d{2}/i;

export type HrWarningReason = "late" | "early" | "leave" | "absent";
export type HrAttendanceCardFilter = "all" | "flagged" | "late" | "early" | "no_schedule" | "absent";
export type HrViolationKind = "late" | "early" | "no_schedule" | "absent";
export type HrViolationFilter = "all" | HrViolationKind;

export const HR_VIOLATION_FILTER_OPTIONS: HrViolationFilter[] = [
  "all",
  "late",
  "early",
  "no_schedule",
  "absent",
];

export const HR_VIOLATION_FILTER_LABELS: Record<HrViolationFilter, string> = {
  all: "All",
  late: "Late arrival",
  early: "Early",
  no_schedule: "Schedule missing",
  absent: "Absent",
};

export type HrNoticeEmployee = Pick<
  HrEmployeeDay,
  "employeeName" | "date" | "employeeCode" | "jobTitle" | "manager"
> & {
  displayName?: string | null;
  guardsName?: string | null;
  lateMinutes?: number | null;
  earlyInMinutes?: number | null;
  earlyOutMinutes?: number | null;
  mealBreaks?: HrEmployeeDay["mealBreaks"];
  totalMealMinutes?: number;
  shiftTier?: HrEmployeeDay["shiftTier"];
  violations?: HrViolation[];
  store?: string | null;
  schedule?: HrEmployeeDay["schedule"];
  segments?: HrEmployeeDay["segments"];
  userEmail?: string | null;
  mail?: string | null;
};

export type WarningMailDetails = {
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  clockIn?: string | null;
  clockOut?: string | null;
  lateMinutes?: number | null;
  earlyInMinutes?: number | null;
  earlyOutMinutes?: number | null;
};

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

export function noticeDisplayName(emp: HrNoticeEmployee): string {
  const explicit = emp.displayName?.trim();
  if (explicit) return explicit;
  return resolveHrEmployeeDisplayName(emp.employeeName, emp.guardsName);
}

export function warningCaseId(
  code: string | null,
  date: string,
  name: string,
  reason: HrWarningReason = "late"
): string {
  const token =
    reason === "early"
      ? "EARLY"
      : reason === "leave"
        ? "LEAVE"
        : reason === "absent"
          ? "ABSENT"
          : "LATE";
  return `HR-${token}-${noticeEmployeeSlug(code, name)}-${date}`;
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

export function formatWarningMailDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatClockLabel(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const mins = parseClockToMinutes(s);
  if (mins == null) return s;
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

export function formatDurationWords(mins: number): string {
  const n = Math.max(0, Math.round(mins));
  const h = Math.floor(n / 60);
  const m = n % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  return parts.join(" and ") || "0 minutes";
}

export function warningMailDetailsFromEmployee(emp: HrNoticeEmployee): WarningMailDetails {
  const segs = emp.segments ?? [];
  return {
    scheduledStart: emp.schedule?.start ?? null,
    scheduledEnd: emp.schedule?.end ?? null,
    clockIn: segs.find((s) => s.timeIn)?.timeIn ?? null,
    clockOut: [...segs].reverse().find((s) => s.timeOut)?.timeOut ?? null,
    lateMinutes: emp.lateMinutes ?? null,
    earlyInMinutes: emp.earlyInMinutes ?? null,
    earlyOutMinutes: emp.earlyOutMinutes ?? null,
  };
}

export function warningDescription(lateMinutes: number): string {
  const unit = lateMinutes === 1 ? "minute" : "minutes";
  return `Late Arrival by ${lateMinutes} ${unit}.`;
}

export function earlyDescription(earlyMinutes: number): string {
  const unit = earlyMinutes === 1 ? "minute" : "minutes";
  return `Early Arrival by ${earlyMinutes} ${unit}.`;
}

export function earlyOutDescription(minutes: number): string {
  const unit = minutes === 1 ? "minute" : "minutes";
  return `Left Early by ${minutes} ${unit}.`;
}

export function isLateForWarning(lateMinutes: number | null | undefined): boolean {
  return lateMinutes != null && lateMinutes >= LATE_WARNING_THRESHOLD_MINUTES;
}

export function isEarlyForWarning(earlyMinutes: number | null | undefined): boolean {
  return earlyMinutes != null && earlyMinutes >= EARLY_WARNING_THRESHOLD_MINUTES;
}

export function isEarlyOutForWarning(earlyOutMinutes: number | null | undefined): boolean {
  return earlyOutMinutes != null && earlyOutMinutes >= EARLY_WARNING_THRESHOLD_MINUTES;
}

/** Any attendance violation can receive a warning (absent, late, meal, etc.). */
export function isEligibleForHrNotice(emp: HrNoticeEmployee): boolean {
  return (
    (emp.violations?.length ?? 0) > 0 ||
    isLateForWarning(emp.lateMinutes) ||
    isEarlyForWarning(emp.earlyInMinutes) ||
    isEarlyOutForWarning(emp.earlyOutMinutes)
  );
}

export function matchesAttendanceCard(
  emp: HrNoticeEmployee,
  card: HrAttendanceCardFilter
): boolean {
  if (card === "all") return true;
  if (card === "flagged") return (emp.violations?.length ?? 0) > 0;
  if (card === "late") return isLateForWarning(emp.lateMinutes);
  if (card === "early") {
    return (
      isEarlyForWarning(emp.earlyInMinutes) ||
      isEarlyOutForWarning(emp.earlyOutMinutes) ||
      (emp.violations?.some((v) => v.type === "early_in" || v.type === "early_out") ?? false)
    );
  }
  if (card === "no_schedule") {
    return emp.violations?.some((v) => v.type === "no_schedule") ?? false;
  }
  return emp.violations?.some((v) => v.type === "absent") ?? false;
}

export function matchesEmployeeSearch(
  emp: Pick<HrEmployeeDay, "displayName" | "employeeName" | "employeeCode" | "guardsName">,
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const names: string[] = [];
  const pushName = (value: string | null | undefined) => {
    const raw = value?.trim().toLowerCase() ?? "";
    if (!raw) return;
    names.push(raw);
    if (raw.includes(",")) {
      names.push(raw.replace(/,/g, " "));
      names.push(
        raw
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .reverse()
          .join(" ")
      );
    }
  };
  // Payroll Name (employeeName) + resolved employee name (displayName / guards).
  pushName(emp.employeeName);
  pushName(emp.displayName);
  pushName(emp.guardsName);
  const code = emp.employeeCode?.trim().toLowerCase() ?? "";
  if (code) names.push(code);
  return names.some((value) => value.includes(needle));
}

export function employeeFilterLabel(
  emp: Pick<HrEmployeeDay, "displayName" | "employeeName" | "employeeCode">
): string {
  const display =
    emp.displayName?.trim() || emp.employeeName?.trim() || "Employee";
  const payroll = emp.employeeName?.trim() || "";
  const code = emp.employeeCode?.trim() || "";
  const parts = [display];
  if (payroll && payroll.toLowerCase() !== display.toLowerCase()) parts.push(payroll);
  if (code) parts.push(code);
  return parts.join(" · ");
}

export function attendanceKpisFromDays(
  list: Array<
    Pick<HrEmployeeDay, "violations" | "lateMinutes" | "earlyInMinutes"> &
      Partial<Pick<HrEmployeeDay, "earlyOutMinutes">>
  >
) {
  return {
    employees: list.length,
    flagged: list.filter((e) => e.violations.length > 0).length,
    late: list.filter((e) => isLateForWarning(e.lateMinutes)).length,
    early: list.filter(
      (e) => isEarlyForWarning(e.earlyInMinutes) || isEarlyOutForWarning(e.earlyOutMinutes)
    ).length,
    noSchedule: list.filter((e) => e.violations.some((v) => v.type === "no_schedule")).length,
    absent: list.filter((e) => e.violations.some((v) => v.type === "absent")).length,
  };
}

export function matchesViolationFilter(
  emp: HrNoticeEmployee,
  filter: HrViolationFilter | readonly HrViolationFilter[]
): boolean {
  const list = Array.isArray(filter) ? filter : [filter];
  const kinds = list.filter((f): f is Exclude<HrViolationFilter, "all"> => f !== "all");
  if (kinds.length === 0) return true;
  return kinds.some((kind) => matchesAttendanceCard(emp, kind));
}

/** Keep "All" exclusive of specific types; empty / all-kinds → all. */
export function normalizeViolationFilters(
  prev: readonly HrViolationFilter[],
  next: readonly string[]
): HrViolationFilter[] {
  const allowed = new Set<string>(HR_VIOLATION_FILTER_OPTIONS);
  const cleaned = next.filter((v): v is HrViolationFilter => allowed.has(v));
  const kinds = cleaned.filter((v): v is Exclude<HrViolationFilter, "all"> => v !== "all");
  const addedAll = cleaned.includes("all") && !prev.includes("all");
  const specificCount = HR_VIOLATION_FILTER_OPTIONS.filter((x) => x !== "all").length;
  if (addedAll || kinds.length === specificCount || cleaned.length === 0) return ["all"];
  if (prev.includes("all") && kinds.length > 0) return kinds;
  if (kinds.length === 0) return ["all"];
  return kinds;
}

export function warningReason(emp: HrNoticeEmployee): HrWarningReason {
  if (emp.violations?.some((v) => v.type === "absent")) return "absent";
  if (isLateForWarning(emp.lateMinutes)) return "late";
  if (isEarlyForWarning(emp.earlyInMinutes)) return "early";
  return "leave";
}

export function noticeDescriptionForEmployee(emp: HrNoticeEmployee): string {
  const parts: string[] = [];
  if (isLateForWarning(emp.lateMinutes)) {
    parts.push(warningDescription(emp.lateMinutes!));
  }
  if (isEarlyForWarning(emp.earlyInMinutes)) {
    parts.push(earlyDescription(emp.earlyInMinutes!));
  }
  if (isEarlyOutForWarning(emp.earlyOutMinutes)) {
    parts.push(earlyOutDescription(emp.earlyOutMinutes!));
  } else if (emp.violations?.some((v) => v.type === "early_out") && emp.earlyOutMinutes == null) {
    const msg = emp.violations.find((v) => v.type === "early_out");
    parts.push(msg?.message ?? "Left Early.");
  }
  if (parts.length === 0 && emp.violations?.length) {
    for (const v of emp.violations) {
      const message = v.message?.trim();
      if (message) {
        parts.push(message.endsWith(".") ? message : `${message}.`);
        continue;
      }
      if (v.type === "absent") parts.push("Absent.");
      else if (v.type) parts.push(`${String(v.type).replace(/_/g, " ")}.`);
    }
  }
  return parts.join(" ").trim() || "Attendance violation.";
}

function scheduleEventPhrases(emp: HrNoticeEmployee): string[] {
  const parts: string[] = [];
  if (emp.violations?.some((v) => v.type === "absent")) parts.push("were absent");
  if (isLateForWarning(emp.lateMinutes)) parts.push("arrived store late");
  if (isEarlyForWarning(emp.earlyInMinutes)) parts.push("arrived store early");
  if (
    isEarlyOutForWarning(emp.earlyOutMinutes) ||
    emp.violations?.some((v) => v.type === "early_out")
  ) {
    parts.push("left store early");
  }
  if (parts.length === 0 && emp.violations?.length) {
    for (const v of emp.violations) {
      if (v.type === "no_schedule") parts.push("had no schedule on file");
      else if (v.type?.includes("meal")) parts.push("had a meal-break violation");
      else if (v.type === "missing_punch") parts.push("had a missing punch");
      else if (v.message?.trim()) parts.push(v.message.trim().toLowerCase());
    }
  }
  if (parts.length === 0) parts.push("had an attendance violation");
  return parts;
}

function joinEventPhrases(parts: string[]): string {
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** Greeting uses given name only: "Altaf, Fahad" → Fahad. */
export function warningGreetingFirstName(fullName: string): string {
  const raw = String(fullName ?? "").trim();
  if (!raw) return "Team member";
  if (raw.includes(",")) {
    const given = raw.split(",").slice(1).join(" ").trim();
    const first = given.split(/\s+/).find(Boolean);
    if (first) return first;
  }
  return raw.split(/\s+/).find(Boolean) ?? raw;
}

const WARNING_JUSTIFICATION_NOTE =
  "Please reply to this email with justification within 24 hours otherwise an automated write-up will be issued.";

function violationSentences(
  events: string[],
  details: WarningMailDetails | undefined,
  when: string
): string[] {
  const out: string[] = [];
  if (isLateForWarning(details?.lateMinutes)) {
    out.push(
      `You have arrived ${formatDurationWords(details!.lateMinutes!)} after your scheduled start time on ${when}.`
    );
  }
  if (isEarlyForWarning(details?.earlyInMinutes)) {
    out.push(
      `You have arrived ${formatDurationWords(details!.earlyInMinutes!)} before your scheduled start time on ${when}.`
    );
  }
  if (isEarlyOutForWarning(details?.earlyOutMinutes)) {
    out.push(
      `You left the store ${formatDurationWords(details!.earlyOutMinutes!)} before the end of your scheduled shift on ${when}.`
    );
  }
  if (out.length) return out;
  if (events.includes("were absent") && events.length === 1) {
    return [`You were absent on ${when}.`];
  }
  if (events.length) {
    return [`You ${joinEventPhrases(events)} relative to your scheduled time on ${when}.`];
  }
  return [];
}

export function warningMailParagraphs(
  name: string,
  date: string,
  events: string[],
  details?: WarningMailDetails
): string[] {
  const when = formatWarningMailDate(date);
  const first = warningGreetingFirstName(name);
  const facts = violationSentences(events, details, when);
  return [
    `Dear ${first},`,
    ...facts,
    `Note:\n${WARNING_JUSTIFICATION_NOTE}`,
    "Sincerely,\nHR\nValliani Jewelers",
  ];
}

export function warningMailPlainText(
  name: string,
  date: string,
  events: string[],
  details?: WarningMailDetails
): string {
  return warningMailParagraphs(name, date, events, details).join("\n\n");
}

export function warningChatMessageFromDraft(draft: Pick<WarningNoticeDraft, "caseId" | "text">): string {
  const body = draft.text.trim();
  return body.includes(draft.caseId) ? body : `[${draft.caseId}]\n\n${body}`;
}

export function warningMailHtml(
  name: string,
  date: string,
  events: string[],
  details?: WarningMailDetails
): string {
  const paras = warningMailParagraphs(name, date, events, details);
  const inner = paras
    .map((p) => `<p style="margin:0 0 14px 0;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<div style="text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;">${inner}</div>`;
}

export function extractWarningCaseId(subject: string | null | undefined): string | null {
  const m = String(subject ?? "").match(HR_NOTICE_CASE_RE);
  return m ? m[0]!.toUpperCase() : null;
}

export function buildWarningNoticeHtml(input: {
  employeeName: string;
  date: string;
  lateMinutes?: number;
  description?: string;
  events?: string[];
}): string {
  const events = input.events?.length
    ? input.events
    : input.lateMinutes && input.lateMinutes >= LATE_WARNING_THRESHOLD_MINUTES
      ? ["arrived store late"]
      : ["arrived/left store early/late"];
  return warningMailHtml(input.employeeName, input.date, events, {
    lateMinutes: input.lateMinutes ?? null,
  });
}

export function buildWarningNoticeText(input: {
  employeeName: string;
  date: string;
  lateMinutes?: number;
  description?: string;
  events?: string[];
}): string {
  const events = input.events?.length
    ? input.events
    : input.lateMinutes && input.lateMinutes >= LATE_WARNING_THRESHOLD_MINUTES
      ? ["arrived store late"]
      : ["arrived/left store early/late"];
  return warningMailPlainText(input.employeeName, input.date, events, {
    lateMinutes: input.lateMinutes ?? null,
  });
}

export function draftWarningNotice(
  emp: HrNoticeEmployee,
  routing?: HrMailRouting | null,
  templates?: HrWarningTemplates | null
): WarningNoticeDraft {
  if (!isEligibleForHrNotice(emp)) {
    throw new Error("No attendance violation for a warning notice");
  }
  const lateMinutes = emp.lateMinutes ?? 0;
  const display = noticeDisplayName(emp);
  const events = scheduleEventPhrases(emp);
  const description = noticeDescriptionForEmployee(emp);
  const details = warningMailDetailsFromEmployee(emp);
  const caseId = warningCaseId(emp.employeeCode, emp.date, emp.employeeName, warningReason(emp));
  const sheetMail = parseHrMailAddresses(emp.mail ?? "");
  const templatedText = warningTextFromTemplate(
    templateKeyForEmployee(emp),
    display,
    emp.date,
    details,
    templates,
  );
  const text = templatedText ?? warningMailPlainText(display, emp.date, events, details);
  return {
    caseId,
    employeeName: emp.employeeName,
    date: emp.date,
    employeeCode: emp.employeeCode,
    jobTitle: emp.jobTitle,
    manager: emp.manager,
    lateMinutes,
    from: routing?.from?.trim() || HR_WARNING_FROM,
    to: sheetMail.length
      ? formatHrMailTo(sheetMail)
      : routing?.to?.length
        ? formatHrMailTo(routing.to)
        : HR_WARNING_TO,
    subject: warningSubject(caseId, display),
    html: templatedText ? warningTemplateHtml(templatedText) : warningMailHtml(display, emp.date, events, details),
    text,
    description,
  };
}

function templateKeyForEmployee(emp: HrNoticeEmployee): HrWarningTemplateKey {
  if (emp.violations?.some((v) => v.type === "absent")) return "absent";
  if (emp.violations?.some((v) => v.type === "no_schedule")) return "missingSchedule";
  if (emp.violations?.some((v) => v.type === "missing_punch")) return "missingPunch";
  if (emp.violations?.some((v) => v.type?.includes("meal"))) return "meal";
  if (isLateForWarning(emp.lateMinutes)) return "late";
  if (isEarlyOutForWarning(emp.earlyOutMinutes) || emp.violations?.some((v) => v.type === "early_out")) return "earlyOut";
  return "other";
}

function warningTextFromTemplate(
  key: HrWarningTemplateKey,
  employeeName: string,
  date: string,
  details: WarningMailDetails,
  templates?: HrWarningTemplates | null,
): string | null {
  const template = templates?.[key]?.trim();
  if (!template) return null;
  const values: Record<string, string> = {
    employeeName,
    date: formatWarningMailDate(date),
    lateMinutes: String(details.lateMinutes ?? 0),
    earlyOutMinutes: String(details.earlyOutMinutes ?? 0),
    scheduledStart: details.scheduledStart ?? "",
    scheduledEnd: details.scheduledEnd ?? "",
  };
  return template.replace(/\{\{\s*(employeeName|date|lateMinutes|earlyOutMinutes|scheduledStart|scheduledEnd)\s*\}\}/g, (_, name: string) => values[name] ?? "");
}

function warningTemplateHtml(text: string): string {
  return `<div style="text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;"><p>${escapeHtml(text).replace(/\n/g, "<br>")}</p></div>`;
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
    waivedAt: null,
    waivedBy: null,
    waivedComment: null,
  };
}
