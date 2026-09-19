import {
  ATTENDANCE_PASS_MAX_WRITE_UPS,
  designCommissionDollars,
  employeeCommissionRateForDesign,
  fullCommissionRateForDesign,
  roundCommissionDollars,
} from "@/lib/hr/commission-rates";
import { settleHrDesignTotals } from "@/lib/hr/hr-sales-design";

export type CommissionDesignLine = {
  design: string;
  totalSales: number;
  netSales: number;
  employeeRate: number;
  fullRate: number;
  baseCommission: number;
};

export type CommissionAttendanceIssue = {
  date: string;
  kind: "late" | "early" | "early_out" | "absent";
  label: string;
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
  /** Punched scheduled days plus waived scheduled no-punch days. */
  presentDays: number;
  absences: number;
  writeUps: number;
  absenceWriteUps: number;
  attendanceIssues: CommissionAttendanceIssue[];
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

export function attendancePasses(writeUps: number, absenceWriteUps = 0): boolean {
  return absenceWriteUps === 0 && writeUps <= ATTENDANCE_PASS_MAX_WRITE_UPS;
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
 * Attendance extras are dissolved by four write-ups of any kind or one
 * write-up for an unwaived absence. Base commission is always paid.
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
  writeUps?: number;
  absenceWriteUps?: number;
  attendanceIssues?: CommissionAttendanceIssue[];
}): CommissionSummary {
  const exactBase = input.lines.reduce((s, l) => s + l.baseCommission, 0);
  const baseCommission = roundCommissionDollars(exactBase);
  const writeUps = input.writeUps ?? 0;
  const absenceWriteUps = input.absenceWriteUps ?? 0;
  const passed = attendancePasses(writeUps, absenceWriteUps);
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
    writeUps,
    absenceWriteUps,
    attendanceIssues: input.attendanceIssues ?? [],
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
  writeUps?: number;
  absenceWriteUps?: number;
  attendanceIssues?: CommissionAttendanceIssue[];
}): EmployeeCommission {
  const netHint = Number.isFinite(input.netSales) ? input.netSales : 0;
  const settled = settleHrDesignTotals(
    input.designs.map((d) => ({ design: d.design, netSales: d.netSales })),
    netHint || input.designs.reduce((s, d) => s + d.netSales, 0)
  );
  const lines = buildDesignCommissionLines(settled);
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
      writeUps: input.writeUps,
      absenceWriteUps: input.absenceWriteUps,
      attendanceIssues: input.attendanceIssues,
    }),
  };
}
