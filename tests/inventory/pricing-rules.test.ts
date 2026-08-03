import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/inventory/types";
import { getVisibleDmCostPrice } from "@/lib/inventory/pricing";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    sku: "239132-18",
    description: '10KT "ULTIMATE VALUE" YELLOW-GOLD D/C ROPE CHAIN (NO WARRANTY)',
    vendorModel: "TD040",
    vendor: "MNT",
    tagPrice: 559,
    costPrice: 430,
    wholesaleCost: 559,
    store: "VJ-SOLANO",
    onHand: 1,
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    class: "10KT",
    subClass: "18",
    avgWeight: 5.5,
    brand: "Valliani",
    imageDir: "\\239132.webp",
    createDate: "5/13/2026",
    ...overrides,
  };
}

describe("gold + UV cost rule", () => {
  it("uses Tag ÷ 1.3 for DM cost when gold + Ultimate Value in description (Class 10KT)", () => {
    const item = makeItem({
      class: "10KT",
      // Whole Cost wrongly filled as Sales÷4 — must not drive DM cost
      wholesaleCost: 140,
    });
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(559 / 1.3, 5);
  });

  it("uses Tag ÷ 1.3 when Class is UV and Design is GOLD JEWL", () => {
    const item = makeItem({
      class: "UV",
      description: "10KT YELLOW-GOLD D/C ROPE CHAIN",
      wholesaleCost: 140,
    });
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(559 / 1.3, 5);
  });

  it("uses Tag ÷ 1.3 when description has UV word with gold", () => {
    const item = makeItem({
      description: "14KT UV YELLOW-GOLD HOOP",
      wholesaleCost: 100,
      tagPrice: 260,
    });
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(260 / 1.3, 5);
  });

  it("keeps normal DM wholesale cost when gold without UV/Ultimate", () => {
    const item = makeItem({
      description: "14KT YELLOW-GOLD D/C ROPE CHAIN (NO WARRANTY)",
      wholesaleCost: 600,
    });
    expect(getVisibleDmCostPrice(item)).toBe(600);
  });
});
