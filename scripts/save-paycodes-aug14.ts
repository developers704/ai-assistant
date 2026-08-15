/**
 * Save Desktop discounting-14.CSV → data/discounting/paycodes/2026-08-14.csv
 * Run: npx tsx scripts/save-paycodes-aug14.ts
 */
import fs from "fs";
import path from "path";
import { saveTxnPaycodesCsv } from "../src/lib/discounting/save-txn-paycodes";
import {
  clearTxnPayCodesCache,
  loadTxnPaySplits,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";

const src =
  process.argv[2] ||
  "c:/Users/ACCTON-PC-KM-MR-60/OneDrive/Attachments/Desktop/discounting-14.CSV";

const text = fs.readFileSync(src, "utf8");
const saved = saveTxnPaycodesCsv(text, { preferredDate: "2026-08-14" });
clearTxnPayCodesCache();
const splits = loadTxnPaySplits(true);

let multi = 0;
let single = 0;
for (const [, s] of splits) {
  const sum = summarizePaySplit(s);
  if (sum.isMultiTender) multi++;
  else if (sum.singleChannel) single++;
}

const outPath = path.join(
  process.cwd(),
  "data",
  "discounting",
  "paycodes",
  saved.fileName
);

console.log(
  JSON.stringify(
    {
      saved,
      bytes: fs.statSync(outPath).size,
      overlayTxnCount: splits.size,
      multiTenderTxns: multi,
      singleTenderTxns: single,
    },
    null,
    2
  )
);
