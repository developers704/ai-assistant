/**
 * Verify Aug 15 + Aug 16 sales append vs source CSVs, and Discounting rules.
 * Run: npx tsx scripts/verify-aug15-16.ts
 */
import assert from "node:assert/strict";
import fs from "fs";
import Papa from "papaparse";
import { detectHighDiscounts } from "../src/lib/discounting/detect-high-discounts";
import {
  loadTxnPaySplits,
  parseTxnPaySplitsCsv,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";
import { normalizeDailySalesCsv } from "../src/lib/reports/normalize-daily-sales-csv";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";

function loadSource(path: string) {
  const csv = normalizeDailySalesCsv(fs.readFileSync(path, "utf8"));
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return parseVendorPosRows(parsed.data ?? []).rows;
}

const src15 = loadSource(
  "c:/Users/ACCTON-PC-KM-MR-60/OneDrive/Attachments/Desktop/15 aug report.CSV"
);
const src16 = loadSource(
  "c:/Users/ACCTON-PC-KM-MR-60/OneDrive/Attachments/Desktop/aug-16.CSV"
);

const live = loadRankRows() ?? [];
const live15 = live.filter((r) => r.date === "2026-08-15");
const live16 = live.filter((r) => r.date === "2026-08-16");

function net(rows: { netRevenue: number }[]): number {
  return rows.reduce((s, r) => s + r.netRevenue, 0);
}

assert.equal(live15.length, src15.length, "Aug 15 row count vs source");
assert.equal(live16.length, src16.length, "Aug 16 row count vs source");
assert.ok(Math.abs(net(live15) - net(src15)) < 0.02, "Aug 15 Net Sales vs source Total");
assert.ok(Math.abs(net(live16) - net(src16)) < 0.02, "Aug 16 Net Sales vs source Total");

const pay15 = parseTxnPaySplitsCsv(
  fs.readFileSync(
    "c:/Users/ACCTON-PC-KM-MR-60/OneDrive/Attachments/Desktop/discounting-15.CSV",
    "utf8"
  )
);
const pay16 = parseTxnPaySplitsCsv(
  fs.readFileSync(
    "c:/Users/ACCTON-PC-KM-MR-60/OneDrive/Attachments/Desktop/16-discountingr.CSV",
    "utf8"
  )
);
const overlay = loadTxnPaySplits(true);
assert.ok(pay15.size > 0, "Aug 15 paycode file parses");
assert.ok(pay16.size > 0, "Aug 16 paycode file parses");
for (const tid of pay15.keys()) {
  assert.ok(overlay.has(tid), `overlay missing Aug 15 txn ${tid}`);
}
for (const tid of pay16.keys()) {
  assert.ok(overlay.has(tid), `overlay missing Aug 16 txn ${tid}`);
}

const d15 = detectHighDiscounts({ filterDate: "2026-08-15" });
const d16 = detectHighDiscounts({ filterDate: "2026-08-16" });
assert.equal(d15.filterDate, "2026-08-15");
assert.equal(d16.filterDate, "2026-08-16");
assert.ok(d15.availableDates.includes("2026-08-15"));
assert.ok(d16.availableDates.includes("2026-08-16"));
assert.ok(d15.availableDates.every((d) => d.startsWith("2026-08")));

const returnTxns15 = new Set(
  live15.filter((r) => r.quantity < 0 || r.netRevenue < 0).map((r) => r.transactionId)
);
const returnTxns16 = new Set(
  live16.filter((r) => r.quantity < 0 || r.netRevenue < 0).map((r) => r.transactionId)
);
assert.equal(
  d15.hits.filter((h) => returnTxns15.has(h.transactionId)).length,
  0,
  "Aug 15 flags must skip return txns"
);
assert.equal(
  d16.hits.filter((h) => returnTxns16.has(h.transactionId)).length,
  0,
  "Aug 16 flags must skip return txns"
);

for (const hit of [...d15.hits, ...d16.hits]) {
  assert.ok(hit.overageDollars > 0.01, `${hit.transactionId} overage must be positive`);
  assert.ok(
    hit.soldTotal > hit.ceilingAmount + 0.01,
    `${hit.transactionId} calc must exceed Payment Amt ceiling`
  );
}

const sample15 = [...pay15.keys()].slice(0, 3).map((tid) => {
  const s = overlay.get(tid)!;
  return { tid, ...summarizePaySplit(s) };
});

console.log("verify-aug15-16: ok", {
  sales: {
    aug15: {
      rows: live15.length,
      net: +net(live15).toFixed(2),
      returns: returnTxns15.size,
      stores: new Set(live15.map((r) => r.storeName)).size,
    },
    aug16: {
      rows: live16.length,
      net: +net(live16).toFixed(2),
      returns: returnTxns16.size,
      stores: new Set(live16.map((r) => r.storeName)).size,
    },
  },
  paycodes: {
    file15Txns: pay15.size,
    file16Txns: pay16.size,
    overlay: overlay.size,
    sample15,
  },
  discounting: {
    aug15Flags: d15.hits.length,
    aug16Flags: d16.hits.length,
    scanned15: d15.scannedProductLines,
    scanned16: d16.scannedProductLines,
    top15: d15.hits.slice(0, 3).map((h) => ({
      txn: h.transactionId,
      store: h.store,
      sku: h.sku,
      calc: +h.soldTotal.toFixed(2),
      ceiling: +h.ceilingAmount.toFixed(2),
      over: +h.overageDollars.toFixed(2),
      pay: h.payCode,
      approver: h.approver.code,
    })),
    top16: d16.hits.slice(0, 3).map((h) => ({
      txn: h.transactionId,
      store: h.store,
      sku: h.sku,
      calc: +h.soldTotal.toFixed(2),
      ceiling: +h.ceilingAmount.toFixed(2),
      over: +h.overageDollars.toFixed(2),
      pay: h.payCode,
      approver: h.approver.code,
    })),
  },
});
