import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseTimecardCsv } from "@/lib/hr/parse-timecard";

describe("timecard contact columns", () => {
  it("keeps UserEmail for chat and Email for outbound mail", () => {
    const [row] = parseTimecardCsv(
      "Payroll Name,In Date,Time In,Time Out,User Email,Email\n" +
        '"Doe, Jane",8/4/2026,9:00 AM,5:00 PM,chat@example.com,mail@example.com\n'
    );

    expect(row).toMatchObject({
      userEmail: "chat@example.com",
      mail: "mail@example.com",
    });
  });

  it("accepts punctuation and spacing in contact headers", () => {
    const [row] = parseTimecardCsv(
      "Payroll Name,In Date,Time In,Time Out,User-Email,Employee Email\n" +
        '"Doe, Jane",8/4/2026,9:00 AM,5:00 PM,chat@example.com,mail@example.com\n'
    );

    expect(row).toMatchObject({
      userEmail: "chat@example.com",
      mail: "mail@example.com",
    });
  });

  it("keeps Irtaza UserEmail and Mail distinct on the August seed", () => {
    const text = fs.readFileSync(
      path.join(process.cwd(), "data/hr/Timecard-August-2026.csv"),
      "utf8"
    );
    expect(text).not.toMatch(/irtiza@/i);
    const rows = parseTimecardCsv(text).filter(
      (r) => (r.mail ?? "").toLowerCase() === "irtaza@valliani.app"
    );
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.every((r) => r.userEmail === "irtaza@arrakconsulting.com")).toBe(true);
    expect(rows.every((r) => r.mail === "irtaza@valliani.app")).toBe(true);
  });
});
