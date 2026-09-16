/**
 * Post-append sanity: Sep 15 2026 sales + payments + Kash CP + onhand.
 * Run: npx tsx scripts/check-sep15-append.ts
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";
import { querySales } from "../src/lib/sales/query-sales";
import {
  listPaycodes,
  parsePaycodeLegs,
  paycodeTotalsForPaymentWindow,
} from "../src/lib/sales/paycode-overlay";
import { leakedPaycodeAliases } from "../src/lib/sales/paycode-normalize";
import { normalizeDailySalesCsv } from "../src/lib/reports/normalize-daily-sales-csv";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import { getTopVendorModels } from "../src/lib/sales/sales-product-analysis";
import { groupRows } from "../src/lib/sales/sales-aggregate";
import { creditSalespersonRows } from "../src/lib/sales/salesperson-credit";
import { canSeeKashCostPrice } from "../src/lib/auth/user-permissions";
import { hasOnhandData } from "../src/lib/inventory/onhand";
import { signedKashInventoryCost } from "../src/lib/sales/top-models-wholesale-margin";

function parseMoney(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const s = String(raw)
    .trim()
    .replace(/[$,]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const DAY = "2026-09-15";
const dailyPath =
  process.argv[2] ||
  "c:\\Users\\ACCTON-PC-KM-MR-60\\OneDrive\\Attachments\\Desktop\\sale-15spet.CSV";
const payDailyPath =
  process.argv[3] ||
  "c:\\Users\\ACCTON-PC-KM-MR-60\\OneDrive\\Attachments\\Desktop\\payment-15spet.CSV";

const cleaned = normalizeDailySalesCsv(fs.readFileSync(dailyPath, "utf8"));
const parsed = Papa.parse<Record<string, unknown>>(cleaned, {
  header: true,
  skipEmptyLines: true,
});
const dailyRows = parseVendorPosRows(parsed.data ?? []).rows;
const dailyNet = dailyRows.reduce((s, r) => s + (Number(r.netRevenue) || 0), 0);
const csvTotalCol = parsed.data.reduce((s, r) => s + parseMoney(r.Total ?? r.total), 0);
const dailyInvCost = dailyRows.reduce((s, r) => s + signedKashInventoryCost(r), 0);

const rows = loadRankRows() ?? [];
const sep15 = rows.filter((r) => r.date === DAY);
const sep14 = rows.filter((r) => r.date === "2026-09-14");
const net15 = sep15.reduce((s, r) => s + r.netRevenue, 0);
const seedInvCost = sep15.reduce((s, r) => s + signedKashInventoryCost(r), 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();

assert.ok(sep15.length > 0, "Sep 15 rows must exist after append");
assert.equal(dates.at(-1), DAY);
assert.ok(sep14.length > 0, "Sep 14 must still be present");
assert.ok(Math.abs(net15 - dailyNet) < 0.05, `seed ${net15} vs daily parse ${dailyNet}`);
assert.ok(Math.abs(dailyNet - csvTotalCol) < 0.05, `parsed ${dailyNet} vs CSV Total ${csvTotalCol}`);
assert.ok(
  Math.abs(seedInvCost - dailyInvCost) < 0.05,
  `Inventory Cost seed ${seedInvCost} vs daily ${dailyInvCost}`
);

// Historical rows keep Inventory Cost for CP (Kash)
const before = rows.filter((r) => r.date && r.date < DAY && (Number(r.inventoryCost) || 0) > 0);
assert.ok(before.length > 1000, "historical Inventory Cost should already be on seed rows");

const stores = groupRows(sep15, "store", null, "netSales", "desc");
const depts = groupRows(sep15, "department", null, "netSales", "desc");
const people = creditSalespersonRows(sep15);
const storeNet = stores.reduce((s, r) => s + r.netSales, 0);
assert.ok(Math.abs(storeNet - net15) < 0.05, `stores ${storeNet} != net ${net15}`);

const models = getTopVendorModels(sep15, { limit: 25, sortBy: "quantity" });
const withKash = models.filter((m) => m.kashCost != null && Number(m.kashCost) !== 0);
assert.ok(withKash.length > 0, "Top Models must expose Kash CP from Inventory Cost");

assert.equal(canSeeKashCostPrice("kash", "admin"), true);
assert.equal(canSeeKashCostPrice("ross", null), true);
assert.equal(canSeeKashCostPrice("admin", "admin"), true);
assert.equal(canSeeKashCostPrice("marina", null), false);
assert.equal(canSeeKashCostPrice("aj", null), false);

assert.ok(hasOnhandData(), "onhand snapshot must be loaded");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: DAY, endDate: DAY },
    resetContext: true,
    exactFilters: true,
    include: {
      summary: true,
      topStores: true,
      topDepartments: true,
      topSalesPeople: true,
      topVendorModels: true,
    },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - net15) < 0.02);

  const qModels = q.rankings?.topVendorModels ?? [];
  assert.ok(
    qModels.some((m) => m.kashCost != null && Number(m.kashCost) !== 0),
    "querySales topVendorModels missing kashCost"
  );

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({ from: DAY, to: DAY, legs });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  assert.ok(paySum > 0, "Sep 15 paycodes must have Applied Amt");

  // Daily payment file Applied Amt should match window totals (full file may include CR/OL)
  const dailyPay = Papa.parse<Record<string, unknown>>(fs.readFileSync(payDailyPath, "utf8"), {
    header: true,
    skipEmptyLines: true,
  });
  const dailyApplied = dailyPay.data.reduce((s, r) => s + parseMoney(r["Applied Amt"]), 0);

  console.log("check-sep15-append: ok", {
    dailyFileRows: dailyRows.length,
    seedSep15Rows: sep15.length,
    seedSep15NetSales: +net15.toFixed(2),
    csvTotal: +csvTotalCol.toFixed(2),
    inventoryCostSigned: +seedInvCost.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    stores: stores.length,
    departments: depts.length,
    salespeople: people.length,
    topStore: stores[0] ? { name: stores[0].name, net: +stores[0].netSales.toFixed(2) } : null,
    topDept: depts[0] ? { name: depts[0].name, net: +depts[0].netSales.toFixed(2) } : null,
    topPerson: people[0]
      ? { name: people[0].name, net: +people[0].netSales.toFixed(2) }
      : null,
    sampleKashCp: withKash[0]
      ? {
          model: withKash[0].vendorModel || withKash[0].name,
          kashCost: withKash[0].kashCost,
          margin: withKash[0].estimatedMargin,
        }
      : null,
    paycodeWindowApplied: +paySum.toFixed(2),
    dailyPaymentAppliedAmt: +dailyApplied.toFixed(2),
    paycodes: totals.slice(0, 8).map((t) => ({ name: t.name, amt: +t.revenue.toFixed(2) })),
    historicalRowsWithInventoryCost: before.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
