/**
 * Verify Aug 15–16 sales + paycode files landed.
 * Run: npx tsx scripts/check-aug15-16-append.ts
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { detectHighDiscounts } from "../src/lib/discounting/detect-high-discounts";
import {
  loadTxnPaySplits,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";

const rows = loadRankRows() ?? [];
const byDate = new Map<string, number>();
for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1);

for (const d of ["2026-08-15", "2026-08-16"]) {
  assert.ok((byDate.get(d) ?? 0) > 0, `${d} sales rows missing`);
}

const dir = path.join(process.cwd(), "data", "discounting", "paycodes");
assert.ok(fs.existsSync(path.join(dir, "2026-08-15.csv")));
assert.ok(fs.existsSync(path.join(dir, "2026-08-16.csv")));

const splits = loadTxnPaySplits(true);
let multi = 0;
let single = 0;
for (const [, s] of splits) {
  const sum = summarizePaySplit(s);
  if (sum.isMultiTender) multi++;
  else if (sum.singleChannel) single++;
}

const d15 = detectHighDiscounts({ filterDate: "2026-08-15" });
const d16 = detectHighDiscounts({ filterDate: "2026-08-16" });

console.log("check-aug15-16-append: ok", {
  recentDays: [...byDate.keys()]
    .filter((d) => d >= "2026-08-11")
    .sort()
    .map((d) => `${d}=${byDate.get(d)}`),
  aug15: {
    rows: byDate.get("2026-08-15"),
    net: +rows
      .filter((r) => r.date === "2026-08-15")
      .reduce((s, r) => s + r.netRevenue, 0)
      .toFixed(2),
    flags: d15.hits.length,
  },
  aug16: {
    rows: byDate.get("2026-08-16"),
    net: +rows
      .filter((r) => r.date === "2026-08-16")
      .reduce((s, r) => s + r.netRevenue, 0)
      .toFixed(2),
    flags: d16.hits.length,
  },
  paycodes: fs.readdirSync(dir).filter((f) => /\.csv$/i.test(f)).sort(),
  overlayTxnCount: splits.size,
  multiTenderTxns: multi,
  singleTenderTxns: single,
});
