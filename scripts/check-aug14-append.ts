/**
 * Post-append sanity: Aug 14 rows land in the live sales seed.
 * Run: npx tsx scripts/check-aug14-append.ts
 */
import assert from "node:assert/strict";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";

const rows = loadRankRows() ?? [];
const byDate = new Map<string, number>();
for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1);

const recent = [...byDate.keys()].filter((d) => d >= "2026-08-08").sort();
const aug14 = rows.filter((r) => r.date === "2026-08-14");

assert.ok(aug14.length > 0, "Aug 14 rows must exist after append");

const netSales = aug14.reduce((s, r) => s + r.netRevenue, 0);

console.log("check-aug14-append: ok", {
  recentDays: recent.map((d) => `${d}=${byDate.get(d)}`),
  aug14Rows: aug14.length,
  aug14NetSales: +netSales.toFixed(2),
  aug14ReturnLines: aug14.filter((r) => r.quantity < 0).length,
  aug14Stores: new Set(aug14.map((r) => r.storeName)).size,
});
