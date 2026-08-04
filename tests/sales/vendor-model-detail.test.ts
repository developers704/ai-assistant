import { describe, expect, it } from "vitest";
import type { VendorPosRow } from "@/lib/reports/types";
import { buildVendorModelDetail } from "@/lib/sales/vendor-model-detail";
import { isHiddenFromTopVendorModelsVendorModel } from "@/lib/utils";

function row(partial: Partial<VendorPosRow>): VendorPosRow {
  return {
    date: "2026-07-10",
    transactionId: "T1",
    storeName: "VJ-VAL",
    department: "BRACELET",
    design: "LAB",
    itemNumber: "231620S",
    sku: "231620S",
    style: "",
    description: "Silver tennis bracelet",
    vendor: "MV",
    vendorModel: "MV065-SL",
    productClass: "SILVER",
    subClass: "TENNIS",
    quantity: 2,
    inventoryCost: 100,
    grossSales: 1000,
    discountAmount: 0,
    netRevenue: 1000,
    margin: 500,
    discountRate: 0,
    imageDir: "",
    ...partial,
  } as VendorPosRow;
}

describe("buildVendorModelDetail", () => {
  it("builds trend, attributes, and sku breakdown", () => {
    const detail = buildVendorModelDetail(
      [
        row({ date: "2026-07-01", quantity: 3, netRevenue: 1500, transactionId: "A" }),
        row({ date: "2026-07-15", quantity: 1, netRevenue: 500, transactionId: "B" }),
      ],
      "MV065-SL",
      { dateFrom: "2026-07-01", dateTo: "2026-07-27" }
    );

    expect(detail).not.toBeNull();
    expect(detail!.vendorModel).toBe("MV065-SL");
    expect(detail!.totals.units).toBe(4);
    expect(detail!.trend.length).toBeGreaterThan(1);
    expect(detail!.attributes.department).toBe("BRACELET");
    expect(detail!.skus[0]?.sku).toBe("231620S");
    expect(detail!.insights.length).toBeGreaterThan(0);
  });
});

describe("top vendor model exclusions", () => {
  it("hides the two vendor models from top vendor rankings while keeping them in sales totals", () => {
    expect(isHiddenFromTopVendorModelsVendorModel("YG2068")).toBe(true);
    expect(isHiddenFromTopVendorModelsVendorModel("YG2847")).toBe(true);
  });
});
