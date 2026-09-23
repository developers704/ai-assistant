import { describe, expect, it } from "vitest";
import {
  briefPriorYear,
  briefWindowRange,
  buildBriefEdition,
  forecastTwoWeeks,
  formatSignedPct,
  pctDelta,
} from "@/lib/brief/edition";

describe("morning brief edition", () => {
  it("builds week, month, and season windows off the latest sales day", () => {
    expect(briefWindowRange("week", "2026-09-21")).toEqual({ from: "2026-09-15", to: "2026-09-21" });
    expect(briefWindowRange("month", "2026-09-21")).toEqual({ from: "2026-09-01", to: "2026-09-21" });
    expect(briefWindowRange("season", "2026-09-21")).toEqual({ from: "2026-07-01", to: "2026-09-21" });
  });

  it("compares the same weekdays last year", () => {
    const ly = briefPriorYear("2026-09-15", "2026-09-21");
    expect(ly?.from.startsWith("2025-")).toBe(true);
    expect(ly && ly.from <= ly.to).toBe(true);
  });

  it("forecasts two weeks from the window pace and signs the year-over-year figure", () => {
    expect(forecastTwoWeeks(7, 7)).toBe(14);
    expect(pctDelta(120, 100)).toBeCloseTo(20);
    expect(formatSignedPct(20)).toBe("+20%");
    expect(formatSignedPct(-4)).toBe("−4%");
    expect(formatSignedPct(null)).toBe("New");
  });

  it("marks a busy empty case as running thin and calls out Kash cost", () => {
    const edition = buildBriefEdition({
      from: "2026-09-15",
      to: "2026-09-21",
      net: 1000,
      lyNet: 800,
      units: 10,
      models: [
        {
          vendorModel: "EVEBS025",
          name: "Studs",
          revenue: 400,
          units: 8,
          onHandTotal: 0,
          kashCost: 90,
          department: "EARRINGS",
        },
      ],
      lyModels: [{ vendorModel: "EVEBS025", name: "Studs", revenue: 200, units: 4 }],
      stores: [{ name: "VJ-HEND", revenue: 1000 }],
      lyStores: [{ name: "VJ-HEND", revenue: 800 }],
      vendors: [],
      lyVendors: [],
      people: [],
      lyPeople: [],
      pay: [{ name: "CASH", revenue: 1000 }],
      lyPay: [{ name: "CASH", revenue: 500 }],
      showKash: true,
    });
    expect(edition.headline).toContain("VJ-HEND");
    expect(edition.headline).toContain("ahead");
    const model = edition.sections.find((s) => s.id === "models")!.stories[0]!;
    expect(model.kicker).toBe("Running thin");
    expect(model.facts.find((f) => f.label === "Kash CP")?.value).toBe("$90");
    expect(model.deck).toContain("under Kash cost");
    const noisy = buildBriefEdition({
      from: "2026-09-15",
      to: "2026-09-21",
      net: 500,
      lyNet: 400,
      units: 20,
      models: [
        { vendorModel: "250000", name: "Covered Battery-Embedded (CBE) Recycling Fee", revenue: 130, units: 13, onHandTotal: 0 },
        { vendorModel: "MLB-LT-2500", name: "Mulberry Lifetime Care Plan", revenue: 3880, units: 10 },
        { vendorModel: "BATTERY", name: "BATTERY", revenue: 142, units: 8, department: "BATTERY" },
        { vendorModel: "MV064-SL", name: "Diamond hoops", revenue: 3192, units: 8, onHandTotal: 4, department: "EARRINGS" },
      ],
      lyModels: [],
      stores: [],
      lyStores: [],
      vendors: [],
      lyVendors: [],
      people: [],
      lyPeople: [],
      pay: [],
      lyPay: [],
      showKash: false,
    });
    const titles = noisy.sections.find((s) => s.id === "models")!.stories.map((s) => s.title);
    expect(titles).toEqual(["MV064-SL"]);
    expect(model.figure).toBe("+100%");
  });
});
