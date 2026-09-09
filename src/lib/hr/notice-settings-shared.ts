export const HR_WARNING_TEMPLATE_KEYS = [
  "late",
  "earlyOut",
  "missingSchedule",
  "absent",
  "missingPunch",
  "meal",
  "other",
] as const;

export type HrWarningTemplateKey = (typeof HR_WARNING_TEMPLATE_KEYS)[number];
export type HrWarningTemplates = Record<HrWarningTemplateKey, string>;

export const DEFAULT_HR_WARNING_TEMPLATES: HrWarningTemplates = {
  late: "You arrived {{lateMinutes}} minutes after your scheduled start time on {{date}}.",
  earlyOut: "You left the store {{earlyOutMinutes}} minutes before the end of your scheduled shift on {{date}}.",
  missingSchedule: "You had no schedule on file for {{date}}.",
  absent: "You were absent on {{date}}.",
  missingPunch: "Your attendance record has a missing punch for {{date}}.",
  meal: "Your meal-break record did not meet the attendance policy on {{date}}.",
  other: "Your attendance record has an exception for {{date}}.",
};
