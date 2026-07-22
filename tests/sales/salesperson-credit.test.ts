import { describe, expect, it } from "vitest";
import {
  creditSalespersonRows,
  parseSalespersonSplits,
} from "@/lib/sales/salesperson-credit";
import {
  clearSalespersonDirectoryCache,
  formatSalespersonName,
  parseSalespersonDirectoryCsv,
  resolveSalespersonLabelWithCode,
} from "@/lib/sales/salesperson-directory";
import { summarizeVendorPos } from "@/lib/reports/vendor-pos";
import type { VendorPosRow } from "@/lib/reports/types";

describe("parseSalespersonSplits", () => {
  it("parses single 100% with trailing dash", () => {
    expect(parseSalespersonSplits("SG1/100% - ")).toEqual([
      { code: "SG1", percent: 100 },
    ]);
  });

  it("parses SN/SP split from real export", () => {
    expect(parseSalespersonSplits("SN/65% - SP/35% -")).toEqual([
      { code: "SN", percent: 65 },
      { code: "SP", percent: 35 },
    ]);
  });

  it("parses three-way split", () => {
    expect(parseSalespersonSplits("RJ1/40% - SD/20% - AG1/40% -")).toEqual([
      { code: "RJ1", percent: 40 },
      { code: "SD", percent: 20 },
      { code: "AG1", percent: 40 },
    ]);
  });
});

describe("salesperson directory", () => {
  it("maps codes to first + last name", () => {
    clearSalespersonDirectoryCache();
    const dir = parseSalespersonDirectoryCsv(
      "Code,First Name,Last Name\nSN,SHAKIB,NAKHWA (ALI)\nSP,SHIELA,PACLIBAR\n"
    );
    expect(resolveSalespersonLabelWithCode("SN", dir)).toBe(
      "Shakib Nakhwa (Ali) (SN)"
    );
    expect(resolveSalespersonLabelWithCode("SP", dir)).toBe("Shiela Paclibar (SP)");
    expect(resolveSalespersonLabelWithCode("ZZ9", dir)).toBe("ZZ9");
  });

  it("title-cases names", () => {
    expect(formatSalespersonName("ANITA", "SAPRA")).toBe("Anita Sapra");
  });
});

describe("creditSalespersonRows", () => {
  it("credits 50/50 on a $100 line with names", () => {
    clearSalespersonDirectoryCache();
    const dir = parseSalespersonDirectoryCsv(
      "Code,First Name,Last Name\nAA,ANITA,SAPRA\nBB,BOB,BAKER\n"
    );
    const rows: VendorPosRow[] = [
      {
        date: "2026-07-16",
        transactionId: "T1",
        storeName: "VJ-TEST",
        department: "B",
        design: "NOVELLO",
        itemNumber: "1",
        sku: "1",
        style: "",
        description: "Ring",
        vendor: "V",
        vendorModel: "M1",
        productClass: "14KT",
        subClass: "",
        quantity: 1,
        inventoryCost: 40,
        grossSales: 100,
        discountAmount: 0,
        netRevenue: 100,
        margin: 60,
        discountRate: 0,
        imageDir: "",
        salespersons: "AA/50% - BB/50% -",
      },
    ];
    const credits = creditSalespersonRows(rows, dir);
    expect(credits).toHaveLength(2);
    expect(credits.find((c) => c.code === "AA")?.netSales).toBe(50);
    expect(credits.find((c) => c.code === "AA")?.name).toContain("Anita");
    expect(credits.find((c) => c.code === "BB")?.netSales).toBe(50);
  });
});

describe("summarizeVendorPos topSalesPeople", () => {
  it("puts 50/50 credit into topSalesPeople", () => {
    clearSalespersonDirectoryCache();
    const rows: VendorPosRow[] = [
      {
        date: "2026-07-16",
        transactionId: "T1",
        storeName: "VJ-TEST",
        department: "B",
        design: "X",
        itemNumber: "1",
        sku: "1",
        style: "",
        description: "Ring",
        vendor: "V",
        vendorModel: "M",
        productClass: "14KT",
        subClass: "",
        quantity: 1,
        inventoryCost: 40,
        grossSales: 100,
        discountAmount: 0,
        netRevenue: 100,
        margin: 60,
        discountRate: 0,
        imageDir: "",
        salespersons: "AA/50% - BB/50% -",
      },
    ];
    const { summary } = summarizeVendorPos(rows, {
      period: "daily",
      schema: "store_sales",
      reportCategory: "sales",
    });
    expect(summary.topSalesPeople).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "AA", revenue: 50 }),
        expect.objectContaining({ code: "BB", revenue: 50 }),
      ])
    );
    expect(summary.totalRevenue).toBe(100);
  });
});
