import { describe, expect, it } from "vitest";
import { buildMySchedule } from "@/lib/hr/my-schedule";

const entries = [
  { employeeName: "Acosta Jesus", date: "2026-08-02", start: "11:00 AM", end: "8:00 PM" },
  { employeeName: "Acosta Jesus", date: "2026-08-01", start: "11:00 AM", end: "8:30 PM" },
  { employeeName: "Alvarez Lynette", date: "2026-08-01", start: "10:00 AM", end: "6:00 PM" },
  { employeeName: "1 security guard", date: "2026-08-01", start: "9:15 AM", end: "9:00 PM" },
  { employeeName: "2 security guard", date: "2026-08-01", start: "9:15 AM", end: "9:00 PM" },
];

const punches = [
  { employeeName: "Acosta, Jesus A", employeeCode: "JA4", guardsName: null },
  { employeeName: "2, Security Guard", employeeCode: "AM5", guardsName: "Muhammad Aleem" },
];

describe("buildMySchedule", () => {
  it("returns only the login's shifts, sorted by date, with scheduled hours", () => {
    const { shifts, matchedNames } = buildMySchedule({ name: "Acosta, Jesus A" }, entries, punches);
    expect(matchedNames).toEqual(["Acosta Jesus"]);
    expect(shifts.map((s) => s.date)).toEqual(["2026-08-01", "2026-08-02"]);
    expect(shifts[0]).toMatchObject({ start: "11:00 AM", end: "8:30 PM", scheduledLabel: "9:30" });
  });

  it("matches a first-last login against last-first schedule names", () => {
    const { shifts } = buildMySchedule({ name: "Jesus Acosta" }, entries, punches);
    expect(shifts).toHaveLength(2);
  });

  it("finds the schedule through the timecard employee code", () => {
    const { shifts } = buildMySchedule({ name: "J. A.", employeeCode: "ja4" }, entries, punches);
    expect(shifts).toHaveLength(2);
  });

  it("maps security-guard posts to the guard's login name", () => {
    expect(buildMySchedule({ name: "Syed Muqeet Asim" }, entries, punches).matchedNames).toEqual([
      "1 security guard",
    ]);
    expect(buildMySchedule({ name: "Muhammad Aleem" }, entries, punches).matchedNames).toEqual([
      "2 security guard",
    ]);
  });

  it("returns nothing for a login with no schedule rows", () => {
    expect(buildMySchedule({ name: "Nobody, Here" }, entries, punches).shifts).toEqual([]);
  });
});
