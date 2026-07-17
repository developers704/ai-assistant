import { describe, expect, it } from "vitest";
import { matchEntity, normalizeFilterInputs } from "@/lib/sales/sales-normalizer";
import type { EntityIndex } from "@/lib/sales/sales-types";

const index: EntityIndex = {
  stores: ["VJ-ARDN"],
  departments: ["MENS BRCLT"],
  designs: ["NOVELLO"],
  vendors: ["VSU"],
  classes: ["10K", "10KT", "14KT", "UV", "-", "21-24KT", "B SAPPHIRE"],
  skus: ["231624S"],
  vendorModels: ["MV067-SL"],
  products: ["Bracelet"],
  dates: ["2026-07-01"],
};

describe("class filter matching", () => {
  it("keeps exact 10K vs 10KT (no alias collision)", () => {
    expect(matchEntity("10K", index.classes, "class")).toEqual({
      status: "exact",
      value: "10K",
      score: 100,
    });
    expect(matchEntity("10KT", index.classes, "class")).toEqual({
      status: "exact",
      value: "10KT",
      score: 100,
    });
  });

  it("dashboard exactFilters accepts select-all without clarification", () => {
    const res = normalizeFilterInputs({ classes: [...index.classes] }, index, {
      exact: true,
    });
    expect(res.clarification).toBeUndefined();
    expect(res.filters.classes).toEqual(index.classes);
  });

  it("dashboard exactFilters keeps placeholder class '-'", () => {
    const res = normalizeFilterInputs({ classes: ["-"] }, index, { exact: true });
    expect(res.clarification).toBeUndefined();
    expect(res.filters.classes).toEqual(["-"]);
  });
});
