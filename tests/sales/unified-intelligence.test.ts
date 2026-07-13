import { describe, expect, it, beforeAll } from "vitest";
import { summarizeRows, filterRows, groupRows } from "@/lib/sales/sales-aggregate";
import { resolveDateRange, detectRelativeDate, todayIso, addDays } from "@/lib/sales/sales-date-resolver";
import { buildSalesDashboardSnapshot } from "@/lib/sales/snapshot/builder";
import { salesDashboardSnapshotSchema } from "@/lib/sales/snapshot/schema";
import { SALES_METRICS } from "@/lib/sales/metrics/definitions";
import { matchEntity, buildEntityIndex } from "@/lib/sales/sales-normalizer";
import type { VendorPosRow } from "@/lib/reports/types";
import {
  hashSalesSource,
  makeDataVersion,
  writeSalesVersion,
  writeActivePointer,
  readActiveSnapshot,
  readActivePointer,
} from "@/lib/sales/data/version-store";
import { invalidateSalesQueryCache, salesQueryCacheKey, setSalesQueryCache, getSalesQueryCache } from "@/lib/sales/query-cache";
import { setActiveSalesContext, getActiveSalesContext, clearActiveSalesContext } from "@/lib/sales/active-context";

function row(partial: Partial<VendorPosRow> & Pick<VendorPosRow, "date" | "storeName" | "netRevenue">): VendorPosRow {
  return {
    transactionId: partial.transactionId ?? "T1",
    department: partial.department ?? "LADYS RING",
    design: partial.design ?? "NOVELLO",
    itemNumber: partial.itemNumber ?? "1",
    sku: partial.sku ?? "1",
    style: partial.style ?? "",
    description: partial.description ?? "Ring",
    vendor: partial.vendor ?? "MHVR",
    vendorModel: partial.vendorModel ?? "VM1",
    productClass: partial.productClass ?? "RING",
    subClass: partial.subClass ?? "",
    quantity: partial.quantity ?? 1,
    inventoryCost: partial.inventoryCost ?? 50,
    grossSales: partial.grossSales ?? partial.netRevenue + 10,
    discountAmount: partial.discountAmount ?? 10,
    margin: partial.margin ?? partial.netRevenue - 50,
    discountRate: partial.discountRate ?? 0.1,
    imageDir: partial.imageDir ?? "",
    ...partial,
  };
}

const SAMPLE: VendorPosRow[] = [
  row({ date: "2026-07-10", storeName: "Great Mall", netRevenue: 1000, transactionId: "A1", design: "NOVELLO", department: "LADYS RING" }),
  row({ date: "2026-07-10", storeName: "Great Mall", netRevenue: 500, transactionId: "A2", design: "OVANI", department: "LADYS RING" }),
  row({ date: "2026-07-11", storeName: "Valley Fair", netRevenue: 800, transactionId: "B1", design: "NOVELLO", department: "MENS RING" }),
  row({ date: "2026-07-12", storeName: "Great Mall", netRevenue: 200, transactionId: "C1", design: "NOVELLO", department: "LADYS RING", quantity: -1, inventoryCost: 0 }),
];

describe("sales metrics registry", () => {
  it("defines net_sales and average_ticket formulas", () => {
    expect(SALES_METRICS.net_sales.formula).toContain("netRevenue");
    expect(SALES_METRICS.average_ticket.formula).toContain("transactions");
  });
});

describe("sales aggregation", () => {
  it("computes net, units, distinct transactions, average ticket", () => {
    const s = summarizeRows(SAMPLE.slice(0, 3));
    expect(s.netSales).toBe(2300);
    expect(s.unitsSold).toBe(3);
    expect(s.transactions).toBe(3);
    expect(s.averageTicket).toBeCloseTo(2300 / 3);
  });

  it("supports multi-filter combinations", () => {
    const filtered = filterRows(SAMPLE, {
      stores: ["Great Mall"],
      designs: ["NOVELLO"],
      departments: ["LADYS RING"],
      dates: ["2026-07-10"],
    });
    expect(filtered).toHaveLength(1);
    expect(summarizeRows(filtered).netSales).toBe(1000);
  });

  it("groups by department", () => {
    const groups = groupRows(SAMPLE.slice(0, 3), "department");
    expect(groups[0].name).toBe("LADYS RING");
  });

  it("distinguishes zero sales from empty filter", () => {
    const empty = filterRows(SAMPLE, { stores: ["No Such Store"] });
    expect(empty).toHaveLength(0);
    const zero = summarizeRows([]);
    expect(zero.netSales).toBe(0);
  });
});

describe("sales date resolver", () => {
  const dates = ["2026-07-10", "2026-07-11", "2026-07-12"];

  it("resolves yesterday / kal", () => {
    const rel = detectRelativeDate("kal ki sales");
    expect(rel?.type).toBe("yesterday");
  });

  it("resolves day before yesterday / parson", () => {
    const rel = detectRelativeDate("parson sales");
    expect(rel?.type).toBe("day_before_yesterday");
  });

  it("marks today unavailable when report ends earlier", () => {
    const resolved = resolveDateRange({ type: "today" }, dates);
    // today is 2026-07-09 per user_info? Actually system date is Jul 13 2026 from earlier
    // If today not in dates, unavailableReason is set
    if (!dates.includes(todayIso())) {
      expect(resolved.unavailableReason || resolved.dates.length === 0).toBeTruthy();
    }
  });

  it("intersects custom ranges with available dates", () => {
    const resolved = resolveDateRange(
      { type: "custom", startDate: "2026-07-10", endDate: "2026-07-11" },
      dates
    );
    expect(resolved.dates).toEqual(["2026-07-10", "2026-07-11"]);
  });
});

describe("sales aliases", () => {
  it("resolves Novelo and Gray Mall style aliases via entity index", () => {
    const index = buildEntityIndex(SAMPLE);
    const design = matchEntity("novelo", index.designs, "design");
    expect(design.status === "exact" || design.status === "fuzzy").toBe(true);
    if (design.status === "exact" || design.status === "fuzzy") {
      expect(design.value.toUpperCase()).toContain("NOVELLO");
    }
    const store = matchEntity("gray mall", index.stores, "store");
    expect(store.status === "exact" || store.status === "fuzzy").toBe(true);
  });
});

describe("sales snapshot", () => {
  it("builds a valid Zod snapshot", () => {
    const snapshot = buildSalesDashboardSnapshot({
      dataVersion: "sales_test_001",
      rows: SAMPLE,
      fileName: "test.csv",
      fileHash: "abc",
    });
    const parsed = salesDashboardSnapshotSchema.safeParse(snapshot);
    expect(parsed.success).toBe(true);
    expect(snapshot.summary.netSales).toBe(summarizeRows(SAMPLE).netSales);
    expect(snapshot.rankings.stores.length).toBeGreaterThan(0);
    expect(snapshot.dataThrough).toBe("2026-07-12");
  });
});

describe("version store + cache", () => {
  beforeAll(() => {
    const version = makeDataVersion();
    const snapshot = buildSalesDashboardSnapshot({
      dataVersion: version,
      rows: SAMPLE,
      fileHash: hashSalesSource("sample"),
    });
    writeSalesVersion({
      dataVersion: version,
      metadata: {
        dataVersion: version,
        fileHash: hashSalesSource("sample"),
        generatedAt: new Date().toISOString(),
        refreshedAt: new Date().toISOString(),
        dataThrough: "2026-07-12",
        rowCount: SAMPLE.length,
        validRowCount: SAMPLE.length,
        rejectedRowCount: 0,
        dateRange: { from: "2026-07-10", to: "2026-07-12" },
        warnings: [],
      },
      snapshot,
      rows: SAMPLE,
    });
    writeActivePointer(version);
  });

  it("activates snapshot atomically", () => {
    const pointer = readActivePointer();
    expect(pointer.activeVersion).toBeTruthy();
    const snap = readActiveSnapshot();
    expect(snap?.summary.netSales).toBe(summarizeRows(SAMPLE).netSales);
  });

  it("invalidates cache across versions", () => {
    const v = readActivePointer().activeVersion!;
    const key = salesQueryCacheKey(v, { stores: ["Great Mall"] });
    setSalesQueryCache(key, v, { ok: true });
    expect(getSalesQueryCache(key)).toEqual({ ok: true });
    invalidateSalesQueryCache();
    expect(getSalesQueryCache(key)).toBeNull();
  });
});

describe("active sales context", () => {
  it("stores dashboard filter inheritance state", () => {
    clearActiveSalesContext();
    setActiveSalesContext({
      stores: ["Great Mall"],
      designs: ["NOVELLO"],
      dateRange: { preset: "this_month", from: "2026-07-01", to: "2026-07-13" },
    });
    const ctx = getActiveSalesContext();
    expect(ctx.stores).toEqual(["Great Mall"]);
    expect(ctx.designs).toEqual(["NOVELLO"]);
  });
});

describe("freshness helpers", () => {
  it("addDays works for coverage math", () => {
    expect(addDays("2026-07-12", 1)).toBe("2026-07-13");
  });
});
