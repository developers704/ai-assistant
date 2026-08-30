import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { VendorPosRow } from "@/lib/reports/types";
import {
  applyPaycodeFilter,
  applySalespersonFilter,
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
`;

describe("parsePaymentAppliedByTxn", () => {
  it("sums Applied Amt by pay code and skips blank Type / returns", () => {
    const map = parsePaymentAppliedByTxn(PAYMENT_CSV);
    expect(map.has("VF-JUNK")).toBe(false);
    expect(map.has("VF-RET")).toBe(false);
    const ve = map.get("VE-10293897")!;
    expect(ve.get("VJE-CASH")).toBeCloseTo(0.01, 5);
    expect(ve.get("VJE-CC")).toBeCloseTo(250, 5);
    expect(ve.get("VJE-IDDEAL")).toBeCloseTo(3000, 5);
    const pb = map.get("PB-10291574")!;
    expect(pb.get("VJPB-CC")).toBeCloseTo(200, 5);
    expect(pb.get("VJPB-CASH")).toBeCloseTo(210, 5);
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
    const filtered = applyPaycodeFilter(rows, ["VJE-IDDEAL"], overlay);
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
    const cash = applyPaycodeFilter(rows, ["VJPB-CASH"], overlay);
    const cc = applyPaycodeFilter(rows, ["VJPB-CC"], overlay);
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
    const filtered = applyPaycodeFilter(rows, ["VJE-CASH"], overlay);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.netRevenue).toBe(500);
  });

  it("drops txns that have overlay but not the selected paycode", () => {
    const rows = [row({ transactionId: "PB-10291574", netRevenue: 410 })];
    expect(applyPaycodeFilter(rows, ["VJE-IDDEAL"], overlay)).toHaveLength(0);
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
    expect(byName["VJE-IDDEAL"]).toBeCloseTo(3000, 5);
    expect(byName["VJE-CC"]).toBeCloseTo(250, 5);
    expect(byName["VJPB-CASH"]).toBeCloseTo(210, 5);
    expect(byName["VJPB-CC"]).toBeCloseTo(200, 5);
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
    expect(ve!.get("VJE-CASH")).toBeCloseTo(0.01, 5);
    expect(ve!.get("VJE-CC")).toBeCloseTo(250, 5);
    expect(ve!.get("VJE-IDDEAL")).toBeCloseTo(3000, 5);
    const pb = map.get("PB-10291574");
    expect(pb!.get("VJPB-CASH")).toBeCloseTo(210, 5);
    expect(pb!.get("VJPB-CC")).toBeCloseTo(200, 5);
  });
});
