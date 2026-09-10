import { describe, expect, it } from "vitest";
import { buildEmployeeSalesRoster } from "@/lib/hr/build-employee-commission";
import { employeeSalesRosterCsv } from "@/lib/hr/employee-sales-export";
import { HR_ATTENDANCE_FROM, HR_ATTENDANCE_TO } from "@/lib/hr/window";

describe("employee sales roster", () => {
  it("lists Sultan without store codes under his name", () => {
    const rows = buildEmployeeSalesRoster({
      from: HR_ATTENDANCE_FROM,
      to: HR_ATTENDANCE_TO,
      salespeople: ["SA4"],
    });
    expect(rows).toHaveLength(1);
    const sultan = rows[0]!;
    expect(sultan.code).toBe("SA4");
    expect(sultan.label).toMatch(/Sultan Ansari \(SA4\)/i);
    expect(sultan.label).not.toMatch(/VJ-/i);
    expect(sultan.commission.summary.netSales).toBeGreaterThan(100_000);
    expect(sultan.commission.summary.presentDays).toBeGreaterThan(0);
  });

  it("still applies the store filter to sales without putting stores on the label", () => {
    const all = buildEmployeeSalesRoster({
      from: HR_ATTENDANCE_FROM,
      to: HR_ATTENDANCE_TO,
      salespeople: ["SA4"],
    });
    const serra = buildEmployeeSalesRoster({
      from: HR_ATTENDANCE_FROM,
      to: HR_ATTENDANCE_TO,
      salespeople: ["SA4"],
      stores: ["VJ-SERRA"],
    });
    expect(all[0]?.label).toMatch(/Sultan Ansari \(SA4\)/i);
    expect(all[0]?.label).not.toMatch(/VJ-/i);
    expect(serra[0]?.label).not.toMatch(/VJ-/i);
    expect(serra[0]?.commission.summary.netSales).toBeGreaterThan(0);
    expect(serra[0]?.commission.summary.netSales).toBeLessThanOrEqual(
      all[0]?.commission.summary.netSales ?? 0
    );
  });

  it("reuses the August window so a design filter still keeps attendance", () => {
    const all = buildEmployeeSalesRoster({
      from: HR_ATTENDANCE_FROM,
      to: HR_ATTENDANCE_TO,
      salespeople: ["SA4"],
    });
    const watch = buildEmployeeSalesRoster({
      from: HR_ATTENDANCE_FROM,
      to: HR_ATTENDANCE_TO,
      salespeople: ["SA4"],
      designs: ["WATCH"],
    });
    expect(watch[0]?.commission.summary.presentDays).toBe(all[0]?.commission.summary.presentDays);
    expect(watch[0]?.commission.summary.scheduledDays).toBe(all[0]?.commission.summary.scheduledDays);
    expect(watch[0]?.commission.summary.netSales).toBeGreaterThan(0);
    expect(watch[0]?.commission.summary.netSales).toBeLessThan(all[0]?.commission.summary.netSales ?? 0);
  });

  it("exports filtered employees as CSV", () => {
    const rows = buildEmployeeSalesRoster({
      from: HR_ATTENDANCE_FROM,
      to: HR_ATTENDANCE_TO,
      salespeople: ["SA4"],
    });
    const csv = employeeSalesRosterCsv(rows);
    expect(csv).toContain(
      "Employee,Code,Net sales,Worked days,Absences,Base,Attendance bonus,Personal Goal Bonus,Store goal bonus,T.Comission"
    );
    expect(csv).not.toMatch(/,Units,/);
    expect(csv).toMatch(/Sultan Ansari \(SA4\)/);
    expect(csv).not.toMatch(/VJ-SERRA/);
    const sultan = rows[0]!;
    expect(csv).toContain(
      `${sultan.commission.summary.presentDays}/${sultan.commission.summary.scheduledDays}`
    );
  });
});
