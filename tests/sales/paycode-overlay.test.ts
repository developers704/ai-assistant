import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { VendorPosRow } from "@/lib/reports/types";
import {
  applyPaycodeFilter,
  applySalespersonFilter,
  listPaycodes,
  parsePaymentAppliedByTxn,
  paycodeTotalsForRows,
} from "@/lib/sales/paycode-overlay";

function row(partial: Partial<VendorPosRow> & Pick<VendorPosRow, "transactionId" | "netRevenue">): VendorPosRow {
  return {
    date: "2026-08-16",
    storeName: "VJ-EAST",
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    itemNumber: "197399",
    sku: "197399",
    style: "",
    description: "Chain",
    vendor: "KGS",
    vendorModel: "KKP5494-1",
    productClass: "14KT",
    subClass: "18",
    quantity: 1,
    inventoryCost: 100,
    wholesaleCost: 100,
    grossSales: partial.netRevenue,
    discountAmount: 0,
    margin: 0,
    discountRate: 0,
    imageDir: "",
    ...partial,
  };
}

const PAYMENT_CSV = `Store,Customer  #,Customer Name,Transaction  #,Transaction Date,Type,Pymt Create Date,Pymt Posted Date,Pay Method,Pay Code,Check Card # GC #,Card Holder,Payment Amt,Applied Amt,,SplitPercentage
VJ-EAST,VE1,JESSICA,VE-10293897,8/16/2026,"Sales,",8/16/2026,8/16/2026,CA,VJE-CASH,,,0.01,0.01,,1
VJ-EAST,VE1,JESSICA,VE-10293897,8/16/2026,"Sales,",8/16/2026,8/16/2026,CC,VJE-CC,,,250.00,250.00,,1
VJ-EAST,VE1,JESSICA,VE-10293897,8/16/2026,"Sales,",8/16/2026,8/16/2026,OTH,VJE-IDDEAL,,,"3,000.00","3,000.00",,1
VJ-PB,PB1,ELYSSA,PB-10291574,8/8/2026,"Sales,",8/8/2026,8/8/2026,CC,VJPB-CC,,,200.00,200.00,,1
VJ-PB,PB1,ELYSSA,PB-10291574,8/8/2026,"Sales,",8/8/2026,8/8/2026,CA,VJPB-CASH,,,210.00,210.00,,1
VJ-FRE,X,JUNK,VF-JUNK,8/1/2026,,8/1/2026,8/1/2026,CC,VJF-CC,,,"6,000,000.00","6,000,000.00",,1
VJ-FRE,X,RET,VF-RET,8/1/2026,"Returns,",8/1/2026,8/1/2026,CC,VJF-CC,,,50.00,50.00,,1
VJ-CST,ST1,IDEA,ST-IDEA1,8/21/2026,"Sales,",8/21/2026,8/21/2026,OTH,DBCST-IDEA,,,1000.00,1000.00,,1
VJ-SL,SA1,IDEAL,SA-IDEAL1,8/16/2026,"Sales,",8/16/2026,8/16/2026,OTH,VJSL-IDEAL,,,2750.00,2750.00,,1
VJ-RE,RE1,SYNY,RE-SYNY1,8/10/2026,"Sales,",8/10/2026,8/10/2026,OTH,VJRE-SYNY,,,111.00,111.00,,1
VJ-BB,BB1,SYNC,BB-SYNC1,8/10/2026,"Sales,",8/10/2026,8/10/2026,OTH,BB-SYNC,,,24.00,24.00,,1
VJ-FRE,F1,PROG,VF-PROG1,8/5/2026,"Sales,",8/5/2026,8/5/2026,OTH,VJF-PROGRE,,,10.00,10.00,,1
VJ-HD,H1,PROG,HD-PROG1,8/5/2026,"Sales,",8/5/2026,8/5/2026,OTH,HD-PROGR,,,5.00,5.00,,1
VJ-BB,BB2,CC,BB-CC1,8/5/2026,"Sales,",8/5/2026,8/5/2026,CC,BB - CC,,,80.00,80.00,,1
`;

describe("parsePaymentAppliedByTxn", () => {
  it("sums Applied Amt by pay code and skips blank Type / returns", () => {
    const map = parsePaymentAppliedByTxn(PAYMENT_CSV);
    expect(map.has("VF-JUNK")).toBe(false);
    expect(map.has("VF-RET")).toBe(false);
    const ve = map.get("VE-10293897")!;
    expect(ve.get("CASH")).toBeCloseTo(0.01, 5);
    expect(ve.get("CC")).toBeCloseTo(250, 5);
    expect(ve.get("IDDEAL")).toBeCloseTo(3000, 5);
    const pb = map.get("PB-10291574")!;
    expect(pb.get("CC")).toBeCloseTo(200, 5);
    expect(pb.get("CASH")).toBeCloseTo(210, 5);
    expect(map.get("ST-IDEA1")!.get("IDDEAL")).toBeCloseTo(1000, 5);
    expect(map.get("SA-IDEAL1")!.get("IDDEAL")).toBeCloseTo(2750, 5);
    expect(map.get("RE-SYNY1")!.get("SYNC")).toBeCloseTo(111, 5);
    expect(map.get("BB-SYNC1")!.get("SYNC")).toBeCloseTo(24, 5);
    expect(map.get("VF-PROG1")!.get("PROG")).toBeCloseTo(10, 5);
    expect(map.get("HD-PROG1")!.get("PROG")).toBeCloseTo(5, 5);
    expect(map.get("BB-CC1")!.get("CC")).toBeCloseTo(80, 5);
    expect(listPaycodes(map)).toEqual(["CASH", "CC", "IDDEAL", "SYNC", "PROG"]);
    expect(listPaycodes(map).some((c) => /^(VJF|VIS|VJPB|VJS)$/i.test(c))).toBe(false);
  });
});

describe("applyPaycodeFilter", () => {
  const overlay = parsePaymentAppliedByTxn(PAYMENT_CSV);

  it("does not change rows when no paycode is selected (Net Sales stays CSV Total)", () => {
    const rows = [
      row({ transactionId: "VE-10293897", netRevenue: 2174.55 }),
      row({ transactionId: "VE-10293897", netRevenue: 300, itemNumber: "ITEM", sku: "ITEM" }),
    ];
    expect(applyPaycodeFilter(rows, [], overlay)).toEqual(rows);
  });

  it("allocates selected Applied Amt across lines by |Total| weight", () => {
    const rows = [
      row({ transactionId: "VE-10293897", netRevenue: 2174.55, quantity: 1 }),
      row({
        transactionId: "VE-10293897",
        netRevenue: 780,
        quantity: 1,
        itemNumber: "ITEM",
        sku: "ITEM",
        description: "solder",
      }),
    ];
    const total = 2174.55 + 780;
    const filtered = applyPaycodeFilter(rows, ["IDDEAL"], overlay);
    const net = filtered.reduce((s, r) => s + r.netRevenue, 0);
    expect(net).toBeCloseTo(3000, 2);
    expect(filtered).toHaveLength(2);
    const chain = filtered.find((r) => r.sku === "197399")!;
    expect(chain.netRevenue).toBeCloseTo((2174.55 / total) * 3000, 2);
    // Qty is not scaled for paycode — money only
    expect(chain.quantity).toBe(1);
  });

  it("splits a two-paycode ticket independently (PB CASH vs CC)", () => {
    const rows = [row({ transactionId: "PB-10291574", netRevenue: 410, storeName: "VJ-PB" })];
    const cash = applyPaycodeFilter(rows, ["CASH"], overlay);
    const cc = applyPaycodeFilter(rows, ["CC"], overlay);
    expect(cash[0]!.netRevenue).toBeCloseTo(210, 5);
    expect(cc[0]!.netRevenue).toBeCloseTo(200, 5);
    expect(cash[0]!.quantity).toBe(1);
  });

  it("keeps CSV Total when overlay is missing but Pay Codes cell lists the code", () => {
    const rows = [
      row({
        transactionId: "VE-NO-OVERLAY",
        netRevenue: 500,
        payCode: "VJE-CASH,VJE-CC,",
      }),
    ];
    const filtered = applyPaycodeFilter(rows, ["CASH"], overlay);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.netRevenue).toBe(500);
  });

  it("drops txns that have overlay but not the selected paycode", () => {
    const rows = [row({ transactionId: "PB-10291574", netRevenue: 410 })];
    expect(applyPaycodeFilter(rows, ["IDDEAL"], overlay)).toHaveLength(0);
  });

  it("selecting IDDEAL includes IDEA and IDEAL Applied Amt", () => {
    const rows = [
      row({ transactionId: "ST-IDEA1", netRevenue: 1000 }),
      row({ transactionId: "SA-IDEAL1", netRevenue: 2750 }),
      row({ transactionId: "VE-10293897", netRevenue: 2474.55 }),
    ];
    const viaCanon = applyPaycodeFilter(rows, ["IDDEAL"], overlay);
    const viaRaw = applyPaycodeFilter(rows, ["VJE-IDDEAL"], overlay);
    const net = (xs: typeof viaCanon) => xs.reduce((s, r) => s + r.netRevenue, 0);
    expect(net(viaCanon)).toBeCloseTo(1000 + 2750 + 3000, 2);
    expect(net(viaRaw)).toBeCloseTo(net(viaCanon), 2);
  });
});

describe("paycodeTotalsForRows", () => {
  it("SUMIFS Applied Amt for txns present in the sales slice", () => {
    const overlay = parsePaymentAppliedByTxn(PAYMENT_CSV);
    const rows = [
      row({ transactionId: "VE-10293897", netRevenue: 100 }),
      row({ transactionId: "PB-10291574", netRevenue: 410 }),
    ];
    const totals = paycodeTotalsForRows(rows, overlay);
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["IDDEAL"]).toBeCloseTo(3000, 5);
    expect(byName["CC"]).toBeCloseTo(250 + 200, 5);
    expect(byName["CASH"]).toBeCloseTo(0.01 + 210, 5);
    expect(byName["VJE-IDDEAL"]).toBeUndefined();
    expect(byName["VJPB-CASH"]).toBeUndefined();
    const rankingSum = totals.reduce((s, t) => s + t.revenue, 0);
    expect(rankingSum).toBeCloseTo(3000 + 250 + 0.01 + 210 + 200, 5);
  });
});

describe("applySalespersonFilter", () => {
  it("scales money and qty by split % and accepts Name (CODE)", () => {
    const rows = [
      row({
        transactionId: "T1",
        netRevenue: 100,
        quantity: 2,
        salespersons: "SN/65% - SP/35% -",
      }),
    ];
    const sn = applySalespersonFilter(rows, ["Shakib Nakhwa (Ali) (SN)"]);
    expect(sn).toHaveLength(1);
    expect(sn[0]!.netRevenue).toBeCloseTo(65, 5);
    expect(sn[0]!.quantity).toBeCloseTo(1.3, 5);
    expect(sn[0]!.salespersons).toBe("SN/100%");
  });
});

describe("bundled Payment-Transactions.csv", () => {
  it("parses VE-10293897 CASH+CC+IDDEAL Applied Amt from the live overlay file", () => {
    const file = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
    expect(fs.existsSync(file)).toBe(true);
    const map = parsePaymentAppliedByTxn(fs.readFileSync(file, "utf8"));
    const ve = map.get("VE-10293897");
    expect(ve).toBeDefined();
    expect(ve!.get("CASH")).toBeCloseTo(0.01, 5);
    expect(ve!.get("CC")).toBeCloseTo(250, 5);
    expect(ve!.get("IDDEAL")).toBeCloseTo(3000, 5);
    const pb = map.get("PB-10291574");
    expect(pb!.get("CASH")).toBeCloseTo(210, 5);
    expect(pb!.get("CC")).toBeCloseTo(200, 5);
    const vl = map.get("VL-10291239");
    expect(vl).toBeDefined();
    expect(vl!.get("CASH")).toBeCloseTo(0.01, 5);
    expect(vl!.get("IDDEAL")).toBeCloseTo(2200, 5);
    const ve30 = map.get("VE-10294039");
    expect(ve30).toBeDefined();
    expect(ve30!.get("IDDEAL")).toBeCloseTo(2600, 5);
    const vl30 = map.get("VL-10291249");
    expect(vl30).toBeDefined();
    expect(vl30!.get("IDDEAL")).toBeCloseTo(1873.15, 5);
    const codes = listPaycodes(map);
    expect(codes).toContain("CASH");
    expect(codes).toContain("IDDEAL");
    expect(codes).toContain("SYNC");
    expect(codes).toContain("PROG");
    expect(codes).not.toContain("VJF");
    expect(codes).not.toContain("VIS");
    expect(codes).not.toContain("VJPB");
    expect(codes).not.toContain("VJS");
    expect(codes).not.toContain("IDEA");
    expect(codes).not.toContain("SYNY");
    const ideaTxn = map.get("ST-10292535");
    expect(ideaTxn?.get("IDDEAL")).toBeCloseTo(1000, 5);
  });
});
