import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/inventory/types";
import { getVisibleDmCostPrice } from "@/lib/inventory/pricing";
import { wholeCostFromRules } from "@/lib/inventory/whole-cost-rules";

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

describe("Whole Cost rules (CP Divisor sheet)", () => {
  it("keeps filled inventory Whole Cost (never overwrite with formula)", () => {
    const item = makeItem({
      class: "UV",
      design: "GOLD JEWL",
      wholesaleCost: 140,
      tagPrice: 559,
    });
    expect(getVisibleDmCostPrice(item)).toBe(140);
  });

  it("Class UV + GOLD JEWL → Tag ÷ 1.3 when Whole Cost blank", () => {
    const item = makeItem({
      class: "UV",
      design: "GOLD JEWL",
      wholesaleCost: 0,
      tagPrice: 559,
    });
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(559 / 1.3, 5);
  });

  it("GOLD JEWL design without UV → Tag ÷ 4 when Whole Cost blank", () => {
    const item = makeItem({
      class: "10KT",
      design: "GOLD JEWL",
      department: "GOLD ID",
      wholesaleCost: 0,
      tagPrice: 400,
    });
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(400 / 4, 5);
  });

  it("LADYS RING (diamond dept) → Tag ÷ 8.8", () => {
    expect(
      wholeCostFromRules(
        { department: "LADYS RING", design: "OVANI", class: "14KT", subClass: "7" },
        21995
      )
    ).toBeCloseTo(21995 / 8.8, 5);
  });

  it("MICHAEL KO department → Tag/2 + 10", () => {
    expect(
      wholeCostFromRules({ department: "MICHAEL KO", design: "WATCH", class: "", subClass: "" }, 200)
    ).toBeCloseTo(200 / 2 + 10, 5);
  });

  it("MONT WATCH department → Tag/1.82 + 20", () => {
    expect(
      wholeCostFromRules({ department: "MONT WATCH", design: "WATCH", class: "", subClass: "" }, 182)
    ).toBeCloseTo(182 / 1.82 + 20, 5);
  });

  it("TUNGS BAND → Tag * 0.06", () => {
    expect(
      wholeCostFromRules({ department: "TUNGS BAND", design: "", class: "", subClass: "" }, 1000)
    ).toBeCloseTo(60, 5);
  });
});
