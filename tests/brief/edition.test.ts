import { describe, expect, it } from "vitest";
import {
  briefPriorYear,
  briefSameDatesLastYear,
  briefWindowRange,
  buildBriefEdition,
  designLines,
  forecastTwoWeeks,
  modelLines,
  formatSignedPct,
  isUnknownBriefName,
  pctDelta,
  storeLines,
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
    expect(model.title).toBe("Still here");
    expect(model.figure).toBe("+100%");
    expect(model.facts.find((f) => f.label === "Kash CP")?.value).toBe("$90");
    const thin = modelLines(
      [
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
      [{ vendorModel: "EVEBS025", name: "Studs", revenue: 200, units: 4 }],
      "returning",
      { showKash: true }
    );
    expect(thin[0]?.note).toContain("Running thin");
    expect(thin[0]?.note).toContain("under Kash cost");
    expect(thin[0]?.kashCost).toBe(90);
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
    expect(titles).toEqual(["This year"]);
    expect(noisy.sections.find((s) => s.id === "models")!.stories[0]?.figure).toBe("$3,192");
    const freshOnly = modelLines(
      [
        { vendorModel: "250000", name: "Covered Battery-Embedded (CBE) Recycling Fee", revenue: 130, units: 13, onHandTotal: 0 },
        { vendorModel: "MLB-LT-2500", name: "Mulberry Lifetime Care Plan", revenue: 3880, units: 10 },
        { vendorModel: "BATTERY", name: "BATTERY", revenue: 142, units: 8, department: "BATTERY" },
        { vendorModel: "MV064-SL", name: "Diamond hoops", revenue: 3192, units: 8, onHandTotal: 4, department: "EARRINGS" },
        { vendorModel: "Unknown model", name: "Unknown model", revenue: 900, units: 2 },
      ],
      [{ vendorModel: "MV064-SL", name: "Diamond hoops", revenue: 1000, units: 2 }],
      "fresh"
    );
    expect(freshOnly.map((line) => line.name)).toEqual([]);
    const returning = modelLines(
      [
        { vendorModel: "MV064-SL", name: "Diamond hoops", revenue: 3192, units: 8 },
        { vendorModel: "NEW-1", name: "New hoop", revenue: 500, units: 1 },
      ],
      [{ vendorModel: "MV064-SL", name: "Diamond hoops", revenue: 1000, units: 2 }],
      "returning"
    );
    expect(returning.map((line) => line.name)).toEqual(["MV064-SL"]);
    expect(returning[0]?.delta).toBeCloseTo(((3192 - 1000) / 1000) * 100);
    const fresh = modelLines(
      [
        { vendorModel: "MV064-SL", name: "Diamond hoops", revenue: 3192, units: 8 },
        { vendorModel: "NEW-1", name: "New hoop", revenue: 500, units: 1 },
      ],
      [{ vendorModel: "MV064-SL", name: "Diamond hoops", revenue: 1000, units: 2 }],
      "fresh"
    );
    expect(fresh.map((line) => line.name)).toEqual(["NEW-1"]);
    expect(fresh[0]?.delta).toBeNull();
    expect(fresh[0]?.lyRevenue).toBeNull();
  });

  it("locks September 1–21 to the same dates last year and drops unknown buckets", () => {
    expect(briefSameDatesLastYear("2026-09-01", "2026-09-21")).toEqual({
      from: "2025-09-01",
      to: "2025-09-21",
    });
    expect(isUnknownBriefName("Unknown department")).toBe(true);
    expect(isUnknownBriefName("Unknown vendor")).toBe(true);
    expect(isUnknownBriefName("Unknown class")).toBe(true);

    const edition = buildBriefEdition({
      from: "2026-09-01",
      to: "2026-09-21",
      compareFrom: "2025-09-01",
      compareTo: "2025-09-21",
      net: 1000,
      lyNet: 800,
      units: 10,
      models: [],
      lyModels: [],
      stores: [{ name: "VJ-HEND", revenue: 1000 }],
      lyStores: [],
      vendors: [
        { name: "Unknown vendor", revenue: 50 },
        { name: "Vendor A", revenue: 40 },
      ],
      lyVendors: [],
      people: [],
      lyPeople: [],
      pay: [],
      lyPay: [],
      showKash: false,
      departments: [
        { name: "Unknown department", revenue: 900, units: 9 },
        { name: "DIAMOND", revenue: 600, units: 4 },
        { name: "GOLD", revenue: 200, units: 3 },
      ],
      lyDepartments: [
        { name: "DIAMOND", revenue: 400, units: 3 },
        { name: "GOLD", revenue: 500, units: 6 },
      ],
      designs: [
        { name: "Unknown design", revenue: 300, units: 2 },
        { name: "SOLITAIRE", revenue: 250, units: 2 },
      ],
      lyDesigns: [{ name: "SOLITAIRE", revenue: 100, units: 1 }],
    });

    expect(edition.lyFrom).toBe("2025-09-01");
    expect(edition.lyTo).toBe("2025-09-21");
    expect(edition.sections[0]?.id).toBe("departments");
    expect(edition.headline).toBe("DIAMOND leads this September.");
    expect(edition.deck).toContain("same dates last year");
    const deptStories = edition.sections[0]!.stories;
    expect(deptStories.map((s) => s.title)).toEqual(["DIAMOND", "GOLD"]);
    expect(deptStories[0]?.kicker).toBe("Best this September");
    expect(deptStories[1]?.kicker).toBe("Furthest behind");
    expect(deptStories[0]?.figure).toBe("+50%");
    const designTitles = edition.sections.find((s) => s.id === "designs")!.stories.map((s) => s.title);
    expect(designTitles).toEqual(["SOLITAIRE"]);
    const vendorTitles = edition.sections.find((s) => s.id === "vendors")!.stories.map((s) => s.title);
    expect(vendorTitles).toEqual(["Vendor A"]);
    const lines = designLines(
      [
        { name: "Unknown design", revenue: 10 },
        { name: "HALO", revenue: 80, units: 2 },
      ],
      [{ name: "HALO", revenue: 40, units: 1 }]
    );
    expect(lines.map((line) => line.name)).toEqual(["HALO"]);
    expect(lines[0]?.delta).toBeCloseTo(100);
  });

  it("splits AJ, Shaun, and new stores and does not invent a new-store percent", () => {
    const edition = buildBriefEdition({
      from: "2026-09-01",
      to: "2026-09-21",
      compareFrom: "2025-09-01",
      compareTo: "2025-09-21",
      net: 4000,
      lyNet: 3800,
      units: 20,
      models: [],
      lyModels: [],
      stores: [
        { name: "Unknown store", revenue: 900, units: 2 },
        { name: "MAIN", revenue: 50, units: 1 },
        { name: "VJ-FRE", revenue: 800, units: 4 },
        { name: "VJ-DEER", revenue: 200, units: 2 },
        { name: "VJ-ONT", revenue: 500, units: 3 },
        { name: "VJ-HEND", revenue: 300, units: 2 },
        { name: "VJ-LIV", revenue: 400, units: 3 },
        { name: "DBC-STOCK", revenue: 100, units: 1 },
      ],
      lyStores: [
        { name: "VJ-FRE", revenue: 600, units: 3 },
        { name: "VJ-ONT", revenue: 700, units: 4 },
        { name: "VJ-LIV", revenue: 150, units: 1 },
        { name: "DBC-STOCK", revenue: 400, units: 2 },
      ],
      vendors: [],
      lyVendors: [],
      people: [],
      lyPeople: [],
      pay: [],
      lyPay: [],
      showKash: false,
    });
    const storeStories = edition.sections.find((s) => s.id === "stores")!.stories;
    expect(storeStories.map((s) => s.title)).toEqual([
      "AJ",
      "Shaun",
      "New stores",
      "VJ-LIV",
      "VJ-FRE",
      "DBC-STOCK",
      "VJ-ONT",
    ]);
    expect(storeStories[0]?.kicker).toBe("Ahead of last year");
    expect(storeStories[1]?.kicker).toBe("Ahead of last year");
    expect(storeStories[2]?.kicker).toBe("Opened this year");
    expect(storeStories[2]?.figure).toBe("$500");
    expect(storeStories[2]?.facts.find((f) => f.label === "Vs last year")?.value).toBe("—");
    expect(storeStories[3]?.kicker).toBe("Rose this September");
    expect(storeStories[5]?.kicker).toBe("Slipped this September");

    const ajLines = storeLines(
      [
        { name: "VJ-FRE", revenue: 800, units: 4 },
        { name: "VJ-DEER", revenue: 200, units: 2 },
        { name: "Unknown store", revenue: 90 },
      ],
      [{ name: "VJ-FRE", revenue: 600, units: 3 }],
      "aj"
    );
    expect(ajLines.map((line) => line.name)).toEqual(["VJ-FRE", "VJ-DEER"]);
    expect(ajLines[0]?.delta).toBeCloseTo(((800 - 600) / 600) * 100);
    expect(ajLines[1]?.delta).toBeNull();
    expect(ajLines[1]?.lyRevenue).toBeNull();
  });
});
