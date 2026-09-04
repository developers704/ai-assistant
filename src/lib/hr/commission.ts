import {
  ATTENDANCE_PASS_MAX_ABSENCES,
  designCommissionDollars,
  employeeCommissionRateForDesign,
  fullCommissionRateForDesign,
  roundCommissionDollars,
} from "@/lib/hr/commission-rates";

export type CommissionDesignLine = {
  design: string;
  totalSales: number;
  netSales: number;
  employeeRate: number;
  fullRate: number;
  baseCommission: number;
};

export type CommissionSummary = {
  netSales: number;
  personalGoal: number;
  personalGoalAchieved: boolean;
  storeCode: string | null;
  storeGoal: number;
  storeTotalSales: number;
  storeGoalAchieved: boolean;
  scheduledDays: number;
  presentDays: number;
  absences: number;
  attendancePassed: boolean;
  baseCommission: number;
  attendanceBonus: number;
  personalGoalBonus: number;
  storeGoalBonus: number;
  totalCommission: number;
};

export type EmployeeCommission = {
  code: string;
  lines: CommissionDesignLine[];
  summary: CommissionSummary;
};

export function attendancePasses(absences: number): boolean {
  return absences <= ATTENDANCE_PASS_MAX_ABSENCES;
}

export function buildDesignCommissionLines(
  designs: { design: string; netSales: number; totalSales?: number }[]
): CommissionDesignLine[] {
  return designs
    .filter((d) => d.design.trim())
    .map((d) => {
      const net = d.netSales;
      const total = d.totalSales ?? net;
      const employeeRate = employeeCommissionRateForDesign(d.design);
      return {
        design: d.design,
        totalSales: total,
        netSales: net,
        employeeRate,
        fullRate: fullCommissionRateForDesign(d.design),
        baseCommission: designCommissionDollars(net, d.design),
      };
    });
}

/**
 * Attendance bonus equals rounded base commission when absences are 0–3.
 * Personal / store bonuses are each 50% of the attendance bonus when that
 * goal hits and attendance still passes. Base commission is always paid.
 */
export function summarizeCommission(input: {
  lines: CommissionDesignLine[];
  personalGoal: number;
  netSales: number;
  storeCode: string | null;
  storeGoal: number;
  storeTotalSales: number;
  scheduledDays: number;
  presentDays: number;
  absences: number;
}): CommissionSummary {
  const exactBase = input.lines.reduce((s, l) => s + l.baseCommission, 0);
  const baseCommission = roundCommissionDollars(exactBase);
  const passed = attendancePasses(input.absences);
  const personalGoalAchieved = input.netSales >= input.personalGoal && input.personalGoal > 0;
  const storeGoalAchieved = input.storeTotalSales >= input.storeGoal && input.storeGoal > 0;
  const attendanceBonus = passed ? baseCommission : 0;
  const personalGoalBonus = passed && personalGoalAchieved ? roundCommissionDollars(attendanceBonus * 0.5) : 0;
  const storeGoalBonus = passed && storeGoalAchieved ? roundCommissionDollars(attendanceBonus * 0.5) : 0;
  return {
    netSales: input.netSales,
    personalGoal: input.personalGoal,
    personalGoalAchieved,
    storeCode: input.storeCode,
    storeGoal: input.storeGoal,
    storeTotalSales: input.storeTotalSales,
    storeGoalAchieved,
    scheduledDays: input.scheduledDays,
    presentDays: input.presentDays,
    absences: input.absences,
    attendancePassed: passed,
    baseCommission,
    attendanceBonus,
    personalGoalBonus,
    storeGoalBonus,
    totalCommission: baseCommission + attendanceBonus + personalGoalBonus + storeGoalBonus,
  };
}

export function assembleEmployeeCommission(input: {
  code: string;
  designs: { design: string; netSales: number; totalSales?: number }[];
  netSales: number;
  personalGoal: number;
  storeCode: string | null;
  storeGoal: number;
  storeTotalSales: number;
  scheduledDays: number;
  presentDays: number;
  absences: number;
}): EmployeeCommission {
  const lines = buildDesignCommissionLines(input.designs);
  const netSales =
    Number.isFinite(input.netSales) && Math.abs(input.netSales) > 0.005
      ? input.netSales
      : lines.reduce((s, l) => s + l.netSales, 0);
  return {
    code: input.code,
    lines,
    summary: summarizeCommission({
      lines,
      personalGoal: input.personalGoal,
      netSales,
      storeCode: input.storeCode,
      storeGoal: input.storeGoal,
      storeTotalSales: input.storeTotalSales,
      scheduledDays: input.scheduledDays,
      presentDays: input.presentDays,
      absences: input.absences,
    }),
  };
}
