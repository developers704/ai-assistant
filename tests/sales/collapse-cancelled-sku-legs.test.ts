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
