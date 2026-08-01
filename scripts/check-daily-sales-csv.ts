/**
 * Self-check: daily sales CSV normalize (empty cols + Image Dir → webp).
 * Run: npx tsx scripts/check-daily-sales-csv.ts
 */
import assert from "node:assert/strict";
import { normalizeDailySalesCsv } from "../src/lib/reports/normalize-daily-sales-csv";
import { normalizeSalesImageDir } from "../src/lib/reports/product-image";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import Papa from "papaparse";

assert.equal(normalizeSalesImageDir("\\229149.jpg"), "\\229149.webp");
assert.equal(normalizeSalesImageDir("foo/bar.PNG"), "foo/bar.webp");
assert.equal(normalizeSalesImageDir("x.webp"), "x.webp");
assert.equal(normalizeSalesImageDir(""), "");

const raw = `Transaction  #,Transaction Date,,Item  #,,VendorModel1,,Total,,Store,,Department,,Image Dir.,,Profit Amount,,,
HE-1,7/31/2026,,SKU1,,VM1,,100,,VJ-HEND,,WATCHES,,\\123.jpg,,40,,,
`;

const cleaned = normalizeDailySalesCsv(raw);
assert.ok(!cleaned.includes(",,"), "spacer empty columns should be collapsed");
assert.ok(cleaned.includes(".webp"), "Image Dir should become webp");
assert.ok(!/\.jpg/i.test(cleaned), "jpg should be gone");

const parsed = Papa.parse<Record<string, unknown>>(cleaned, {
  header: true,
  skipEmptyLines: true,
});
const { rows } = parseVendorPosRows(parsed.data ?? []);
assert.equal(rows.length, 1);
assert.equal(rows[0].sku, "SKU1");
assert.equal(rows[0].itemNumber, "SKU1");
assert.equal(rows[0].vendorModel, "VM1");
assert.ok(rows[0].imageDir.endsWith(".webp"));

console.log("check-daily-sales-csv: ok");
