import { describe, expect, it } from "vitest";
import {
  dropMatchedSalesReturnPairs,
  filterExcludedSalesRows,
  salesUnitsSold,
} from "@/lib/utils";

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

  it("keeps same-txn exchange return (different SKU) so net revenue is correct", () => {
    const rows = [
      {
        transactionId: "ST-10292388",
        storeName: "VJ-STA",
        vendorModel: "YA101203",
        sku: "YA101203",
        quantity: -1,
        netRevenue: -2150,
        department: "WATCH",
      },
      {
        transactionId: "ST-10292388",
        storeName: "VJ-STA",
        vendorModel: "YA101203",
        sku: "YA101203",
        quantity: 1,
        netRevenue: 2150,
        department: "WATCH",
      },
      {
        transactionId: "VR-102291158",
        storeName: "VJ-ROSE",
        vendorModel: "ANAF0041",
        sku: "238837Y",
        quantity: -1,
        netRevenue: -324.83,
        department: "LADYS RING",
      },
      {
        transactionId: "VR-102291158",
        storeName: "VJ-ROSE",
        vendorModel: "R099579A",
        sku: "163099Y",
        quantity: 1,
        netRevenue: 650,
        department: "LADYS RING",
      },
      // Same returned SKU sold elsewhere at same abs net — must NOT void-pair the exchange return
      {
        transactionId: "VR-OTHER",
        storeName: "VJ-ROSE",
        vendorModel: "ANAF0041",
        sku: "238837Y",
        quantity: 1,
        netRevenue: 324.83,
        department: "LADYS RING",
      },
    ];
    const out = filterExcludedSalesRows(rows);
    expect(out.map((r) => r.transactionId).sort()).toEqual([
      "VR-102291158",
      "VR-102291158",
      "VR-OTHER",
    ]);
    const exchange = out.filter((r) => r.transactionId === "VR-102291158");
    expect(exchange.reduce((s, r) => s + r.netRevenue, 0)).toBeCloseTo(325.17);
    expect(exchange.reduce((s, r) => s + salesUnitsSold(r.quantity), 0)).toBe(1);
  });

  it("drops complimentary Watch Winder lines (SKU, style, or vendor model)", () => {
    const rows = [
      {
        transactionId: "GM-10292985",
        storeName: "DBC-GM",
        vendorModel: "WATCH WINDER",
        sku: "217365",
        style: "WATCH WINDER-1",
        quantity: 1,
        netRevenue: 0,
        inventoryCost: 13.8,
        department: "MISC",
      },
      {
        transactionId: "HE-10001358",
        storeName: "VJ-HEND",
        vendorModel: "WATCH WINDER",
        sku: "WATCH WINDER-1",
        quantity: 1,
        netRevenue: 79,
        inventoryCost: 13.8,
        department: "MISC",
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
    const out = filterExcludedSalesRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].vendorModel).toBe("D67");
  });
});
