export type HrViolationType =
  | "missing_punch"
  | "late"
  | "early_in"
  | "early_out"
  | "no_schedule"
  | "absent"
  | "long_meal"
  | "short_meal_total"
  | "excessive_meal_total"
  | "meal_count";

export type HrViolation = {
  type: HrViolationType;
  message: string;
  severity: "error" | "warning";
};

export type HrPunchSegment = {
  timeIn: string | null;
  timeOut: string | null;
  gapFromPrevious: string | null;
  gapMinutes: number | null;
  gapKind: "none" | "micro" | "short_break" | "meal_break";
  workMinutes: number;
  workLabel: string;
  violations: HrViolation[];
};

export type HrScheduleSlot = {
  start: string;
  end: string;
  scheduledMinutes: number;
  scheduledLabel: string;
};

export type HrEmployeeDay = {
  employeeName: string;
  /** Proper name for UI / mail (security-guard map or Guards Name). */
  displayName: string;
  date: string;
  employeeCode: string | null;
  jobTitle: string | null;
  store: string | null;
  manager: string | null;
  guardsName: string | null;
  schedule: HrScheduleSlot | null;
  shiftTier: "ten" | "eleven" | "twelve" | null;
  segments: HrPunchSegment[];
  mealBreaks: { gapMinutes: number; gapLabel: string }[];
  shortBreaks: { gapMinutes: number; gapLabel: string }[];
  totalWorkMinutes: number;
  totalWorkLabel: string;
  totalMealMinutes: number;
  totalMealLabel: string;
  expectedMealMinutes: number;
  expectedMealCount: number;
  /** Minutes late vs schedule (≥12 min threshold). */
  lateMinutes: number | null;
  /** Minutes early vs schedule start (≥10 min threshold). */
  earlyInMinutes: number | null;
  /** Minutes early vs schedule end (≥10 min threshold). */
  earlyOutMinutes: number | null;
  violations: HrViolation[];
  warning?: HrWarningNotice | null;
  writeUp?: HrWarningNotice | null;
  /** Absent day was waived — still shown, but it does not count for commission extras. */
  absenceWaived?: boolean;
  absenceWaiver?: HrAbsenceWaiver | null;
};

export type HrAbsenceWaiver = {
  employeeName: string;
  employeeCode: string | null;
  date: string;
  waivedAt: string;
  waivedBy?: string | null;
  comment?: string | null;
};

export type HrWarningRemark = {
  id: string;
  fromName: string;
  fromEmail: string;
  sentAt: string;
  subject: string;
  body: string;
  messageId: string;
  uid: number;
};

export type HrNoticeKind = "warning" | "writeup";

export type HrWarningNotice = {
  caseId: string;
  kind?: HrNoticeKind;
  employeeName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  manager: string | null;
  store?: string | null;
  date: string;
  lateMinutes: number;
  description?: string | null;
  from: string;
  to: string;
  subject: string;
  sentAt: string;
  messageId: string | null;
  remarks: HrWarningRemark[];
  /** When set, this warning does not count as a schedule violation. */
  waivedAt?: string | null;
  waivedBy?: string | null;
  waivedComment?: string | null;
};

export type HrTimecardRow = {
  employeeName: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  gapFromPrevious: string | null;
  hoursLabel: string | null;
  employeeCode?: string | null;
  jobTitle?: string | null;
  store?: string | null;
  manager?: string | null;
  guardsName?: string | null;
};

export type HrScheduleEntry = {
  employeeName: string;
  date: string;
  start: string;
  end: string;
};

export type HrUploadMeta = {
  id: string;
  kind: "timecard" | "schedule";
  fileName: string;
  uploadedAt: string;
  dateFrom?: string;
  dateTo?: string;
};
