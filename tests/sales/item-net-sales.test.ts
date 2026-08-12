import { describe, expect, it } from "vitest";
import {
  filterExcludedSalesRows,
  isExcludedSalesRow,
  isExcludedSalesSku,
  isHiddenFromTopVendorModelsRow,
  isItemPlaceholderSku,
} from "@/lib/utils";
import type { VendorPosRow } from "@/lib/reports/types";

function row(partial: Partial<VendorPosRow>): VendorPosRow {
  return {
    date: "2026-08-11",
    storeName: "VJ-VIS",
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    vendor: "X",
    productClass: "10KT",
    subClass: "",
    description: "product",
    sku: "239135-16",
    itemNumber: "239135-16",
    vendorModel: "TD025",
    style: "",
    quantity: 1,
    grossSales: 199,
    discountAmount: 0,
    netRevenue: 199,
    inventoryCost: 0,
    wholesaleCost: 0,
    margin: 0,
    discountRate: 0,
    transactionId: "T1",
    imageDir: "",
    salespersons: "JM1/100% -",
    ...partial,
  };
}

describe("ITEM placeholder — Net Sales keep, Top Models hide", () => {
  it("ITEM is not a hard-excluded SKU", () => {
    expect(isExcludedSalesSku("ITEM")).toBe(false);
    expect(isItemPlaceholderSku("ITEM")).toBe(true);
  });

  it("ITEM with blank department stays in Net Sales filter", () => {
    const itemRow = row({
      sku: "ITEM",
      itemNumber: "ITEM",
      department: "",
      design: "",
      productClass: "",
      vendorModel: "",
      description: "SIZE RING TO 11 PLEASE 10K WG",
      netRevenue: 310,
      grossSales: 310,
      salespersons: "BP/100% -",
    });
    expect(isExcludedSalesRow(itemRow)).toBe(false);
    expect(isHiddenFromTopVendorModelsRow(itemRow)).toBe(true);
    const kept = filterExcludedSalesRows([
      itemRow,
      row({ netRevenue: 199, grossSales: 199 }),
    ]);
    expect(kept).toHaveLength(2);
    expect(kept.reduce((s, r) => s + r.netRevenue, 0)).toBe(509);
  });

  it("blank department still drops non-ITEM incomplete lines", () => {
    expect(
      isExcludedSalesRow(
        row({ sku: "999999", itemNumber: "999999", department: "" })
      )
    ).toBe(true);
  });

  it("Visalia-style mix: product + ITEM repairs = full CSV Total in Net Sales", () => {
    const rows = [
      row({
        sku: "224452-26",
        itemNumber: "224452-26",
        department: "SLVR CHAIN",
        design: "LINKNLOCK",
        productClass: "-",
        vendorModel: "CMM 050 8L",
        netRevenue: 304,
        grossSales: 304,
        salespersons: "BP/50% - RG1/50% -",
        transactionId: "VV-1",
      }),
      row({
        sku: "ITEM",
        itemNumber: "ITEM",
        department: "",
        design: "",
        vendorModel: "",
        description: "SPO 212858 …",
        netRevenue: 460.83,
        grossSales: 460.83,
        transactionId: "VV-2",
      }),
      row({
        sku: "ITEM",
        itemNumber: "ITEM",
        department: "",
        description: "SIZE RING TO 11",
        vendorModel: "",
        netRevenue: 310,
        grossSales: 310,
        transactionId: "VV-3",
      }),
      row({
        sku: "ITEM",
        itemNumber: "ITEM",
        department: "",
        description: "EXTENDER",
        vendorModel: "",
        netRevenue: 25,
        grossSales: 25,
        transactionId: "VV-4",
      }),
      row({
        sku: "239135-16",
        netRevenue: 199,
        grossSales: 199,
        transactionId: "VV-5",
      }),
    ];
    const kept = filterExcludedSalesRows(rows);
    expect(kept.reduce((s, r) => s + r.netRevenue, 0)).toBeCloseTo(1298.83, 2);
    expect(kept.filter((r) => isHiddenFromTopVendorModelsRow(r))).toHaveLength(3);
    expect(
      kept.filter((r) => !isHiddenFromTopVendorModelsRow(r)).reduce((s, r) => s + r.netRevenue, 0)
    ).toBe(503);
  });
});
