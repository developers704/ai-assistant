import { describe, expect, it } from "vitest";
import {
  filterExcludedSalesRows,
  isHiddenFromTopVendorModelsRow,
} from "@/lib/utils";
import { getTopVendorModels } from "@/lib/sales/sales-product-analysis";
import { groupRows, summarizeRows } from "@/lib/sales/sales-aggregate";
import type { VendorPosRow } from "@/lib/reports/types";

function row(partial: Partial<VendorPosRow> & Pick<VendorPosRow, "netRevenue">): VendorPosRow {
  return {
    date: "2026-07-01",
    storeName: "VJ-ROSE",
    department: "B",
    design: "OVANI",
    vendor: "OVANI",
    productClass: "RING",
    sku: "SKU1",
    itemNumber: "SKU1",
    vendorModel: "D67",
    description: "Ring",
    quantity: 1,
    grossSales: partial.netRevenue,
    discountAmount: 0,
    discountRate: 0,
    inventoryCost: 0,
    margin: partial.netRevenue,
    transactionId: "VR-1",
    ...partial,
  } as VendorPosRow;
}

describe("soft-hidden sales lines", () => {
  it("keeps blank dept / ITEM / MLB / pads / legacy in net sales", () => {
    const rows = [
      row({ sku: "236292Y", vendorModel: "D67", netRevenue: 1000, department: "B" }),
      row({
        sku: "ITEM",
        vendorModel: "CUSTOM",
        netRevenue: 500,
        department: "B",
        transactionId: "VR-2",
      }),
      row({
        sku: "MLB-100",
        vendorModel: "MLB-100",
        netRevenue: 200,
        department: "B",
        transactionId: "VR-3",
      }),
      row({
        sku: "217365",
        vendorModel: "LEGACY",
        netRevenue: 50,
        department: "B",
        transactionId: "VR-4",
      }),
      row({
        sku: "PAD1",
        vendorModel: "Pad [s]",
        description: "Earring Pad [s]",
        netRevenue: 25,
        department: "B",
        transactionId: "VR-5",
      }),
      row({
        sku: "BLANK1",
        vendorModel: "X1",
        netRevenue: 300,
        department: "",
        transactionId: "VR-6",
      }),
    ];

    const kept = filterExcludedSalesRows(rows);
    expect(kept).toHaveLength(6);
    expect(summarizeRows(kept).netSales).toBe(2075);
  });

  it("omits soft-hidden lines from top vendor models but keeps store / vendor totals", () => {
    const rows = filterExcludedSalesRows([
      row({ sku: "236292Y", vendorModel: "D67", netRevenue: 1000, department: "B" }),
      row({
        sku: "ITEM",
        vendorModel: "CUSTOM-ORDER",
        netRevenue: 500,
        department: "B",
        transactionId: "VR-2",
      }),
      row({
        sku: "BLANK1",
        vendorModel: "X1",
        netRevenue: 300,
        department: "",
        vendor: "OVANI",
        transactionId: "VR-3",
      }),
    ]);

    const models = getTopVendorModels(rows);
    expect(models.map((m) => m.name)).toEqual(["D67"]);
    expect(models[0].netSales).toBe(1000);

    const stores = groupRows(rows, "store", null);
    expect(stores[0].netSales).toBe(1800);

    const vendors = groupRows(rows, "vendor", null);
    expect(vendors[0].netSales).toBe(1800);

    // Blank department does not invent a department bucket
    const depts = groupRows(rows, "department", null);
    expect(depts.map((d) => d.name)).toEqual(["B"]);
    expect(depts[0].netSales).toBe(1500);
  });

  it("still hard-excludes fees / watch winders from all totals", () => {
    const rows = filterExcludedSalesRows([
      row({ sku: "250000", vendorModel: "FEE", netRevenue: 99, department: "MISC" }),
      row({
        sku: "WATCH WINDER-1",
        vendorModel: "WATCH WINDER",
        netRevenue: 79,
        department: "MISC",
        transactionId: "VR-2",
      }),
      row({
        sku: "236292Y",
        vendorModel: "D67",
        netRevenue: 1000,
        department: "B",
        transactionId: "VR-3",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("236292Y");
  });

  it("hard-deletes $0 Total rows", () => {
    const rows = filterExcludedSalesRows([
      row({ sku: "236292Y", vendorModel: "D67", netRevenue: 1000 }),
      row({
        sku: "GIFT1",
        vendorModel: "GIFT",
        netRevenue: 0,
        department: "B",
        transactionId: "VR-2",
      }),
      row({
        sku: "ZERO",
        vendorModel: "D67",
        netRevenue: 0,
        department: "B",
        transactionId: "VR-3",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].netRevenue).toBe(1000);
  });

  it("hides promo / packaging vendor models from top lists but keeps non-zero net", () => {
    const rows = filterExcludedSalesRows([
      row({ sku: "236292Y", vendorModel: "D67", netRevenue: 1000 }),
      row({
        sku: "TAB1",
        vendorModel: "TABLET",
        netRevenue: 50,
        department: "B",
        transactionId: "VR-2",
      }),
      row({
        sku: "9G1206",
        vendorModel: "9G1206",
        netRevenue: 25,
        department: "B",
        transactionId: "VR-3",
      }),
      row({
        sku: "BAG1",
        vendorModel: "CLOTH BAG (RED)",
        netRevenue: 10,
        department: "B",
        transactionId: "VR-4",
      }),
    ]);
    expect(summarizeRows(rows).netSales).toBe(1085);
    const models = getTopVendorModels(rows);
    expect(models.map((m) => m.name)).toEqual(["D67"]);
  });

  it("flags soft-hidden rows for list filtering", () => {
    expect(isHiddenFromTopVendorModelsRow({ department: "", sku: "X" })).toBe(true);
    expect(isHiddenFromTopVendorModelsRow({ department: "B", sku: "ITEM" })).toBe(true);
    expect(isHiddenFromTopVendorModelsRow({ department: "B", sku: "MLB-9" })).toBe(true);
    expect(
      isHiddenFromTopVendorModelsRow({
        department: "B",
        sku: "1",
        description: "Screw Pad [s]",
      })
    ).toBe(true);
    expect(
      isHiddenFromTopVendorModelsRow({
        department: "B",
        vendorModel: "SMART WATCH",
        sku: "SW1",
      })
    ).toBe(true);
    expect(isHiddenFromTopVendorModelsRow({ department: "B", sku: "236292Y" })).toBe(false);
  });
});
