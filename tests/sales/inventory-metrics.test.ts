import { describe, expect, it } from "vitest";
import {
  annualizedUnitsSold,
  inclusivePeriodDays,
  inventoryTurn,
  velocityPerStore,
} from "@/lib/sales/inventory-metrics";

describe("inventory metrics", () => {
  it("counts inclusive period days", () => {
    expect(inclusivePeriodDays("2026-07-01", "2026-07-27")).toBe(27);
    expect(inclusivePeriodDays("2026-07-01", "2026-07-01")).toBe(1);
  });

  it("matches worked example: 14 sold, 27 days, 47 on-hand, 26 stores", () => {
    const annualized = annualizedUnitsSold(14, 27);
    expect(annualized).toBeCloseTo(189.26, 1);

    expect(inventoryTurn(14, 27, 47)).toBeCloseTo(4.03, 2);
    expect(velocityPerStore(14, 27, 26)).toBeCloseTo(7.28, 2);
    expect(velocityPerStore(14, 27, 30)).toBeCloseTo(6.31, 2);
  });

  it("returns null turn when on-hand is zero", () => {
    expect(inventoryTurn(10, 30, 0)).toBeNull();
    expect(velocityPerStore(10, 30, 0)).toBeNull();
  });
});
