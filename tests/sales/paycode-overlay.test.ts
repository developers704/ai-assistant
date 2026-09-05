import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { VendorPosRow } from "@/lib/reports/types";
import {
  applyPaycodeFilter,
  applySalespersonFilter,
  listPaycodes,
  parsePaycodeLegs,
  parsePaymentAppliedByTxn,
  paycodeTotalsForPaymentWindow,
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
VJ-SO,S1,ACIM,SO-ACIM1,8/21/2026,"Sales,",8/21/2026,8/21/2026,OTH,DBCST-ACIM,,,100.00,100.00,,1
VJ-SO,S2,ACIMA,SO-ACIMA1,8/21/2026,"Sales,",8/21/2026,8/21/2026,OTH,VJSO-ACIMA,,,200.00,200.00,,1
VJ-ST,A1,AFFR,ST-AFFR1,8/23/2026,"Sales,",8/23/2026,8/23/2026,OTH,DBCST-AFFR,,,300.00,300.00,,1
VJ-ST,A2,AFRIM,ST-AFRIM1,8/3/2026,"Sales,",8/3/2026,8/3/2026,OTH,VJST-AFRIM,,,400.00,400.00,,1
VJ-SL,A3,AFFIRM,SL-AFFIRM1,8/9/2026,"Sales,",8/9/2026,8/9/2026,OTH,DES-AFFIRM,,,500.00,500.00,,1
VJ-PB,W1,WELL,PB-WELL1,8/1/2026,"Sales,",8/1/2026,8/1/2026,OTH,VJPB-WELL,,,50.00,50.00,,1
VJ-ST,W2,WELS,ST-WELS1,8/19/2026,"Sales,",8/19/2026,8/19/2026,OTH,DBCST-WELS,,,60.00,60.00,,1
VJ-ST,W3,WF,AT-WF1,8/8/2026,"Sales,",8/8/2026,8/8/2026,OTH,VJST-WELLS FARGO,,,70.00,70.00,,1
VJ-OAK,W4,WELLS,VO-WELLS1,8/15/2026,"Sales,",8/15/2026,8/15/2026,OTH,VJO-WELLS,,,80.00,80.00,,1
VJ-EAST,X,CRONLY,VE-CRONLY,8/16/2026,"CR,",8/16/2026,8/16/2026,CA,VJE-CASH,,,50.00,50.00,,1
VJ-EAST,X,RETCHK,VE-RETCHK,8/16/2026,"Returns,",8/16/2026,8/16/2026,CK,VJE-CHK,,,100.00,100.00,,1
VJ-BB,X,SYNCHRO,BB-SYN1,8/10/2026,"Sales,",8/10/2026,8/10/2026,OTH,BB-SYNCHRO,,,9.00,9.00,,1
VJ-PB,X,WE,PB-WE1,8/1/2026,"Sales,",8/1/2026,8/1/2026,OTH,VJPB-WE,,,8.00,8.00,,1
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
    expect(map.get("SO-ACIM1")!.get("ACIMA")).toBeCloseTo(100, 5);
    expect(map.get("SO-ACIMA1")!.get("ACIMA")).toBeCloseTo(200, 5);
    expect(map.get("ST-AFFR1")!.get("AFFIRM")).toBeCloseTo(300, 5);
    expect(map.get("ST-AFRIM1")!.get("AFFIRM")).toBeCloseTo(400, 5);
    expect(map.get("SL-AFFIRM1")!.get("AFFIRM")).toBeCloseTo(500, 5);
    expect(map.get("PB-WELL1")!.get("WELLS")).toBeCloseTo(50, 5);
    expect(map.get("ST-WELS1")!.get("WELLS")).toBeCloseTo(60, 5);
    expect(map.get("AT-WF1")!.get("WELLS")).toBeCloseTo(70, 5);
    expect(map.get("VO-WELLS1")!.get("WELLS")).toBeCloseTo(80, 5);
    expect(map.get("VE-CRONLY")!.get("CASH")).toBeCloseTo(50, 5);
    expect(map.get("BB-SYN1")!.get("SYNC")).toBeCloseTo(9, 5);
    expect(map.get("PB-WE1")!.get("WELLS")).toBeCloseTo(8, 5);
    expect(listPaycodes(map)).toEqual([
      "CASH",
      "CC",
      "IDDEAL",
      "SYNC",
      "PROG",
      "ACIMA",
      "AFFIRM",
      "WELLS",
    ]);
    expect(listPaycodes(map).some((c) => /^(VJF|VIS|VJPB|VJS)$/i.test(c))).toBe(false);
    expect(listPaycodes(map)).not.toContain("ACIM");
    expect(listPaycodes(map)).not.toContain("AFFR");
    expect(listPaycodes(map)).not.toContain("AFRIM");
    expect(listPaycodes(map)).not.toContain("WELL");
    expect(listPaycodes(map)).not.toContain("WELS");
    expect(listPaycodes(map)).not.toContain("WELLS FARGO");
    expect(listPaycodes(map)).not.toContain("SYNCHRO");
    expect(listPaycodes(map)).not.toContain("WE");
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

  it("selecting ACIMA includes ACIM Applied Amt", () => {
    const rows = [
      row({ transactionId: "SO-ACIM1", netRevenue: 100 }),
      row({ transactionId: "SO-ACIMA1", netRevenue: 200 }),
    ];
    const filtered = applyPaycodeFilter(rows, ["ACIMA"], overlay);
    const net = filtered.reduce((s, r) => s + r.netRevenue, 0);
    expect(net).toBeCloseTo(300, 2);
    expect(applyPaycodeFilter(rows, ["ACIM"], overlay).reduce((s, r) => s + r.netRevenue, 0)).toBeCloseTo(
      300,
      2
    );
  });

  it("selecting AFFIRM includes AFFR and AFRIM Applied Amt", () => {
    const rows = [
      row({ transactionId: "ST-AFFR1", netRevenue: 300 }),
      row({ transactionId: "ST-AFRIM1", netRevenue: 400 }),
      row({ transactionId: "SL-AFFIRM1", netRevenue: 500 }),
    ];
    expect(
      applyPaycodeFilter(rows, ["AFFIRM"], overlay).reduce((s, r) => s + r.netRevenue, 0)
    ).toBeCloseTo(1200, 2);
  });

  it("selecting WELLS includes WELL, WELS, and WELLS FARGO Applied Amt", () => {
    const rows = [
      row({ transactionId: "PB-WELL1", netRevenue: 50 }),
      row({ transactionId: "ST-WELS1", netRevenue: 60 }),
      row({ transactionId: "AT-WF1", netRevenue: 70 }),
      row({ transactionId: "VO-WELLS1", netRevenue: 80 }),
    ];
    expect(
      applyPaycodeFilter(rows, ["WELLS"], overlay).reduce((s, r) => s + r.netRevenue, 0)
    ).toBeCloseTo(260, 2);
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

describe("paycodeTotalsForPaymentWindow", () => {
  const legs = parsePaycodeLegs(PAYMENT_CSV);

  it("keeps Returns on legs but not on the txn overlay", () => {
    expect(legs.some((l) => l.txnId === "VF-RET")).toBe(true);
    expect(legs.some((l) => l.txnId === "VE-RETCHK" && l.code === "CHK")).toBe(true);
    expect(parsePaymentAppliedByTxn(PAYMENT_CSV).has("VF-RET")).toBe(false);
    expect(parsePaymentAppliedByTxn(PAYMENT_CSV).has("VE-RETCHK")).toBe(false);
  });

  it("sums Applied Amt by payment Transaction Date including CR and Returns", () => {
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-08-16",
      to: "2026-08-16",
      legs,
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["CASH"]).toBeCloseTo(50.01, 5);
    expect(byName["CHK"]).toBeCloseTo(100, 5);
    expect(byName["IDDEAL"]).toBeCloseTo(3000 + 2750, 5);
    expect(byName["CC"]).toBeCloseTo(250, 5);
  });

  it("omits Returns when includeReturns is false", () => {
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-08-16",
      to: "2026-08-16",
      includeReturns: false,
      legs,
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["CHK"]).toBeUndefined();
    expect(byName["CASH"]).toBeCloseTo(50.01, 5);
  });

  it("filters by payment Store", () => {
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-08-16",
      to: "2026-08-16",
      stores: ["VJ-EAST"],
      legs,
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["IDDEAL"]).toBeCloseTo(3000, 5);
    expect(byName["CASH"]).toBeCloseTo(50.01, 5);
    expect(byName["CHK"]).toBeCloseTo(100, 5);
  });

  it("folds SYNCHRO into SYNC and WE into WELLS", () => {
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-08-01",
      to: "2026-08-10",
      legs,
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["WELLS"]).toBeCloseTo(50 + 8 + 70, 5);
    expect(byName["SYNC"]).toBeCloseTo(111 + 24 + 9, 5);
  });
});

describe("applyPaycodeFilter with payment-date window", () => {
  const legs = parsePaycodeLegs(PAYMENT_CSV);

  it("Net Sales matches payment CSV including CR-only and Returns", () => {
    const sales = [
      row({ transactionId: "VE-10293897", netRevenue: 2474.55 }),
      row({ transactionId: "SA-IDEAL1", netRevenue: 2750 }),
    ];
    const filtered = applyPaycodeFilter(sales, ["CASH"], undefined, {
      from: "2026-08-16",
      to: "2026-08-16",
      legs,
    });
    const net = filtered.reduce((s, r) => s + r.netRevenue, 0);
    expect(net).toBeCloseTo(50.01, 5);
    expect(filtered.some((r) => r.transactionId === "VE-CRONLY")).toBe(true);
    const chk = applyPaycodeFilter(sales, ["CHK"], undefined, {
      from: "2026-08-16",
      to: "2026-08-16",
      legs,
    });
    expect(chk.reduce((s, r) => s + r.netRevenue, 0)).toBeCloseTo(100, 5);
  });

  it("selecting ACIMA matches the payment-window total", () => {
    const sales = [
      row({ transactionId: "SO-ACIM1", netRevenue: 100 }),
      row({ transactionId: "SO-ACIMA1", netRevenue: 200 }),
    ];
    const window = { from: "2026-08-21", to: "2026-08-21", legs };
    const filtered = applyPaycodeFilter(sales, ["ACIMA"], undefined, window);
    const card = paycodeTotalsForPaymentWindow({
      from: "2026-08-21",
      to: "2026-08-21",
      methods: ["ACIMA"],
      legs,
    });
    expect(filtered.reduce((s, r) => s + r.netRevenue, 0)).toBeCloseTo(300, 2);
    expect(card[0]?.revenue).toBeCloseTo(300, 2);
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

  it("combines SN+SP on a 65/35 line to the full $100", () => {
    const rows = [
      row({
        transactionId: "T1",
        netRevenue: 100,
        quantity: 1,
        salespersons: "SN/65% - SP/35% -",
      }),
    ];
    const both = applySalespersonFilter(rows, ["SN", "SP"]);
    expect(both).toHaveLength(1);
    expect(both[0]!.netRevenue).toBeCloseTo(100, 5);
    expect(both[0]!.quantity).toBeCloseTo(1, 5);
  });

  it("keeps 80% of a 40/20/40 line when two associates are selected", () => {
    const rows = [
      row({
        transactionId: "T2",
        netRevenue: 100,
        quantity: 1,
        margin: 60,
        salespersons: "RJ1/40% - SD/20% - AG1/40% -",
      }),
    ];
    const two = applySalespersonFilter(rows, ["RJ1", "AG1"]);
    expect(two).toHaveLength(1);
    expect(two[0]!.netRevenue).toBeCloseTo(80, 5);
    expect(two[0]!.margin).toBeCloseTo(48, 5);
    expect(two[0]!.salespersons).toBe("RJ1/50% - AG1/50%");
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
    expect(codes).toContain("ACIMA");
    expect(codes).toContain("AFFIRM");
    expect(codes).toContain("WELLS");
    expect(codes).not.toContain("ACIM");
    expect(codes).not.toContain("AFFR");
    expect(codes).not.toContain("AFRIM");
    expect(codes).not.toContain("WELL");
    expect(codes).not.toContain("WELS");
    expect(codes).not.toContain("WELLS FARGO");
    const ideaTxn = map.get("ST-10292535");
    expect(ideaTxn?.get("IDDEAL")).toBeCloseTo(1000, 5);
    expect(map.get("ST-10292563")?.get("ACIMA")).toBeCloseTo(1099, 5);
    expect(map.get("ST-10292549")?.get("AFFIRM")).toBeCloseTo(8952, 5);
    expect(map.get("AT-10290508")?.get("WELLS")).toBeCloseTo(11500, 5);
    expect(map.get("PB-10291547")?.get("WELLS")).toBeCloseTo(3678.3, 5);
    const filterLabels = listPaycodes();
    expect(filterLabels).toContain("ACIMA");
    expect(filterLabels).toContain("AFFIRM");
    expect(filterLabels).toContain("WELLS");
    expect(filterLabels).toContain("IDDEAL");
    expect(filterLabels).toContain("PROG");
    expect(filterLabels).toContain("SYNC");
    expect(filterLabels).toContain("CHK");
    expect(filterLabels).not.toContain("CHECK");
    expect(filterLabels).not.toContain("GE");
    expect(filterLabels).not.toContain("ACIM");
    expect(filterLabels).not.toContain("IDEA");
    expect(filterLabels).not.toContain("SYNY");
    expect(filterLabels).not.toContain("WELL");
  });

  it("Paycodes card Aug 1-30 sums payment-date Applied Amt including returns", () => {
    const file = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-08-01",
      to: "2026-08-30",
      legs: parsePaycodeLegs(fs.readFileSync(file, "utf8")),
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["WELLS"]).toBeCloseTo(355604.49, 2);
    expect(byName["CHK"]).toBeCloseTo(4232.14, 2);
    expect(byName["CASH"]).toBeCloseTo(418558.22, 2);
    expect(byName["ACIMA"]).toBeCloseTo(54492.64, 2);
    expect(byName["AFFIRM"]).toBeCloseTo(50071.93, 2);
    expect(byName["SYNC"]).toBeCloseTo(555883.07, 2);
    expect(totals.length).toBeGreaterThan(10);
    expect(totals.some((t) => t.name === "GE")).toBe(false);
  });

  it("Paycodes card Aug 1-31 matches the uploaded payment CSV groups", () => {
    const file = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-08-01",
      to: "2026-08-31",
      legs: parsePaycodeLegs(fs.readFileSync(file, "utf8")),
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["WELLS"]).toBeCloseTo(376730.9, 2);
    expect(byName["ACIMA"]).toBeCloseTo(57407.64, 2);
    expect(byName["AFFIRM"]).toBeCloseTo(54271.93, 2);
    expect(byName["IDDEAL"]).toBeCloseTo(2351475.45, 2);
    expect(byName["SYNC"]).toBeCloseTo(551918.4, 2);
    expect(byName["PROG"]).toBeCloseTo(28030.96, 2);
    expect(byName["KAFE"]).toBeCloseTo(590487.54, 2);
    expect(byName["CHK"]).toBeCloseTo(2232.14, 2);
  });

  it("paycode filter Net equals payment CSV Applied Amt for each alias group", () => {
    const file = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
    const legs = parsePaycodeLegs(fs.readFileSync(file, "utf8"));
    const window = { from: "2026-08-01", to: "2026-08-31", legs };
    const expected: Record<string, number> = {
      ACIMA: 57407.64,
      AFFIRM: 54271.93,
      IDDEAL: 2351475.45,
      PROG: 28030.96,
      SYNC: 551918.4,
      WELLS: 376730.9,
    };
    for (const [code, amt] of Object.entries(expected)) {
      const filtered = applyPaycodeFilter([], [code], undefined, window);
      const net = filtered.reduce((s, r) => s + r.netRevenue, 0);
      expect(net).toBeCloseTo(amt, 2);
    }
  });

  it("Paycodes card Sep 1 2026 matches the appended daily payment CSV", () => {
    const file = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-09-01",
      to: "2026-09-01",
      legs: parsePaycodeLegs(fs.readFileSync(file, "utf8")),
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["IDDEAL"]).toBeCloseTo(33896.13, 2);
    expect(byName["SYNC"]).toBeCloseTo(16532.38, 2);
    expect(byName["WELLS"]).toBeCloseTo(3400, 2);
    expect(byName["AFFIRM"]).toBeCloseTo(1281.23, 2);
    expect(byName["KAFE"]).toBeCloseTo(19451.84, 2);
    expect(byName["CASH"]).toBeCloseTo(7498.59, 2);
    expect(byName["CC"]).toBeCloseTo(48296.83, 2);
    expect(byName["PROG"]).toBeCloseTo(999, 2);
    expect(byName["GE"]).toBeUndefined();
    const sum = totals.reduce((s, t) => s + t.revenue, 0);
    expect(sum).toBeCloseTo(131356, 2);
  });

  it("Paycodes card Sep 2 2026 matches the appended daily payment CSV", () => {
    const file = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-09-02",
      to: "2026-09-02",
      legs: parsePaycodeLegs(fs.readFileSync(file, "utf8")),
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["CC"]).toBeCloseTo(52070.82, 2);
    expect(byName["IDDEAL"]).toBeCloseTo(29469.99, 2);
    expect(byName["WELLS"]).toBeCloseTo(20000, 2);
    expect(byName["KAFE"]).toBeCloseTo(17389.4, 2);
    expect(byName["SYNC"]).toBeCloseTo(17202, 2);
    expect(byName["CASH"]).toBeCloseTo(6291.64, 2);
    expect(byName["GE"]).toBeUndefined();
    expect(byName["ACIMA"]).toBeCloseTo(499, 2);
    expect(byName["PROG"]).toBeCloseTo(400.56, 2);
    expect(byName["AFFIRM"] ?? 0).toBeCloseTo(0, 2);
    const sum = totals.reduce((s, t) => s + t.revenue, 0);
    expect(sum).toBeCloseTo(143323.41, 2);
  });

  it("Paycodes card Sep 3 2026 matches the appended daily payment CSV", () => {
    const file = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-09-03",
      to: "2026-09-03",
      legs: parsePaycodeLegs(fs.readFileSync(file, "utf8")),
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["WELLS"]).toBeCloseTo(82929, 2);
    expect(byName["IDDEAL"]).toBeCloseTo(64442.91, 2);
    expect(byName["CC"]).toBeCloseTo(45774.64, 2);
    expect(byName["KAFE"]).toBeCloseTo(16784.69, 2);
    expect(byName["SYNC"]).toBeCloseTo(14102.95, 2);
    expect(byName["CASH"]).toBeCloseTo(9293.05, 2);
    expect(byName["ACIMA"]).toBeCloseTo(2807, 2);
    expect(byName["AFFIRM"]).toBeCloseTo(2382, 2);
    expect(byName["GE"]).toBeUndefined();
    const sum = totals.reduce((s, t) => s + t.revenue, 0);
    expect(sum).toBeCloseTo(238516.24, 2);
  });

  it("Paycodes card Sep 4 2026 matches the appended daily payment CSV", () => {
    const file = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
    const totals = paycodeTotalsForPaymentWindow({
      from: "2026-09-04",
      to: "2026-09-04",
      legs: parsePaycodeLegs(fs.readFileSync(file, "utf8")),
    });
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
    expect(byName["CC"]).toBeCloseTo(111883.29, 2);
    expect(byName["IDDEAL"]).toBeCloseTo(76290.3, 2);
    expect(byName["SYNC"]).toBeCloseTo(21412.31, 2);
    expect(byName["CASH"]).toBeCloseTo(15072.31, 2);
    expect(byName["FLEX"]).toBeCloseTo(10300, 2);
    expect(byName["KAFE"]).toBeCloseTo(9465.85, 2);
    expect(byName["WELLS"]).toBeCloseTo(6904.99, 2);
    expect(byName["PROG"]).toBeCloseTo(3080, 2);
    expect(byName["SNAP"]).toBeCloseTo(300, 2);
    expect(byName["GE"]).toBeUndefined();
    const sum = totals.reduce((s, t) => s + t.revenue, 0);
    expect(sum).toBeCloseTo(254709.05, 2);
  });
});
