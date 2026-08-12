/**
 * Replace live inventory + onhand with a new onhand export.
 * Fills Whole Cost from Tag × CP Divisor rules.
 *
 * Usage:
 *   npx tsx scripts/import-onhand.ts "C:\\...\\onhand-12aug.CSV"
 */
import fs from "fs";
import path from "path";
import { saveInventoryCsv, getInventoryStatus, invalidateInventoryCache } from "../src/lib/inventory/store";
import { invalidateOnhandCache, hasOnhandData, lookupOnhandQty } from "../src/lib/inventory/onhand";

const inputPath =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || "",
    "OneDrive",
    "Attachments",
    "Desktop",
    "onhand-12aug.CSV"
  );

if (!fs.existsSync(inputPath)) {
  console.error("Missing file:", inputPath);
  process.exit(1);
}

const csvText = fs.readFileSync(inputPath, "utf8");
const fileName = path.basename(inputPath);
console.log("Importing", inputPath, `(${csvText.length} bytes)`);

const { rowCount, wholeCostStats } = saveInventoryCsv(csvText, fileName);
invalidateOnhandCache();
invalidateInventoryCache();

const status = getInventoryStatus();
const sampleSku = "240297";
const sampleOnhand = lookupOnhandQty("VJ-OAK", sampleSku);

console.log(
  JSON.stringify(
    {
      ok: true,
      fileName,
      rowCount,
      wholeCostStats,
      status,
      onhandLoaded: hasOnhandData(),
      sampleOnhandSku: sampleSku,
      sampleOnhandAtOak: sampleOnhand,
    },
    null,
    2
  )
);
