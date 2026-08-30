import { describe, expect, it } from "vitest";
import { mergePaymentCsvAppend } from "@/lib/reports/merge-payment-csv";

const HEADER =
  "Store,Transaction  #,Transaction Date,Type,Pay Code,Payment Amt,Applied Amt,SplitPercentage";

describe("mergePaymentCsvAppend", () => {
  it("replaces a full daily date and upserts stray older rows without duplicating", () => {
    const prev = `${HEADER}
VJ-EAST,VE-OLD,8/28/2026,Sales,VJE-CC,100,100,1
VJ-OAK,VO-116,5/23/2026,OL,VJO-CASH,100,100,1
`;
    const next = `${HEADER}
VJ-FRE,VF-NEW,8/29/2026,Sales,VJF-CC,25,25,1
VJ-LIV,VL-NEW,8/29/2026,Sales,VJL-CASH,10,10,1
VJ-LIV,VL-NEW,8/29/2026,Sales,VJL-IDDEAL,200,200,1
VJ-LIV,VL-NEW2,8/29/2026,Sales,VJL-CC,50,50,1
VJ-LIV,VL-NEW3,8/29/2026,Sales,VJL-CC,50,50,1
VJ-LIV,VL-NEW4,8/29/2026,Sales,VJL-CC,50,50,1
VJ-LIV,VL-NEW5,8/29/2026,Sales,VJL-CC,50,50,1
VJ-LIV,VL-NEW6,8/29/2026,Sales,VJL-CC,50,50,1
VJ-LIV,VL-NEW7,8/29/2026,Sales,VJL-CC,50,50,1
VJ-LIV,VL-NEW8,8/29/2026,Sales,VJL-CC,50,50,1
VJ-OAK,VO-116,5/23/2026,OL,VJO-CASH,100,100,1
VJ-SERRA,VS-70015953,6/24/2026,OL,VJS-CC,200,200,1
`;
    const merged = mergePaymentCsvAppend(prev, next);
    expect(merged.replacedDates).toEqual(["2026-08-29"]);
    expect(merged.skippedDuplicateRows).toBe(1);
    expect(merged.csvText).toContain("VE-OLD");
    expect(merged.csvText).toContain("VF-NEW");
    expect(merged.csvText).toContain("VS-70015953");
    expect(merged.csvText.match(/VO-116/g)?.length).toBe(1);
  });
});
