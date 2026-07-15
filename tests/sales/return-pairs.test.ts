import { describe, expect, it } from "vitest";
import { dropMatchedSalesReturnPairs, filterExcludedSalesRows } from "@/lib/utils";

describe("dropMatchedSalesReturnPairs", () => {
  it("drops AR return/void pair and keeps stand-alone VR sale (D67)", () => {
    const rows = [
      {
        transactionId: "AR-10291959",
        storeName: "VI-ARON",
        vendorModel: "D67",
        sku: "236292Y",
        quantity: -1,
        netRevenue: -3700,
        department: "LADYS RING",
        inventoryCost: 1212,
      },
      {
        transactionId: "AR-10291959",
        storeName: "VI-ARON",
        vendorModel: "D67",
        sku: "236292Y",
        quantity: 1,
        netRevenue: 3700,
        department: "LADYS RING",
        inventoryCost: 1212,
      },
      {
        transactionId: "VR-102291107",
        storeName: "VI-ROSE",
        vendorModel: "D67",
        sku: "236297Y",
        quantity: 1,
        netRevenue: 3499,
        department: "LADYS RING",
        inventoryCost: 1212,
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

  it("does not drop a real sale when only a same-model sale exists at another store", () => {
    const rows = [
      {
        transactionId: "T-NEG",
        storeName: "VI-ARON",
        vendorModel: "D67",
        quantity: -1,
        netRevenue: -3700,
        department: "LADYS RING",
      },
      {
        transactionId: "T-POS",
        storeName: "VI-ROSE",
        vendorModel: "D67",
        quantity: 1,
        netRevenue: 3700,
        department: "LADYS RING",
      },
    ];
    expect(dropMatchedSalesReturnPairs(rows)).toHaveLength(2);
  });
});
