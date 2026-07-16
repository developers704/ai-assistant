import { describe, expect, it } from "vitest";
import type { VendorPosRow } from "@/lib/reports/types";
import {
  groupSalesLookupVariants,
  resolveSalesLookupRows,
} from "@/lib/sales/sku-lookup";

function row(partial: Partial<VendorPosRow>): VendorPosRow {
  return {
    date: "2026-07-01",
    transactionId: "T1",
    storeName: "VJ-TEST",
    department: "MENS BRCLT",
    design: "NOVELLO",
    itemNumber: "",
    sku: "",
    style: "",
    description: "Bracelet",
    vendor: "VSU",
    vendorModel: "",
    productClass: "UV",
    subClass: "",
    quantity: 1,
    inventoryCost: 444,
    grossSales: 999,
    discountAmount: 0,
    netRevenue: 999,
    margin: 555,
    discountRate: 0,
    imageDir: "",
    ...partial,
  };
}

const mv067Family = [
  row({ sku: "231624S", itemNumber: "231624S", style: "MV067-SL", vendorModel: "MV067-SL", storeName: "VJ-ARDN" }),
  row({ sku: "231624S", itemNumber: "231624S", style: "MV067-SL", vendorModel: "MV067-SL", storeName: "VJ-VICTOR" }),
  row({ sku: "231624S", itemNumber: "231624S", style: "MV067-SL", vendorModel: "MV067-SL", storeName: "VJ-VAL" }),
  row({ sku: "231624S", itemNumber: "231624S", style: "MV067-SL", vendorModel: "MV067-SL", storeName: "VJ-VICTOR" }),
  row({
    sku: "231624V",
    itemNumber: "231624V",
    style: "MV067-SL-1",
    vendorModel: "MV067-SL",
    inventoryCost: 502,
    storeName: "DBC-STOCK",
  }),
  row({
    sku: "231624V",
    itemNumber: "231624V",
    style: "MV067-SL-1",
    vendorModel: "MV067-SL",
    inventoryCost: 502,
    storeName: "VJ-VAL",
  }),
  row({
    sku: "231624V",
    itemNumber: "231624V",
    style: "MV067-SL-1",
    vendorModel: "MV067-SL",
    inventoryCost: 502,
    storeName: "VJ-PALM",
  }),
  row({
    sku: "231624V",
    itemNumber: "231624V",
    style: "MV067-SL-1",
    vendorModel: "MV067-SL",
    inventoryCost: 502,
    storeName: "VJ-VICTOR",
  }),
  row({
    sku: "231624V",
    itemNumber: "231624V",
    style: "MV067-SL-1",
    vendorModel: "MV067-SL",
    inventoryCost: 502,
    storeName: "VJ-VAL",
  }),
];

describe("resolveSalesLookupRows", () => {
  it("matches Top Vendor Models when query is the vendor model (MV067-SL → 9)", () => {
    const { matchRows, matchType } = resolveSalesLookupRows(mv067Family, "MV067-SL");
    expect(matchType).toBe("vendorModel");
    expect(matchRows).toHaveLength(9);
    expect(matchRows.reduce((s, r) => s + r.quantity, 0)).toBe(9);
    expect(matchRows.reduce((s, r) => s + r.netRevenue, 0)).toBe(8991);
  });

  it("still allows SKU-level lookup for one finish (231624S → 4)", () => {
    const { matchRows, matchType } = resolveSalesLookupRows(mv067Family, "231624S");
    expect(matchType).toBe("sku");
    expect(matchRows).toHaveLength(4);
  });

  it("still allows style-level lookup for vermeil variant (MV067-SL-1 → 5)", () => {
    const { matchRows, matchType } = resolveSalesLookupRows(mv067Family, "MV067-SL-1");
    expect(matchType).toBe("style");
    expect(matchRows).toHaveLength(5);
  });

  it("does not let style-name collision under-count vs Top 20", () => {
    // Regression: preferring style MV067-SL (4) over vendor model MV067-SL (9)
    const { matchRows } = resolveSalesLookupRows(mv067Family, "mv067-sl");
    expect(matchRows.reduce((s, r) => s + r.quantity, 0)).toBe(9);
  });
});

describe("groupSalesLookupVariants", () => {
  it("splits model total into SKU lines", () => {
    const variants = groupSalesLookupVariants(mv067Family);
    expect(variants).toHaveLength(2);
    expect(variants.find((v) => v.sku === "231624S")?.units).toBe(4);
    expect(variants.find((v) => v.sku === "231624V")?.units).toBe(5);
  });
});
