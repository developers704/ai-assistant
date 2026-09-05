import type { HrEmployeeDay, HrWarningNotice, HrViolation } from "./types";
import {
  DEFAULT_HR_MAIL_FROM,
  DEFAULT_HR_MAIL_TO,
  formatHrMailTo,
  type HrMailRouting,
} from "./mail-routing";
import { resolveHrEmployeeDisplayName } from "./security-guard-names";
import { parseClockToMinutes } from "./time-utils";

export const HR_WARNING_FROM = DEFAULT_HR_MAIL_FROM;
export const HR_WARNING_TO = DEFAULT_HR_MAIL_TO[0]!;
export const LATE_WARNING_THRESHOLD_MINUTES = 12;
export const EARLY_WARNING_THRESHOLD_MINUTES = 10;
export const HR_WARNING_CASE_RE = /HR-LATE-[A-Z0-9]+-\d{4}-\d{2}-\d{2}/i;
/** Warning (`HR-LATE-` / `HR-EARLY-` / `HR-LEAVE-` / legacy `HR-MEAL-`) or write-up (`HR-WRITEUP-`). */
export const HR_NOTICE_CASE_RE = /HR-(?:LATE|EARLY|LEAVE|MEAL|WRITEUP)-[A-Z0-9]+-\d{4}-\d{2}-\d{2}/i;

export type HrWarningReason = "late" | "early" | "leave";
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
  const token = reason === "early" ? "EARLY" : reason === "leave" ? "LEAVE" : "LATE";
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

export function isEligibleForHrNotice(emp: HrNoticeEmployee): boolean {
  return (
    isLateForWarning(emp.lateMinutes) ||
    isEarlyForWarning(emp.earlyInMinutes) ||
    isEarlyOutForWarning(emp.earlyOutMinutes) ||
    (emp.violations?.some((v) => v.type === "early_out") ?? false)
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
      (emp.violations?.some((v) => v.type === "early_in") ?? false)
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
  const hay = [emp.displayName, emp.employeeName, emp.employeeCode, emp.guardsName]
    .filter((s): s is string => Boolean(s?.trim()))
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function attendanceKpisFromDays(
  list: Array<
    Pick<HrEmployeeDay, "violations" | "lateMinutes" | "earlyInMinutes">
  >
) {
  return {
    employees: list.length,
    flagged: list.filter((e) => e.violations.length > 0).length,
    late: list.filter((e) => isLateForWarning(e.lateMinutes)).length,
    early: list.filter((e) => isEarlyForWarning(e.earlyInMinutes)).length,
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
  return parts.join(" ");
}

function scheduleEventPhrases(emp: HrNoticeEmployee): string[] {
  const parts: string[] = [];
  if (isLateForWarning(emp.lateMinutes)) parts.push("arrived store late");
  if (isEarlyForWarning(emp.earlyInMinutes)) parts.push("arrived store early");
  if (
    isEarlyOutForWarning(emp.earlyOutMinutes) ||
    emp.violations?.some((v) => v.type === "early_out")
  ) {
    parts.push("left store early");
  }
  if (parts.length === 0) parts.push("arrived/left store early/late");
  return parts;
}

function joinEventPhrases(parts: string[]): string {
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function replyReasonLine(events: string[]): string {
  const left = events.some((e) => /left/i.test(e));
  const late = events.some((e) => /late/i.test(e));
  const early = events.some((e) => /arrived store early/i.test(e));
  if (left && !late && !early) {
    return "Please reply to this email with the reason you left early.";
  }
  if (late && !left && !early) {
    return "Please reply to this email with the reason you arrived late.";
  }
  if (early && !left && !late) {
    return "Please reply to this email with the reason you arrived early.";
  }
  return "Please reply to this email with the reason for this attendance exception.";
}

function violationSentences(events: string[], details?: WarningMailDetails): string[] {
  const out: string[] = [];
  if (isLateForWarning(details?.lateMinutes)) {
    out.push(
      `You arrived ${formatDurationWords(details!.lateMinutes!)} after your scheduled start time.`
    );
  }
  if (isEarlyForWarning(details?.earlyInMinutes)) {
    out.push(
      `You arrived ${formatDurationWords(details!.earlyInMinutes!)} before your scheduled start time.`
    );
  }
  if (isEarlyOutForWarning(details?.earlyOutMinutes)) {
    out.push(
      `You left the store ${formatDurationWords(details!.earlyOutMinutes!)} before the end of your scheduled shift.`
    );
  }
  if (out.length) return out;
  if (events.length) {
    return [
      `You ${joinEventPhrases(events)} relative to your scheduled time.`,
    ];
  }
  return [];
}

function recordedTimeLine(details?: WarningMailDetails): string | null {
  const clockIn = formatClockLabel(details?.clockIn);
  const clockOut = formatClockLabel(details?.clockOut);
  if (clockIn && clockOut) {
    return `Time recorded: clocked in at ${clockIn} and clocked out at ${clockOut}.`;
  }
  if (clockOut) return `Time recorded: clocked out at ${clockOut}.`;
  if (clockIn) return `Time recorded: clocked in at ${clockIn}.`;
  return null;
}

function scheduledShiftLine(details?: WarningMailDetails): string | null {
  const start = formatClockLabel(details?.scheduledStart);
  const end = formatClockLabel(details?.scheduledEnd);
  if (start && end) return `Scheduled shift: ${start} – ${end}.`;
  if (start) return `Scheduled start: ${start}.`;
  if (end) return `Scheduled end: ${end}.`;
  return null;
}

export function warningMailParagraphs(
  name: string,
  date: string,
  events: string[],
  details?: WarningMailDetails
): string[] {
  const when = formatWarningMailDate(date);
  const facts = [
    scheduledShiftLine(details),
    recordedTimeLine(details),
    ...violationSentences(events, details),
  ].filter((s): s is string => Boolean(s));
  return [
    `Dear ${name},`,
    `This notice concerns your attendance on ${when}.`,
    ...facts,
    replyReasonLine(events),
    "If we do not receive a confirmation, an automated write-up will be issued.",
    "Sincerely,\nHuman Resources\nValliani Jewelers",
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

export function warningMailHtml(
  name: string,
  date: string,
  events: string[],
  details?: WarningMailDetails
): string {
  const paras = warningMailParagraphs(name, date, events, details);
  return paras
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
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
  routing?: HrMailRouting | null
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
  return {
    caseId,
    employeeName: emp.employeeName,
    date: emp.date,
    employeeCode: emp.employeeCode,
    jobTitle: emp.jobTitle,
    manager: emp.manager,
    lateMinutes,
    from: routing?.from?.trim() || HR_WARNING_FROM,
    to: routing?.to?.length ? formatHrMailTo(routing.to) : HR_WARNING_TO,
    subject: warningSubject(caseId, display),
    html: warningMailHtml(display, emp.date, events, details),
    text: warningMailPlainText(display, emp.date, events, details),
    description,
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
    waivedAt: null,
    waivedBy: null,
    waivedComment: null,
  };
}
