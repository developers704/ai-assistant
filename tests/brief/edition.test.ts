import { describe, expect, it } from "vitest";
import {
  briefHotStoreDay,
  briefMonthPace,
  briefPriorYear,
  briefReturnSpike,
  briefSameDatesLastYear,
  briefWindowRange,
  buildBriefEdition,
  costLines,
  designLines,
  expertiseLeaders,
  forecastTwoWeeks,
  modelLines,
  payLines,
  formatSignedPct,
  isUnknownBriefName,
  pctDelta,
  storeLines,
  watchLines,
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

  it("groups pay into cash, card, and financing and drops store prefixes", () => {
    const edition = buildBriefEdition({
      from: "2026-09-01",
      to: "2026-09-21",
      compareFrom: "2025-09-01",
      compareTo: "2025-09-21",
      net: 1000,
      lyNet: 900,
      units: 10,
      models: [],
      lyModels: [],
      stores: [],
      lyStores: [],
      vendors: [],
      lyVendors: [],
      people: [],
      lyPeople: [],
      pay: [
        { name: "VJS-CASH", revenue: 100 },
        { name: "CASH", revenue: 50 },
        { name: "CC", revenue: 400 },
        { name: "DBCST-ACIM", revenue: 80 },
        { name: "ACIMA", revenue: 20 },
        { name: "VJS", revenue: 30 },
        { name: "MULBRY", revenue: 15 },
        { name: "GE", revenue: 200 },
      ],
      lyPay: [
        { name: "CASH", revenue: 200 },
        { name: "CC", revenue: 300 },
        { name: "SYNC", revenue: 100 },
        { name: "ACIMA", revenue: 50 },
      ],
      showKash: false,
    });
    const pay = edition.sections.find((s) => s.id === "pay")!.stories;
    expect(pay.map((story) => story.title)).toEqual(["Card", "Financing", "Cash"]);
    expect(pay.map((story) => story.figure)).toEqual(["47%", "35%", "18%"]);
    expect(pay[0]?.facts.find((fact) => fact.label === "Applied")?.value).toBe("$400");
    expect(pay[2]?.facts.find((fact) => fact.label === "Applied")?.value).toBe("$150");
    expect(pay.find((story) => story.title === "Financing")?.facts.find((fact) => fact.label === "Applied")?.value).toBe("$300");
    const financing = pay.find((story) => story.title === "Financing")!;
    expect(financing.kicker).toBe("Heavier than last year");
    expect(financing.deck).toContain("share rose");
    const methods = payLines(
      [
        { name: "DBCST-ACIM", revenue: 80 },
        { name: "GE", revenue: 200 },
        { name: "VJS-CASH", revenue: 100 },
      ],
      [{ name: "SYNC", revenue: 100 }],
      "financing"
    );
    expect(methods.map((line) => line.name)).toEqual(["SYNC", "ACIMA"]);
    expect(methods[0]?.lyRevenue).toBe(100);
    expect(methods[1]?.delta).toBeNull();
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

  it("separates watches, Kash piles, design strength, flags, and September pace", () => {
    const daily = Array.from({ length: 21 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      const net = index >= 14 ? 50 : 200;
      return { date: `2026-09-${day}`, net, units: 1, returns: index === 10 ? 9000 : 100 };
    });
    const edition = buildBriefEdition({
      from: "2026-09-01",
      to: "2026-09-21",
      compareFrom: "2025-09-01",
      compareTo: "2025-09-21",
      net: 2100,
      lyNet: 2000,
      units: 20,
      models: [
        {
          vendorModel: "DATEJUST",
          name: "DATEJUST",
          revenue: 12000,
          units: 2,
          kashCost: 8000,
          department: "ROLEX",
          storeCount: 1,
          leadStore: "VJ-FRE",
        },
        {
          vendorModel: "HOOP",
          name: "HOOP",
          revenue: 500,
          units: 5,
          kashCost: 200,
          department: "EARRINGS",
        },
        {
          vendorModel: "BAND",
          name: "BAND",
          revenue: 310,
          units: 1,
          kashCost: 300,
          department: "GOLD",
        },
      ],
      lyModels: [],
      stores: [
        { name: "VJ-FRE", revenue: 400 },
        { name: "VJ-LIV", revenue: 900 },
      ],
      lyStores: [
        { name: "VJ-FRE", revenue: 1000 },
        { name: "VJ-LIV", revenue: 200 },
      ],
      vendors: [],
      lyVendors: [],
      people: [],
      lyPeople: [],
      pay: [
        { name: "CC", revenue: 100 },
        { name: "SYNC", revenue: 900 },
      ],
      lyPay: [
        { name: "CC", revenue: 800 },
        { name: "SYNC", revenue: 200 },
      ],
      showKash: true,
      scopeLabel: null,
      watches: [
        { name: "VJ-FRE", revenue: 800, units: 2 },
        { name: "VJ-DEER", revenue: 100, units: 1 },
      ],
      lyWatches: [{ name: "VJ-FRE", revenue: 400, units: 1 }],
      expertise: [
        { department: "LADYS RING", design: "NOVELLO", person: "Sara (SN)", revenue: 800, units: 4 },
        { department: "LADYS RING", design: "NOVELLO", person: "Pat (SP)", revenue: 200, units: 1 },
        { department: "GOLD", design: "GOLD JEWL", person: "Pat (SP)", revenue: 100, units: 1 },
      ],
      daily,
      hotDay: { store: "VJ-LIV", date: "2026-09-04", net: 20000, average: 4000 },
      departments: [
        { name: "LADYS RING", revenue: 600 },
        { name: "GOLD", revenue: 200 },
        { name: "EARRINGS", revenue: 150 },
        { name: "ROLEX", revenue: 100 },
      ],
      lyDepartments: [
        { name: "ROLEX", revenue: 900 },
        { name: "GOLD", revenue: 400 },
        { name: "EARRINGS", revenue: 200 },
        { name: "LADYS RING", revenue: 300 },
      ],
      designs: [{ name: "NOVELLO", revenue: 800 }],
      lyDesigns: [],
    });

    expect(edition.sections.find((s) => s.id === "watches")?.stories[0]?.title).toBe("Watches");
    expect(watchLines(
      [{ name: "VJ-DEER", revenue: 100, units: 1 }, { name: "VJ-FRE", revenue: 800, units: 2 }],
      [{ name: "VJ-FRE", revenue: 400, units: 1 }]
    )[0]).toMatchObject({ name: "VJ-FRE", delta: 100 });
    expect(watchLines(
      [{ name: "VJ-DEER", revenue: 100 }],
      []
    )[0]?.delta).toBeNull();

    const cost = edition.sections.find((s) => s.id === "cost")!.stories.map((s) => s.title);
    expect(cost).toContain("Under Kash cost");
    expect(cost).toContain("Near Kash cost");
    const under = costLines(
      [{ vendorModel: "HOOP", name: "HOOP", revenue: 500, units: 5, kashCost: 200 }],
      "under"
    );
    expect(under[0]?.note).toContain("under");
    expect(under[0]?.note).toContain("Kash cost");

    const people = edition.sections.find((s) => s.id === "people")!.stories;
    expect(people[0]?.title).toBe("Sara (SN)");
    expect(people[0]?.kicker).toBe("Strong in NOVELLO");
    expect(expertiseLeaders(
      [{ department: "GOLD", design: "GOLD JEWL", person: "Pat (SP)", revenue: 900, units: 2 }],
      { department: "LADYS RING" }
    )).toEqual([]);

    const scoped = buildBriefEdition({
      from: "2026-09-01",
      to: "2026-09-21",
      compareFrom: "2025-09-01",
      compareTo: "2025-09-21",
      net: 600,
      lyNet: 300,
      units: 4,
      models: [],
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
      scopeLabel: "LADYS RING",
      designs: [{ name: "NOVELLO", revenue: 600 }],
      daily: [],
    });
    expect(scoped.headline).toBe("NOVELLO leads LADYS RING.");

    const notes = edition.sections.find((s) => s.id === "notes")!.stories;
    expect(notes[0]?.kicker).toBe("Pace");
    expect(notes[0]?.deck).toContain("pace, not a forecast");
    expect(notes[0]?.deck).toContain("slowed");
    expect(notes.filter((s) => s.kicker === "Recommendation")).toHaveLength(3);
    expect(notes.some((s) => s.id === "flag:store-day")).toBe(true);
    expect(notes.some((s) => s.id === "flag:returns")).toBe(true);
    expect(notes.some((s) => s.id === "flag:model" && s.title === "DATEJUST")).toBe(true);
    expect(notes.some((s) => s.id === "flag:pay" && s.title === "SYNC")).toBe(true);
    expect(notes.some((s) => s.id === "flag:department" && s.title === "ROLEX")).toBe(true);

    const pace = briefMonthPace({
      from: "2026-09-01",
      to: "2026-09-21",
      net: 2100,
      daily: daily.map((day) => ({ date: day.date, net: 100 })),
    });
    expect(pace.dayCount).toBe(21);
    expect(pace.restDays).toBe(9);
    expect(pace.dailyPace).toBeCloseTo(100);
    expect(pace.rest).toBeCloseTo(900);
    expect(pace.slowed).toBe(false);
    expect(briefMonthPace({ from: "2026-09-01", to: "2026-09-21", net: 2100, daily }).slowed).toBe(true);

    expect(briefHotStoreDay([
      { store: "MAIN", date: "2026-09-01", net: 50000 },
      { store: "VJ-LIV", date: "2026-09-01", net: 1000 },
      { store: "VJ-LIV", date: "2026-09-02", net: 1000 },
      { store: "VJ-LIV", date: "2026-09-03", net: 12000 },
    ])).toMatchObject({ store: "VJ-LIV", date: "2026-09-03" });
    expect(briefReturnSpike(daily)?.date).toBe("2026-09-11");
  });
});
