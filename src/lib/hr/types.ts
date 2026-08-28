export type HrViolationType =
  | "missing_punch"
  | "late"
  | "early_in"
  | "no_schedule"
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
  date: string;
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
  /** Minutes early vs schedule (≥10 min threshold). */
  earlyInMinutes: number | null;
  violations: HrViolation[];
};

export type HrTimecardRow = {
  employeeName: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  gapFromPrevious: string | null;
  hoursLabel: string | null;
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
