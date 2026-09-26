import { describe, expect, it } from "vitest";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import { getWholesaleCostPrice } from "@/lib/inventory/pricing";
import type { InventoryItem } from "@/lib/inventory/types";

describe("POS qty parse", () => {
  it("keeps an explicit zero qty and still defaults a blank qty to 1", () => {
    const { rows } = parseVendorPosRows([
      {
        "Transaction  #": "T1",
        "Transaction Date": "9/25/2026",
        "Item  #": "ITEM",
        Qty: "0",
        Total: "0",
        Store: "VJ-ONT",
        Department: "",
      },
      {
        "Transaction  #": "T2",
        "Transaction Date": "9/25/2026",
        "Item  #": "123",
        Qty: "",
        Total: "10",
        Store: "VJ-ONT",
        Department: "GOLD CHAIN",
      },
      {
        "Transaction  #": "T3",
        "Transaction Date": "9/25/2026",
        "Item  #": "456",
        Qty: "-1",
        Total: "-20",
        Store: "VJ-ONT",
        Department: "GOLD CHAIN",
      },
    ]);
    expect(rows.map((r) => r.quantity)).toEqual([0, 1, -1]);
  });
});

describe("AJ wholesale cost", () => {
  it("does not fall back to Individual Cost when Whole Cost is blank", () => {
    const item = {
      sku: "NO-RULE-SKU",
      description: "plain band",
      vendorModel: "X",
      vendor: "V",
      tagPrice: 100,
      costPrice: 80,
      wholesaleCost: 0,
      store: "VJ-ONT",
      onHand: 1,
      department: "MISC",
      design: "CUSTOM",
      class: "",
      subClass: "",
      avgWeight: 0,
      brand: "",
      imageDir: "",
      createDate: "",
    } as InventoryItem;
    expect(getWholesaleCostPrice(item)).toBe(0);
  });
});
