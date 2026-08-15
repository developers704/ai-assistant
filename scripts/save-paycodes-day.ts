/**
 * Save a daily paycode CSV into data/discounting/paycodes/{YYYY-MM-DD}.csv
 * Run: npx tsx scripts/save-paycodes-day.ts <paycode.csv> [YYYY-MM-DD]
 */
import fs from "fs";
import path from "path";
import { saveTxnPaycodesCsv } from "../src/lib/discounting/save-txn-paycodes";
import {
  clearTxnPayCodesCache,
  loadTxnPaySplits,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";

const src = process.argv[2];
const preferredDate = process.argv[3] || null;

if (!src || !fs.existsSync(src)) {
  console.error("Usage: npx tsx scripts/save-paycodes-day.ts <paycode.csv> [YYYY-MM-DD]");
  process.exit(1);
}

const saved = saveTxnPaycodesCsv(fs.readFileSync(src, "utf8"), {
  preferredDate,
});
clearTxnPayCodesCache();
const splits = loadTxnPaySplits(true);

let multi = 0;
let single = 0;
for (const [, s] of splits) {
  const sum = summarizePaySplit(s);
  if (sum.isMultiTender) multi++;
  else if (sum.singleChannel) single++;
}

const dir = path.join(process.cwd(), "data", "discounting", "paycodes");

console.log(
  JSON.stringify(
    {
      saved,
      files: fs.readdirSync(dir).filter((f) => /\.csv$/i.test(f)).sort(),
      overlayTxnCount: splits.size,
      multiTenderTxns: multi,
      singleTenderTxns: single,
    },
    null,
    2
  )
);
