import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseScheduleCsv, parseScheduleXlsx } from "@/lib/hr/parse-schedule";
import { parseTimecardCsv } from "@/lib/hr/parse-timecard";
import { analyzeEmployeeDay } from "@/lib/hr/analyze";

describe("parseScheduleCsv", () => {
  it("does not treat title row as header", () => {
    const text = `Employee Schedules from 8/16/2026 to 8/30/2026,,,,,
Employee,Sun 08/16,Mon 08/17
"1, security guard",09:15 AM - 08:30 PM,09:15 AM - 08:30 PM`;
    const { entries } = parseScheduleCsv(text);
    expect(entries).toHaveLength(2);
  });

  it("parses long-format Date / Employee Name / Time In / Time Out", () => {
    const text = `Date,Employee Name,Time In,Time Out
8/1/2026,1 security guard,9:15 AM,9:00 PM
8/1/2026,Adnan Sayed,11:00 AM,8:00 PM`;
    const { entries, dateFrom, dateTo } = parseScheduleCsv(text);
    expect(dateFrom).toBe("2026-08-01");
    expect(dateTo).toBe("2026-08-01");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      employeeName: "1 security guard",
      date: "2026-08-01",
      start: "9:15 AM",
      end: "9:00 PM",
    });
  });
});

const aug4Schedule = path.join(
  "c:",
  "Users",
  "ACCTON-PC-KM-MR-60",
  "Downloads",
  "ADP_Workforce_Schedule_2026-08-04.xlsx"
);
const aug4Timecard = path.join(
  "c:",
  "Users",
  "ACCTON-PC-KM-MR-60",
  "Downloads",
  "timecard-4aug.csv"
);

describe("Aug 4 ADP files", () => {
  it("parses schedule xlsx and timecard csv when present", () => {
    if (!fs.existsSync(aug4Schedule) || !fs.existsSync(aug4Timecard)) return;

    const sched = parseScheduleXlsx(fs.readFileSync(aug4Schedule));
    expect(sched.dateFrom).toBe("2026-08-04");
    expect(sched.entries.length).toBeGreaterThan(10);

    const rows = parseTimecardCsv(fs.readFileSync(aug4Timecard, "utf8"));
    expect(rows.length).toBeGreaterThan(50);
    expect(rows[0]!.date).toBe("2026-08-04");

    const punches = rows.filter((r) => /1, security guard/i.test(r.employeeName));
    const day = analyzeEmployeeDay(
      "1, security guard",
      "2026-08-04",
      punches,
      sched.entries
    );
    expect(day.schedule?.start).toMatch(/09:15 AM/);
    expect(day.totalWorkLabel).toBe("9:44");
    expect(day.totalMealLabel).toBe("1:03");
  });
});
