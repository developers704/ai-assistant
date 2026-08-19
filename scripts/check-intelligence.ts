/**
 * Self-check: intelligence report from Jan 2025–Aug 2026 customer sales CSV.
 * Run: npx tsx scripts/check-intelligence.ts
 */
import assert from "node:assert/strict";
import { buildIntelligenceReport } from "../src/lib/intelligence/build-report";
import {
  intelligenceSeedExists,
  loadIntelligenceRows,
} from "../src/lib/intelligence/load-rows";

assert.ok(intelligenceSeedExists(), "data/intelligence/sales-customer-jan25-aug26.csv missing");

const rows = loadIntelligenceRows(true);
assert.ok(rows.length > 200_000, `expected 200k+ rows, got ${rows.length}`);

const report = buildIntelligenceReport(rows);
assert.ok(report, "report must build");

assert.ok(report!.stores.length >= 30);
assert.ok(report!.bestStoreByDepartment.length > 0);
assert.ok(report!.bestStoreByDesign.length > 0);
assert.ok(report!.salespersons.length > 0);
assert.ok(report!.customers.retention.uniqueCustomers > 10_000);
assert.ok(report!.forecast.monthly.length > 0);
assert.ok(report!.issues.length >= 0);
assert.ok(report!.brief.length > 20);

const serraDept = report!.bestStoreByDepartment.find((r) => r.department.includes("RING"));
console.log("check-intelligence: ok", {
  rows: rows.length,
  net: report!.summary.netSales.toFixed(0),
  stores: report!.stores.length,
  customers: report!.summary.customerCount,
  repeatPct: report!.customers.retention.repeatRatePct,
  deptLeaders: report!.bestStoreByDepartment.length,
  designLeaders: report!.bestStoreByDesign.length,
  issues: report!.issues.length,
  sampleDept: serraDept,
  forecastNext: report!.forecast.projectedMonthNet,
});
