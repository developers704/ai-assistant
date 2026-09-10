import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { listHrUploads, saveTimecardUpload } from "@/lib/hr/store";
import { parseTimecardCsv } from "@/lib/hr/parse-timecard";
import { parseScheduleCsv } from "@/lib/hr/parse-schedule";
import { analyzeDay, analyzeDays } from "@/lib/hr/analyze";
import { namesMatch } from "@/lib/hr/name-match";
import { listAbsenceWaivers, listWarningNotices, resetHrNoticeStore } from "@/lib/hr/warning-store";

const DATA_DIR = path.join(process.cwd(), ".data", "hr");
const TIME_DIR = path.join(DATA_DIR, "timecards");
const SCHED_DIR = path.join(DATA_DIR, "schedules");

describe("HR upload replace", () => {
  it("deletes orphan month/week files that are not the active upload", () => {
    listHrUploads();
    fs.mkdirSync(TIME_DIR, { recursive: true });
    fs.mkdirSync(SCHED_DIR, { recursive: true });
    const keepTc = listHrUploads().timecards[0]?.id;
    const keepSc = listHrUploads().schedules[0]?.id;
    expect(keepTc).toBeTruthy();
    expect(keepSc).toBeTruthy();
    fs.writeFileSync(path.join(TIME_DIR, "999_orphan_week.csv"), "x");
    fs.writeFileSync(path.join(TIME_DIR, "999_orphan_week.json"), "[]");
    fs.writeFileSync(path.join(SCHED_DIR, "888_orphan_week.csv"), "x");
    fs.writeFileSync(path.join(SCHED_DIR, "888_orphan_week.json"), "[]");
    listHrUploads();
    const tcNames = fs.readdirSync(TIME_DIR);
    const scNames = fs.readdirSync(SCHED_DIR);
    expect(tcNames.some((n) => n.includes("999_orphan_week"))).toBe(false);
    expect(scNames.some((n) => n.includes("888_orphan_week"))).toBe(false);
    expect(tcNames.some((n) => n.startsWith(`${keepTc}.`))).toBe(true);
    expect(scNames.some((n) => n.startsWith(`${keepSc}.`))).toBe(true);
  });

  it("keeps a single timecard after a second upload (no stacked August files)", () => {
    const tiny = `Payroll Name,Code,Designation,Store,Manager,In Date,Time In,Time Out,Actual Gap From Previous Out,Timecard Hours (as Time)
"Replace, Test",RT,Sales Associate,Admin,Shaun,8/15/2026,9:00 AM,5:00 PM,,8:00
`;
    const seed = fs.readFileSync(
      path.join(process.cwd(), "data/hr/Timecard-August-2026.csv"),
      "utf8"
    );
    try {
      saveTimecardUpload("week-replace.csv", tiny);
      const index = listHrUploads();
      expect(index.timecards).toHaveLength(1);
      expect(index.timecards[0]?.fileName).toBe("week-replace.csv");
      const ids = [
        ...new Set(
          fs.readdirSync(TIME_DIR).map((n) => n.replace(/\.(csv|json|xlsx|xls|dat)$/i, ""))
        ),
      ];
      expect(ids).toEqual([index.timecards[0]!.id]);
    } finally {
      saveTimecardUpload("Timecard-August-2026.csv", seed, { asSeed: true });
    }
  });
});

describe("HR notice reset", () => {
  it("clears warnings, write-ups, and absence waivers", () => {
    const prev = fs.existsSync(path.join(DATA_DIR, "warnings.json"))
      ? fs.readFileSync(path.join(DATA_DIR, "warnings.json"), "utf8")
      : "";
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(DATA_DIR, "warnings.json"),
        JSON.stringify({
          notices: [
            {
              caseId: "HR-LATE-ZZ-2026-08-01",
              kind: "warning",
              employeeName: "Test, Reset",
              employeeCode: "ZZ",
              date: "2026-08-01",
              remarks: [],
            },
          ],
          absenceWaivers: [
            { employeeName: "Test, Reset", employeeCode: "ZZ", date: "2026-08-01" },
          ],
        }),
        "utf8"
      );
      expect(listWarningNotices().length).toBeGreaterThan(0);
      expect(listAbsenceWaivers().length).toBeGreaterThan(0);
      resetHrNoticeStore();
      expect(listWarningNotices()).toEqual([]);
      expect(listAbsenceWaivers()).toEqual([]);
    } finally {
      if (prev) fs.writeFileSync(path.join(DATA_DIR, "warnings.json"), prev, "utf8");
      else resetHrNoticeStore();
    }
  });
});

describe("analyzeDays matches per-day analyze", () => {
  it("does not change August 1 employee results", () => {
    const timecard = fs.readFileSync(
      path.join(process.cwd(), "data/hr/Timecard-August-2026.csv"),
      "utf8"
    );
    const schedule = fs.readFileSync(
      path.join(process.cwd(), "data/hr/Schedule-August-2026.csv"),
      "utf8"
    );
    const rows = parseTimecardCsv(timecard);
    const { entries } = parseScheduleCsv(schedule);
    const a = analyzeDay("2026-08-01", rows, entries);
    const b = analyzeDays(["2026-08-01"], rows, entries);
    expect(b.map((e) => e.employeeName)).toEqual(a.map((e) => e.employeeName));
    expect(b.map((e) => e.totalWorkLabel)).toEqual(a.map((e) => e.totalWorkLabel));
    expect(
      entries
        .filter((e) => e.date === "2026-08-01")
        .every((entry) => a.some((emp) => namesMatch(emp.employeeName, entry.employeeName)))
    ).toBe(true);
  });
});
