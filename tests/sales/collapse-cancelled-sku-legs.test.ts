import { describe, expect, it } from "vitest";
import { collapseCancelledSkuLegs } from "@/lib/sales/top-models-wholesale-margin";
import { filterExcludedSalesRows, salesUnitsSold } from "@/lib/utils";
import type { VendorPosRow } from "@/lib/reports/types";

function row(partial: Partial<VendorPosRow>): VendorPosRow {
  return {
    date: "2026-08-08",
    storeName: "VJ-VAL",
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    vendor: "KGS",
    productClass: "18KT",
    subClass: "",
    description: "paperclip",
    sku: "205357-20",
    itemNumber: "205357-20",
    vendorModel: "QKVK100001",
    style: "",
    quantity: 1,
    grossSales: 27510,
    discountAmount: 0,
    netRevenue: 10909.09,
    inventoryCost: 0,
    wholesaleCost: 0,
    margin: 0,
    discountRate: 0,
    transactionId: "T1",
    imageDir: "",
    ...partial,
  };
}

describe("collapseCancelledSkuLegs", () => {
  it("cancels same-store same-day same-SKU sale+return; keeps unrelated sale", () => {
    const rows = [
      row({ transactionId: "FA-SALE", quantity: 1, netRevenue: 10909.09 }),
      row({
        transactionId: "FA-EXCH",
        quantity: -1,
        netRevenue: -10909.09,
        grossSales: -27510,
      }),
      row({
        transactionId: "VS-KEEP",
        date: "2026-08-10",
        storeName: "VJ-SERRA",
        sku: "205351-8",
        itemNumber: "205351-8",
        quantity: 1,
        netRevenue: 5733.78,
        grossSales: 12707,
      }),
    ];
    const out = collapseCancelledSkuLegs(rows);
    expect(out).toHaveLength(1);
    expect(out[0].sku).toBe("205351-8");
    expect(out.reduce((s, r) => s + salesUnitsSold(r.quantity), 0)).toBe(1);
  });

  it("cancels cross-day same-store same-SKU sale+return in the filter window", () => {
    const rows = [
      row({
        date: "2026-08-04",
        transactionId: "NO-SALE",
        storeName: "VJ-NORTH",
        sku: "231620S",
        itemNumber: "231620S",
        quantity: 1,
        netRevenue: 599,
        grossSales: 599,
      }),
      row({
        date: "2026-08-08",
        transactionId: "NO-RTN",
        storeName: "VJ-NORTH",
        sku: "231620S",
        itemNumber: "231620S",
        quantity: -1,
        netRevenue: -599,
        grossSales: -599,
      }),
      row({
        date: "2026-08-09",
        transactionId: "NO-KEEP",
        storeName: "VJ-NORTH",
        sku: "231620S",
        itemNumber: "231620S",
        quantity: 1,
        netRevenue: 599,
        grossSales: 599,
      }),
    ];
    const out = collapseCancelledSkuLegs(rows);
    expect(out).toHaveLength(1);
    expect(out[0].transactionId).toBe("NO-KEEP");
    expect(out.reduce((s, r) => s + r.netRevenue, 0)).toBeCloseTo(599);
    expect(out.reduce((s, r) => s + salesUnitsSold(r.quantity), 0)).toBe(1);
  });

  it("cancels size/Y-suffix exchange (same store+net, different SKU)", () => {
    const rows = [
      row({
        sku: "224125",
        itemNumber: "224125",
        quantity: 1,
        netRevenue: 2011.43,
        grossSales: 7499,
      }),
      row({
        sku: "224125Y",
        itemNumber: "224125Y",
        quantity: -1,
        netRevenue: -2011.43,
        grossSales: -7499,
      }),
    ];
    expect(collapseCancelledSkuLegs(rows)).toHaveLength(0);
  });

  it("cancels cross-store same-SKU return in Top Models", () => {
    const rows = [
      row({
        date: "2026-07-13",
        storeName: "VJ-ONT",
        sku: "234946",
        itemNumber: "234946",
        quantity: 1,
        netRevenue: 479,
        grossSales: 479,
      }),
      row({
        date: "2026-08-02",
        storeName: "VJ-EAST",
        sku: "234946",
        itemNumber: "234946",
        quantity: -1,
        netRevenue: -479,
        grossSales: -479,
      }),
    ];
    expect(collapseCancelledSkuLegs(rows)).toHaveLength(0);
  });

  it("does not change global Net Sales exclusion (exchange stay in filterExcludedSalesRows)", () => {
    const rows = [
      row({ transactionId: "FA-SALE", quantity: 1, netRevenue: 10909.09 }),
      row({
        transactionId: "FA-EXCH",
        quantity: -1,
        netRevenue: -10909.09,
        grossSales: -27510,
      }),
      // other sale on exchange receipt — blocks global void-pair
      row({
        transactionId: "FA-EXCH",
        sku: "235044",
        itemNumber: "235044",
        vendorModel: "OTHER",
        quantity: 1,
        netRevenue: 13636.36,
        grossSales: 15000,
      }),
    ];
    const global = filterExcludedSalesRows(rows);
    expect(global.some((r) => r.quantity! < 0)).toBe(true);
    const collapsed = collapseCancelledSkuLegs(
      global.filter((r) => r.vendorModel === "QKVK100001")
    );
    expect(collapsed).toHaveLength(0);
  });
});
