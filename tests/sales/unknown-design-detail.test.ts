import { describe, expect, it } from "vitest";
import type { VendorPosRow } from "@/lib/reports/types";
import { dimensionValue } from "@/lib/reports/rank-dimension";

function row(partial: Partial<VendorPosRow>): VendorPosRow {
  return {
    date: "2026-07-01",
    transactionId: "T1",
    storeName: "VJ-TEST",
    department: "MISC",
    design: "",
    itemNumber: "1",
    sku: "1",
    style: "",
    description: "Item",
    vendor: "VSU",
    vendorModel: "M1",
    productClass: "",
    subClass: "",
    quantity: 1,
    inventoryCost: 10,
    grossSales: 100,
    discountAmount: 0,
    netRevenue: 100,
    margin: 90,
    discountRate: 0,
    imageDir: "",
    ...partial,
  };
}

describe("rank-detail Unknown design", () => {
  it("maps blank design to Unknown design (same label as Top design lines)", () => {
    expect(dimensionValue(row({ design: "" }), "design")).toBe("Unknown design");
    expect(dimensionValue(row({ design: "   " }), "design")).toBe("Unknown design");
    expect(dimensionValue(row({ design: "-" }), "design")).toBe("Unknown design");
    expect(dimensionValue(row({ design: "NOVELLO" }), "design")).toBe("NOVELLO");
  });

  it("maps blank class to Unknown class", () => {
    expect(dimensionValue(row({ productClass: "" }), "class")).toBe("Unknown class");
    expect(dimensionValue(row({ productClass: "UV" }), "class")).toBe("UV");
  });
});
