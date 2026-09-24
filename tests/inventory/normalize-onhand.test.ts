import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { collapseEmptyOnhandColumns } from "@/lib/inventory/normalize-onhand-csv";

describe("collapseEmptyOnhandColumns", () => {
  it("keeps every row when a CRLF prefix is followed by LF rows", () => {
    const mixed =
      "Department,,Item  #,Store,On-hand\r\nGOLD,,111,MAIN,1\r\nCHAIN,,222,VJ-FRE,2\nRING,,333,VJ-ONT,3\n";
    const out = collapseEmptyOnhandColumns(mixed);
    const parsed = Papa.parse<Record<string, string>>(out, { header: true });
    expect(parsed.data.map((r) => r["Item  #"])).toEqual(["111", "222", "333"]);
    expect(parsed.data.map((r) => r.Store)).toEqual(["MAIN", "VJ-FRE", "VJ-ONT"]);
    expect(parsed.meta.fields).not.toContain("");
  });

  it("refuses a parse that swallows most of a large file", () => {
    const body = Array.from({ length: 1200 }, (_, i) => `GOLD,${i}`).join("\n");
    const csv = `Department,Item  #\nGOLD,"unterminated\n${body}`;
    expect(() => collapseEmptyOnhandColumns(csv)).toThrow(/partial snapshot/);
  });
});
