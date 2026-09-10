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

export const DEFAULT_HR_WARNING_TEMPLATES: HrWarningTemplates = {
  lateIn: "You arrived {{lateMinutes}} minutes after your scheduled start time on {{date}}.",
  lateOut: "You clocked out {{lateOutMinutes}} minutes after your scheduled end time on {{date}}.",
  earlyIn: "You arrived {{earlyInMinutes}} minutes before your scheduled start time on {{date}}.",
  earlyOut: "You left the store {{earlyOutMinutes}} minutes before the end of your scheduled shift on {{date}}.",
  absent: "You were absent on {{date}}.",
  missingSchedule: "You had no schedule on file for {{date}}.",
};
