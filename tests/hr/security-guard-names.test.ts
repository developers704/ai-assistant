import { describe, expect, it } from "vitest";
import {
  resolveHrEmployeeDisplayName,
  securityGuardIdFromPayrollName,
} from "@/lib/hr/security-guard-names";
import { attendanceKpisFromDays, matchesEmployeeSearch } from "@/lib/hr/warning-notice";
import { analyzeEmployeeDay } from "@/lib/hr/analyze";
import type { HrScheduleEntry, HrTimecardRow } from "@/lib/hr/types";

describe("security guard proper names", () => {
  it("maps numbered payroll labels case-insensitively", () => {
    expect(securityGuardIdFromPayrollName("1, Security Guard")).toBe(1);
    expect(securityGuardIdFromPayrollName("1, security guard")).toBe(1);
    expect(securityGuardIdFromPayrollName("1 security guard")).toBe(1);
    expect(resolveHrEmployeeDisplayName("1, security guard")).toBe("Syed Muqeet Asim");
    expect(resolveHrEmployeeDisplayName("2, Security Guard")).toBe("Muhammad Aleem");
    expect(resolveHrEmployeeDisplayName("3, security guard")).toBe("Akber Shaik");
    expect(resolveHrEmployeeDisplayName("4, Security Guard")).toBe("Mohammad Azeem");
    expect(resolveHrEmployeeDisplayName("6, security guard")).toBe("Mohammad Akram");
    expect(resolveHrEmployeeDisplayName("8, security guard")).toBe("Sultan Ansari");
    expect(resolveHrEmployeeDisplayName("9, security guard")).toBe("Tayab Abdul");
  });

  it("prefers the timecard Guards Name column", () => {
    expect(resolveHrEmployeeDisplayName("1, security guard", "Syed Muqeet Asim")).toBe(
      "Syed Muqeet Asim"
    );
  });

  it("leaves unmapped guard ids and other staff unchanged", () => {
    expect(resolveHrEmployeeDisplayName("5, security guard")).toBe("5, security guard");
    expect(resolveHrEmployeeDisplayName("Ahmed, Shazia")).toBe("Ahmed, Shazia");
  });

  it("shows the proper name on an analyzed schedule-only day", () => {
    const schedule: HrScheduleEntry[] = [
      { employeeName: "1 security guard", date: "2026-08-06", start: "11:15 AM", end: "8:30 PM" },
    ];
    const punches: HrTimecardRow[] = [];
    const day = analyzeEmployeeDay("1 security guard", "2026-08-06", punches, schedule);
    expect(day.displayName).toBe("Syed Muqeet Asim");
    expect(day.employeeName).toBe("1 security guard");
  });
});

describe("attendance search KPIs", () => {
  it("counts only the searched employee's days", () => {
    const aleemDays = [
      {
        displayName: "Muhammad Aleem",
        employeeName: "2, Security Guard",
        employeeCode: "AM5",
        guardsName: "Muhammad Aleem",
        lateMinutes: 15,
        earlyInMinutes: null,
        violations: [{ type: "late" as const, message: "Late", severity: "error" as const }],
      },
      {
        displayName: "Muhammad Aleem",
        employeeName: "2, Security Guard",
        employeeCode: "AM5",
        guardsName: "Muhammad Aleem",
        lateMinutes: null,
        earlyInMinutes: null,
        violations: [{ type: "absent" as const, message: "Absent", severity: "error" as const }],
      },
      {
        displayName: "Keya Biswas",
        employeeName: "Biswas, Keya",
        employeeCode: "KB2",
        guardsName: null,
        lateMinutes: 20,
        earlyInMinutes: null,
        violations: [{ type: "late" as const, message: "Late", severity: "error" as const }],
      },
    ];
    const matched = aleemDays.filter((d) => matchesEmployeeSearch(d, "aleem"));
    expect(matched).toHaveLength(2);
    expect(attendanceKpisFromDays(aleemDays).employees).toBe(3);
    expect(attendanceKpisFromDays(matched)).toEqual({
      employees: 2,
      flagged: 2,
      late: 1,
      early: 0,
      noSchedule: 0,
      absent: 1,
    });
  });
});
