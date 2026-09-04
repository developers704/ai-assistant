import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { assembleEmployeeCommission, attendancePasses } from "@/lib/hr/commission";
import { employeeCommissionRateForDesign, roundCommissionDollars } from "@/lib/hr/commission-rates";
import {
  AUGUST_PERSONAL_GOALS,
  AUGUST_STORE_GOALS,
  dummyGoalAboveActual,
  ZOYA_AUGUST_DESIGN_SALES,
  ZOYA_AUGUST_NET_SALES,
} from "@/lib/hr/august-2026-commission-data";
import { commissionAttendanceForAssociate } from "@/lib/hr/commission-attendance";
import { parseTimecardCsv } from "@/lib/hr/parse-timecard";
import { parseScheduleCsv } from "@/lib/hr/parse-schedule";
import { HR_ATTENDANCE_FROM, HR_ATTENDANCE_TO } from "@/lib/hr/window";
import { isDmAllowedApiPath } from "@/lib/auth/routes";
import { getDefaultPermissionMapForRole } from "@/lib/auth/user-permissions";

describe("design commission rates", () => {
  it("pays half of the sheet full rate on each design family", () => {
    expect(employeeCommissionRateForDesign("LINKNLOCK")).toBe(0.02);
    expect(employeeCommissionRateForDesign("Link N Lock")).toBe(0.02);
    expect(employeeCommissionRateForDesign("LOVE")).toBe(0.015);
    expect(employeeCommissionRateForDesign("Lovespell")).toBe(0.015);
    expect(employeeCommissionRateForDesign("OROVENTI")).toBe(0.015);
    expect(employeeCommissionRateForDesign("UV")).toBe(0.005);
    expect(employeeCommissionRateForDesign("Ultimate Value")).toBe(0.005);
    expect(employeeCommissionRateForDesign("NOVELLO")).toBe(0.01);
    expect(employeeCommissionRateForDesign("GOLD JEWL")).toBe(0.01);
  });
});

describe("Zoya August commission test case", () => {
  const zoya = assembleEmployeeCommission({
    code: "ZA2",
    designs: ZOYA_AUGUST_DESIGN_SALES,
    netSales: ZOYA_AUGUST_NET_SALES,
    personalGoal: AUGUST_PERSONAL_GOALS.ZA2!,
    storeCode: "VJ-VAL",
    storeGoal: AUGUST_STORE_GOALS["VJ-VAL"]!,
    storeTotalSales: 311_349,
    scheduledDays: 26,
    presentDays: 26,
    absences: 0,
  });

  it("pays design-wise base commission totaling $1,360", () => {
    expect(zoya.summary.netSales).toBe(131_812);
    expect(zoya.summary.baseCommission).toBe(1_360);
    const link = zoya.lines.find((l) => l.design === "LINKNLOCK");
    expect(link?.employeeRate).toBe(0.02);
    expect(roundCommissionDollars(link!.baseCommission)).toBe(50);
  });

  it("hides the OVANI return and puts leftover vs net into Others", () => {
    expect(zoya.lines.find((l) => /ovani/i.test(l.design) && l.design !== "BELLA OVANI")).toBeUndefined();
    const others = zoya.lines.find((l) => l.design === "Others");
    const namedSum = zoya.lines
      .filter((l) => l.design !== "Others")
      .reduce((s, l) => s + l.netSales, 0);
    expect(others?.netSales).toBe(131_812 - namedSum);
    expect(others?.netSales).toBe(14_152);
    expect(zoya.lines.reduce((s, l) => s + l.netSales, 0)).toBe(131_812);
  });

  it("qualifies for attendance, personal-goal, and store-goal bonuses", () => {
    expect(zoya.summary.attendancePassed).toBe(true);
    expect(zoya.summary.personalGoalAchieved).toBe(true);
    expect(zoya.summary.storeGoalAchieved).toBe(true);
    expect(zoya.summary.attendanceBonus).toBe(1_360);
    expect(zoya.summary.personalGoalBonus).toBe(680);
    expect(zoya.summary.storeGoalBonus).toBe(680);
    expect(zoya.summary.totalCommission).toBe(4_080);
  });

  it("still pays base commission when attendance fails", () => {
    const failed = assembleEmployeeCommission({
      code: "ZA2",
      designs: ZOYA_AUGUST_DESIGN_SALES,
      netSales: ZOYA_AUGUST_NET_SALES,
      personalGoal: AUGUST_PERSONAL_GOALS.ZA2!,
      storeCode: "VJ-VAL",
      storeGoal: AUGUST_STORE_GOALS["VJ-VAL"]!,
      storeTotalSales: 311_349,
      scheduledDays: 26,
      presentDays: 22,
      absences: 4,
    });
    expect(attendancePasses(4)).toBe(false);
    expect(failed.summary.baseCommission).toBe(1_360);
    expect(failed.summary.attendanceBonus).toBe(0);
    expect(failed.summary.personalGoalBonus).toBe(0);
    expect(failed.summary.storeGoalBonus).toBe(0);
    expect(failed.summary.totalCommission).toBe(1_360);
  });
});

describe("August dummy attendance absences", () => {
  const punches = parseTimecardCsv(
    fs.readFileSync(path.join(process.cwd(), "data/hr/Timecard-August-2026.csv"), "utf8")
  );
  const { entries } = parseScheduleCsv(
    fs.readFileSync(path.join(process.cwd(), "data/hr/Schedule-August-2026.csv"), "utf8")
  );

  it("counts Zoya as 0 absences (scheduled with punches)", () => {
    const zoya = commissionAttendanceForAssociate(
      "ZA2",
      HR_ATTENDANCE_FROM,
      HR_ATTENDANCE_TO,
      punches,
      entries
    );
    expect(zoya.absences).toBe(0);
    expect(zoya.scheduledDays).toBe(26);
    expect(zoya.presentDays).toBe(26);
    expect(zoya.posStore).toBe("VJ-VAL");
  });

  it("counts Lynette dummy unworked schedule days as 4 absences", () => {
    const lynette = commissionAttendanceForAssociate(
      "LY",
      HR_ATTENDANCE_FROM,
      HR_ATTENDANCE_TO,
      punches,
      entries
    );
    expect(lynette.absences).toBe(4);
    expect(lynette.scheduledDays).toBe(31);
    expect(lynette.presentDays).toBe(27);
    expect(attendancePasses(lynette.absences)).toBe(false);
  });

  it("does not count unscheduled days as absences", () => {
    const none = commissionAttendanceForAssociate(
      "NO-SUCH-CODE",
      HR_ATTENDANCE_FROM,
      HR_ATTENDANCE_TO,
      punches,
      entries
    );
    expect(none.scheduledDays).toBe(0);
    expect(none.absences).toBe(0);
    expect(attendancePasses(none.absences)).toBe(true);
  });
});

describe("dummy August goals", () => {
  it("names five personal-goal achievers including Zoya", () => {
    expect(Object.keys(AUGUST_PERSONAL_GOALS).sort()).toEqual(["SA4", "SK7", "WM", "ZA2", "ZN"].sort());
    expect(AUGUST_PERSONAL_GOALS.ZA2).toBe(114_000);
  });

  it("sets Valley Fair store goal so the $311,349 actual hits", () => {
    expect(AUGUST_STORE_GOALS["VJ-VAL"]).toBe(285_000);
    expect(311_349).toBeGreaterThan(AUGUST_STORE_GOALS["VJ-VAL"]!);
  });

  it("keeps generated dummy goals above actual sales", () => {
    expect(dummyGoalAboveActual(99_693)).toBeGreaterThan(99_693);
    expect(dummyGoalAboveActual(0)).toBe(5_000);
  });
});

describe("commission API access", () => {
  it("lets employees read /api/hr/commission without HR Management", () => {
    const permissions = getDefaultPermissionMapForRole("employee");
    expect(isDmAllowedApiPath("/api/hr/commission", "zoya@valliani.app", "employee", permissions)).toBe(
      true
    );
    expect(isDmAllowedApiPath("/api/hr", "zoya@valliani.app", "employee", permissions)).toBe(false);
  });
});
