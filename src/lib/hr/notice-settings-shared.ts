export const HR_WARNING_TEMPLATE_KEYS = [
  "lateIn",
  "lateOut",
  "earlyIn",
  "earlyOut",
  "absent",
  "missingSchedule",
] as const;

export type HrWarningTemplateKey = (typeof HR_WARNING_TEMPLATE_KEYS)[number];
export type HrWarningTemplates = Record<HrWarningTemplateKey, string>;

export const HR_WRITE_UP_TEMPLATE_KEYS = [
  "lateIn",
  "lateOut",
  "earlyIn",
  "earlyOut",
  "absent",
  "missingSchedule",
] as const;

export type HrWriteUpTemplateKey = (typeof HR_WRITE_UP_TEMPLATE_KEYS)[number];
export type HrWriteUpTemplates = Record<HrWriteUpTemplateKey, string>;

export const DEFAULT_HR_WARNING_TEMPLATES: HrWarningTemplates = {
  lateIn: "You arrived {{lateMinutes}} minutes after your scheduled start time on {{date}}.",
  lateOut: "You clocked out {{lateOutMinutes}} minutes after your scheduled end time on {{date}}.",
  earlyIn: "You arrived {{earlyInMinutes}} minutes before your scheduled start time on {{date}}.",
  earlyOut: "You left the store {{earlyOutMinutes}} minutes before the end of your scheduled shift on {{date}}.",
  absent: "You were absent on {{date}}.",
  missingSchedule: "You had no schedule on file for {{date}}.",
};

export const DEFAULT_HR_WRITE_UP_TEMPLATES: HrWriteUpTemplates = {
  lateIn: "[Employee Name] arrived at work after the scheduled start time without prior approval or an authorized schedule adjustment. Employees are expected to report to work on time and be ready to begin their scheduled shift.",
  lateOut: "[Employee Name] remained clocked in or departed after the scheduled end time without prior approval or an authorized schedule adjustment. Employees are expected to follow their assigned work schedule unless additional time has been approved.",
  earlyIn: "[Employee Name] arrived and clocked in before the scheduled start time without prior approval or an authorized early-start arrangement. Employees are expected to follow their assigned work schedule unless otherwise authorized.",
  earlyOut: "[Employee Name] left work before the scheduled end time without prior approval or authorization. Employees are expected to remain at work for the full scheduled shift unless permission to leave early has been granted.",
  absent: "[Employee Name] was absent during a scheduled shift without prior approval and/or without following the required absence notification procedure. Employees are expected to report to all scheduled shifts and properly notify management when unable to attend.",
  missingSchedule: "[Employee Name] worked or clocked in during a period with no assigned schedule without prior approval or authorization. Employees are expected to work only their assigned schedules unless otherwise approved by management.",
};
