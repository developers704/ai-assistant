import type { HrViolation, HrViolationType } from "./types";
import { formatMinutes, parseClockToMinutes } from "./time-utils";

export type GapKind = "none" | "micro" | "short_break" | "meal_break";

/** 10–29 min = rest/short (ignored for meal totals). ≥30 = meal. <10 = micro. */
export function classifyGapMinutes(minutes: number | null): GapKind {
  if (minutes == null || minutes < 10) return minutes == null ? "none" : "micro";
  if (minutes < 30) return "short_break";
  return "meal_break";
}

export type ShiftTier = "ten" | "eleven" | "twelve";

export function shiftTierFromScheduledMinutes(scheduledMinutes: number): ShiftTier {
  if (scheduledMinutes >= 12 * 60) return "twelve";
  if (scheduledMinutes > 10 * 60) return "eleven";
  return "ten";
}

export function expectedMealPolicy(tier: ShiftTier): {
  count: number;
  totalMinutes: number;
  maxTotalMinutes: number;
  maxEachMinutes: number;
} {
  if (tier === "twelve") {
    return { count: 2, totalMinutes: 120, maxTotalMinutes: 135, maxEachMinutes: 75 };
  }
  if (tier === "eleven") {
    return { count: 2, totalMinutes: 90, maxTotalMinutes: 105, maxEachMinutes: 75 };
  }
  return { count: 1, totalMinutes: 60, maxTotalMinutes: 75, maxEachMinutes: 75 };
}

export function violation(
  type: HrViolationType,
  message: string,
  severity: "error" | "warning" = "error"
): HrViolation {
  return { type, message, severity };
}

export function checkMealViolations(
  tier: ShiftTier,
  mealBreakMinutes: number[]
): HrViolation[] {
  const policy = expectedMealPolicy(tier);
  const out: HrViolation[] = [];
  const total = mealBreakMinutes.reduce((s, n) => s + n, 0);

  for (const mins of mealBreakMinutes) {
    if (mins >= policy.maxEachMinutes) {
      out.push(
        violation(
          "long_meal",
          `Meal break ${formatMinutes(mins)} exceeds ${policy.maxEachMinutes} min limit`
        )
      );
    }
  }

  if (mealBreakMinutes.length > 0 && total < 30) {
    out.push(
      violation(
        "short_meal_total",
        `Total meal time ${formatMinutes(total)} is under 30 minutes`
      )
    );
  }

  if (total > policy.maxTotalMinutes) {
    out.push(
      violation(
        "excessive_meal_total",
        `Total meal time ${formatMinutes(total)} exceeds ${policy.maxTotalMinutes} min limit for ${tier === "ten" ? "≤10h" : tier === "eleven" ? "11h" : "≥12h"} shift`
      )
    );
  }

  if (mealBreakMinutes.length !== policy.count && mealBreakMinutes.length > 0) {
    out.push(
      violation(
        "meal_count",
        `Expected ${policy.count} meal break(s), found ${mealBreakMinutes.length}`,
        "warning"
      )
    );
  }

  return out;
}

export function lateEarlyDeltaMinutes(
  scheduledStart: string,
  firstClockIn: string | null
): { lateMinutes: number; earlyMinutes: number } {
  const sched = parseClockToMinutes(scheduledStart);
  const actual = parseClockToMinutes(firstClockIn);
  if (sched == null || actual == null) return { lateMinutes: 0, earlyMinutes: 0 };
  const diff = actual - sched;
  return {
    lateMinutes: diff >= 12 ? diff : 0,
    earlyMinutes: diff <= -10 ? -diff : 0,
  };
}

export function checkLateEarly(
  scheduledStart: string,
  firstClockIn: string | null
): HrViolation[] {
  const out: HrViolation[] = [];
  if (!firstClockIn) return out;

  const sched = parseClockToMinutes(scheduledStart);
  const actual = parseClockToMinutes(firstClockIn);
  if (sched == null || actual == null) return out;

  const diff = actual - sched;
  if (diff >= 12) {
    out.push(violation("late", `Clock-in ${formatMinutes(diff)} late (scheduled ${scheduledStart})`));
  } else if (diff <= -10) {
    out.push(
      violation(
        "early_in",
        `Clock-in ${formatMinutes(-diff)} early (scheduled ${scheduledStart})`,
        "warning"
      )
    );
  }
  return out;
}
