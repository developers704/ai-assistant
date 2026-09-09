import { describe, expect, it } from "vitest";
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
});
