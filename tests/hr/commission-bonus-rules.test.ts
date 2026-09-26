import { describe, expect, it } from "vitest";
import { summarizeCommission, type CommissionDesignLine } from "@/lib/hr/commission";

const line = (baseCommission: number): CommissionDesignLine => ({
  design: "NOVELLO",
  totalSales: baseCommission * 20,
  netSales: baseCommission * 20,
  employeeRate: 0.05,
  fullRate: 0.05,
  baseCommission,
});

const base = {
  personalGoal: 10_000,
  netSales: 12_000,
  storeCode: "VJ-VAL",
  storeGoal: 50_000,
  storeTotalSales: 60_000,
  scheduledDays: 20,
  presentDays: 20,
  absences: 0,
};

describe("commission bonus rules", () => {
  it("passing attendance doubles base; each met goal adds half", () => {
    const s = summarizeCommission({ ...base, lines: [line(600)] });
    expect(s.attendanceBonus).toBe(600);
    expect(s.personalGoalBonus).toBe(300);
    expect(s.storeGoalBonus).toBe(300);
    expect(s.totalCommission).toBe(1800);
  });

  it("one absence write-up dissolves all bonuses; base still pays", () => {
    const s = summarizeCommission({ ...base, lines: [line(600)], absenceWriteUps: 1 });
    expect(s.attendancePassed).toBe(false);
    expect(s.totalCommission).toBe(600);
  });

  it("three other write-ups still pass, the fourth dissolves bonuses", () => {
    expect(summarizeCommission({ ...base, lines: [line(600)], writeUps: 3 }).attendancePassed).toBe(true);
    expect(summarizeCommission({ ...base, lines: [line(600)], writeUps: 4 }).attendancePassed).toBe(false);
  });

  it("negative base (net returns) is never doubled into a bonus", () => {
    const s = summarizeCommission({ ...base, lines: [line(-40)], netSales: -800 });
    expect(s.baseCommission).toBe(-40);
    expect(s.attendanceBonus).toBe(0);
    expect(s.personalGoalBonus).toBe(0);
    expect(s.storeGoalBonus).toBe(0);
    expect(s.totalCommission).toBe(-40);
  });
});
