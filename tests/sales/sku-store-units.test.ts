import { describe, expect, it } from "vitest";
import { skuLinesForModel } from "@/lib/sales/sales-aggregate";
import type { VendorPosRow } from "@/lib/reports/types";

function row(partial: Partial<VendorPosRow>): VendorPosRow {
  return {
    date: "2026-07-01",
    storeName: "VJ-ROSE",
    department: "B",
    design: "OVANI",
    vendor: "OVANI",
    productClass: "RING",
    sku: "236292Y",
    itemNumber: "236292Y",
    vendorModel: "D67",
    description: "Ring",
    quantity: 1,
    netRevenue: 1000,
    grossSales: 1000,
    discountAmount: 0,
    discountRate: 0,
    inventoryCost: 0,
    margin: 500,
    transactionId: "VR-1",
    ...partial,
  } as VendorPosRow;
}

describe("skuLinesForModel store units", () => {
  it("reports how many times each store sold a SKU", () => {
    const lines = skuLinesForModel([
      row({ storeName: "VJ-ROSE", quantity: 2, transactionId: "VR-1" }),
      row({ storeName: "VJ-ROSE", quantity: 1, transactionId: "VR-2" }),
      row({ storeName: "VJ-ARDN", quantity: 1, transactionId: "AR-1" }),
      row({
        storeName: "VJ-ARDN",
        sku: "999",
        itemNumber: "999",
        quantity: 4,
        transactionId: "AR-2",
      }),
    ]);

    expect(lines).toHaveLength(2);
    const primary = lines.find((l) => l.sku === "236292Y")!;
    expect(primary.units).toBe(4);
    expect(primary.stores).toEqual([
      { name: "VJ-ROSE", units: 3 },
      { name: "VJ-ARDN", units: 1 },
    ]);
    const other = lines.find((l) => l.sku === "999")!;
    expect(other.stores).toEqual([{ name: "VJ-ARDN", units: 4 }]);
  });
});
