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

  it("does not drop a real sale when only a same-model sale exists at another store", () => {
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
});
