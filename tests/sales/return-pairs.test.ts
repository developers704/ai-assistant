import { describe, expect, it } from "vitest";
import { dropMatchedSalesReturnPairs, filterExcludedSalesRows } from "@/lib/utils";

describe("dropMatchedSalesReturnPairs", () => {
  it("drops AR return/void pair and keeps stand-alone VR sale (D67)", () => {
    const rows = [
      {
        transactionId: "AR-10291959",
        storeName: "VJ-ARDN",
        vendorModel: "D67",
        sku: "236292Y",
        quantity: -1,
        netRevenue: -3700,
        inventoryCost: 1212,
        department: "B",
      },
      {
        transactionId: "AR-10291959",
        storeName: "VJ-ARDN",
        vendorModel: "D67",
        sku: "236292Y",
        quantity: 1,
        netRevenue: 3700,
        inventoryCost: 1212,
        department: "B",
      },
      {
        transactionId: "VR-102291107",
        storeName: "VJ-ROSE",
        vendorModel: "D67",
        sku: "236292Y",
        quantity: 1,
        netRevenue: 3499,
        inventoryCost: 1212,
        department: "B",
      },
    ];

    const out = filterExcludedSalesRows(rows);
    expect(out.map((r) => r.transactionId)).toEqual(["VR-102291107"]);

    const rev = out.reduce((s, r) => s + r.netRevenue, 0);
    const cost = out.reduce((s, r) => s + (r.inventoryCost ?? 0), 0);
    const marginPct = +(((rev - cost) / rev) * 100).toFixed(1);
    // Without the rule: ~−3.9% (costs triple, revenue nets to one sale)
    expect(marginPct).toBe(65.4);
  });

  it("still pairs when qty was corrupted to +1 on the return leg", () => {
    const rows = [
      {
        transactionId: "AR-10291959",
        storeName: "VJ-ARDN",
        vendorModel: "D67",
        sku: "236292Y",
        quantity: 1,
        netRevenue: -3700,
        department: "B",
      },
      {
        transactionId: "AR-10291959",
        storeName: "VJ-ARDN",
        vendorModel: "D67",
        sku: "236292Y",
        quantity: 1,
        netRevenue: 3700,
        department: "B",
      },
      {
        transactionId: "VR-102291107",
        storeName: "VJ-ROSE",
        vendorModel: "D67",
        sku: "236292Y",
        quantity: 1,
        netRevenue: 3499,
        department: "B",
      },
    ];
    expect(dropMatchedSalesReturnPairs(rows).map((r) => r.transactionId)).toEqual([
      "VR-102291107",
    ]);
  });

  it("does not pair a cross-store return with a different-store sale (pair step only)", () => {
    const rows = [
      {
        transactionId: "T-NEG",
        storeName: "VJ-ARDN",
        vendorModel: "D67",
        quantity: -1,
        netRevenue: -3700,
        department: "B",
      },
      {
        transactionId: "T-POS",
        storeName: "VJ-ROSE",
        vendorModel: "D67",
        quantity: 1,
        netRevenue: 3700,
        department: "B",
      },
    ];
    expect(dropMatchedSalesReturnPairs(rows)).toHaveLength(2);
  });

  it("drops stand-alone negative-qty returns from sales dashboard (BANGLE-style)", () => {
    const rows = [
      {
        transactionId: "GM-10293035",
        storeName: "DBC-GM",
        vendorModel: "MBG10000045",
        sku: "227983S",
        quantity: 1,
        netRevenue: 727.27,
        inventoryCost: 180,
        department: "BANGLE",
      },
      {
        transactionId: "VS-10291914",
        storeName: "VJ-SERRA",
        vendorModel: "MBG05000049",
        sku: "229161V",
        quantity: -1,
        netRevenue: -370.18,
        inventoryCost: 100,
        department: "BANGLE",
      },
    ];
    const out = filterExcludedSalesRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].transactionId).toBe("GM-10293035");
    expect(out[0].netRevenue).toBeCloseTo(727.27);
    expect(out.reduce((s, r) => s + r.quantity, 0)).toBe(1);
  });
});
