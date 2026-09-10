import { describe, expect, it } from "vitest";
import type { VendorPosRow } from "@/lib/reports/types";
import {
  signedWholesaleUnitCost,
  wholesaleProfitForModelRows,
} from "@/lib/sales/top-models-wholesale-margin";

function row(
  partial: Partial<VendorPosRow> & { netRevenue: number }
): VendorPosRow {
  return {
    date: "2026-09-09",
    storeName: "VJ-TEST",
    department: "EARRINGS",
    design: "NOVELLO",
    vendor: "VSU",
    productClass: "UV",
    subClass: "HOOPS",
    description: 'SILVER"LAB-GROWN" DIAMOND ULTIMATE VALUE HOOPS',
    sku: "231622S",
    itemNumber: "231622S",
    vendorModel: "MV066-SL",
    style: "",
    quantity: 1,
    grossSales: partial.grossSales ?? partial.netRevenue,
    discountAmount: 0,
    inventoryCost: 126,
    wholesaleCost: 215,
    margin: 0,
    discountRate: 0,
    transactionId: "T1",
    imageDir: "",
    ...partial,
  } as VendorPosRow;
}

describe("signedWholesaleUnitCost qty scale", () => {
  it("charges one unit on qty 1", () => {
    expect(
      signedWholesaleUnitCost(215, { quantity: 1, netRevenue: 299, grossSales: 299 })
    ).toBe(215);
  });

  it("charges half on a 0.5 split row", () => {
    expect(
      signedWholesaleUnitCost(215, {
        quantity: 0.5,
        netRevenue: 149.5,
        grossSales: 149.5,
      })
    ).toBeCloseTo(107.5, 6);
  });

  it("adds half cost back on a -0.5 return split", () => {
    expect(
      signedWholesaleUnitCost(215, {
        quantity: -0.5,
        netRevenue: -149.5,
        grossSales: -149.5,
      })
    ).toBeCloseTo(-107.5, 6);
  });

  it("sale+return with qty ±1 nets zero profit", () => {
    const sale = 299 - signedWholesaleUnitCost(215, { quantity: 1, netRevenue: 299 });
    const ret = -299 - signedWholesaleUnitCost(215, { quantity: -1, netRevenue: -299 });
    expect(sale + ret).toBeCloseTo(0, 6);
  });
});

describe("Top Models 231622 UV hoops", () => {
  it("qty 1 at $299 is about +28% (fixed CP $215)", () => {
    const { profit, marginRate } = wholesaleProfitForModelRows([
      row({ sku: "231622S", quantity: 1, grossSales: 299, netRevenue: 299 }),
    ]);
    expect(profit).toBeCloseTo(84, 6);
    expect(marginRate).toBeCloseTo(84 / 299, 6);
  });

  it("does not double-count CP on 50/50 split rows (the -44% bug)", () => {
    const split = [
      row({
        sku: "231622S",
        quantity: 0.5,
        grossSales: 149.5,
        netRevenue: 149.5,
        transactionId: "FA-S",
      }),
      row({
        sku: "231622S",
        quantity: 0.5,
        grossSales: 149.5,
        netRevenue: 149.5,
        transactionId: "FA-S",
      }),
      row({
        sku: "231622V",
        quantity: 0.5,
        grossSales: 149.5,
        netRevenue: 149.5,
        transactionId: "FA-V",
      }),
      row({
        sku: "231622V",
        quantity: 0.5,
        grossSales: 149.5,
        netRevenue: 149.5,
        transactionId: "FA-V",
      }),
    ];
    const { profit, marginRate } = wholesaleProfitForModelRows(split);
    // 2 pcs × $299 net, 2 × $215 CP
    expect(profit).toBeCloseTo(168, 4);
    expect(marginRate).toBeCloseTo(168 / 598, 4);
    expect(marginRate).toBeGreaterThan(0.27);
    expect(marginRate).toBeLessThan(0.29);
  });
});
