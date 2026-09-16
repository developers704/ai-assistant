/**
 * Replace live onhand with a new POS export (full snapshot, not a same-day merge).
 *
 * Umair / Cursor path:
 *   npx tsx scripts/append-onhand.ts <onhand.csv>
 *
 * Same as scripts/import-onhand.ts — collapse empty columns, fill Whole Cost
 * from Tag × CP divisor rules, write calculator + sales onhand copies.
 */
import fs from "fs";
import path from "path";
import { saveInventoryCsv, getInventoryStatus, invalidateInventoryCache, listInventoryItems } from "../src/lib/inventory/store";
import { invalidateOnhandCache, hasOnhandData } from "../src/lib/inventory/onhand";
import { isMainStore } from "../src/lib/inventory/mgmt-stores";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npx tsx scripts/append-onhand.ts <onhand.csv>");
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.error("File not found:", inputPath);
  process.exit(1);
}

const csvText = fs.readFileSync(inputPath, "utf8");
const fileName = path.basename(inputPath);
console.log("Appending onhand snapshot", inputPath, `(${csvText.length} bytes)`);

const { rowCount, wholeCostStats } = saveInventoryCsv(csvText, fileName);
invalidateOnhandCache();
invalidateInventoryCache();

const items = listInventoryItems();
const mainRows = items.filter((i) => isMainStore(i.store));
const status = getInventoryStatus();

console.log(
  JSON.stringify(
    {
      ok: true,
      fileName,
      rowCount,
      wholeCostStats,
      status,
      onhandLoaded: hasOnhandData(),
      mainStoreRows: mainRows.length,
      mainStoreOnhand: mainRows.reduce((s, i) => s + (Number(i.onHand) || 0), 0),
    },
    null,
    2
  )
);

if (!status.loaded || (status.rowCount ?? 0) < 1000) {
  console.error("Onhand append looked empty.");
  process.exit(1);
}
