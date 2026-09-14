import { describe, expect, it } from "vitest";
import { parseTimecardCsv } from "@/lib/hr/parse-timecard";
import {
  isExcludedHrAttendancePerson,
  isHrSalesOrManagerTitle,
  keepHrAttendanceTimecardRow,
} from "@/lib/hr/attendance-roster";
import type { HrTimecardRow } from "@/lib/hr/types";

function row(partial: Partial<HrTimecardRow> & Pick<HrTimecardRow, "employeeName">): HrTimecardRow {
  return {
    date: "2026-08-01",
    timeIn: "9:00 AM",
    timeOut: "5:00 PM",
    gapFromPrevious: null,
    hoursLabel: "8:00",
    jobTitle: null,
    ...partial,
  };
}

describe("HR attendance roster", () => {
  it("keeps Sales Associate and Manager titles only", () => {
    expect(isHrSalesOrManagerTitle("Sales Associate")).toBe(true);
    expect(isHrSalesOrManagerTitle("Senior Sales Associate")).toBe(true);
    expect(isHrSalesOrManagerTitle("Manager")).toBe(true);
    expect(isHrSalesOrManagerTitle("Corporate Manager")).toBe(true);
    expect(isHrSalesOrManagerTitle("Jewelry Technician")).toBe(false);
    expect(isHrSalesOrManagerTitle("Security Guard")).toBe(false);
    expect(isHrSalesOrManagerTitle("")).toBe(false);
  });

  it("drops payroll 1 / Syed Muqeet Asim even if the title is sales", () => {
    expect(isExcludedHrAttendancePerson("1, Security Guard", "Syed Muqeet Asim")).toBe(true);
    expect(isExcludedHrAttendancePerson("Syed Muqeet Asim")).toBe(true);
    expect(
      keepHrAttendanceTimecardRow(
        row({ employeeName: "1, Security Guard", jobTitle: "Sales Associate", guardsName: "Syed Muqeet Asim" })
      )
    ).toBe(false);
    expect(
      keepHrAttendanceTimecardRow(
        row({ employeeName: "2, Security Guard", jobTitle: "Sales Associate", guardsName: "Muhammad Aleem" })
      )
    ).toBe(true);
  });

  it("parse drops non-sales titles from a mixed sheet", () => {
    const rows = parseTimecardCsv(
      "Payroll Name,Designation,In Date,Time In,Time Out,Guards Name\n" +
        '"2, Security Guard",Sales Associate,8/1/2026,9:09 AM,1:53 PM,Muhammad Aleem\n' +
        '"1, Security Guard",Security Guard,8/1/2026,9:22 AM,2:20 PM,Syed Muqeet Asim\n' +
        '"Martinez, Filemon",Jewelry Technician,8/1/2026,9:00 AM,5:00 PM,\n' +
        '"Altaf, Fahad",Manager,8/1/2026,9:18 AM,6:00 PM,\n'
    );
    expect(rows.map((r) => r.employeeName)).toEqual(["2, Security Guard", "Altaf, Fahad"]);
  });
});
