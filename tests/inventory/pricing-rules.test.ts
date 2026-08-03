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
  it("divides DM visible cost by 1.3 when gold and UV/Ultimate Value appear together", () => {
    const item = makeItem();
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(559 / 1.3, 5);
  });

  it("keeps normal DM wholesale cost when the description does not combine gold + UV", () => {
    const item = makeItem({
      description: "14KT YELLOW-GOLD D/C ROPE CHAIN (NO WARRANTY)",
      wholesaleCost: 600,
    });
    expect(getVisibleDmCostPrice(item)).toBe(600);
  });
});
