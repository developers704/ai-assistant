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
HE-2,7/31/2026,,SKU2,,VM2,,0,,VJ-HEND,,WATCHES,,\\456.jpg,,0,,,
`;

const cleaned = normalizeDailySalesCsv(raw);
assert.ok(!cleaned.includes(",,"), "spacer empty columns should be collapsed");
assert.ok(cleaned.includes(".webp"), "Image Dir should become webp");
assert.ok(!/\.jpg/i.test(cleaned), "jpg should be gone");
assert.ok(!cleaned.includes("SKU2"), "zero-total product rows should be removed");

const memoRaw = `Transaction  #,Transaction Date,,Item  #,,Total,,Store,,Department,,Description,,
GM-1,8/7/2026,,ITEM,,0,,VJ-GM,,WATCHES,,FINANCE SYNCHRONY 36/0,,
GM-1,8/7/2026,,ITEM,,0,,VJ-GM,,WATCHES,,APP/EG,,
GM-1,8/7/2026,,225287,,5000,,VJ-GM,,WATCHES,,BRIDAL SET,,
GM-2,8/7/2026,,ZZZERO,,0,,VJ-GM,,WATCHES,,random zero junk,,
`;
const memoCleaned = normalizeDailySalesCsv(memoRaw);
assert.ok(memoCleaned.includes("APP/EG"), "APP memo $0 Total kept for discounting");
assert.ok(memoCleaned.includes("FINANCE SYNCHRONY"), "FINANCE memo $0 Total kept");
assert.ok(memoCleaned.includes("225287"), "product line kept");
assert.ok(!memoCleaned.includes("ZZZERO"), "non-memo $0 Total still dropped");

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

const aliasRaw = `Transaction Date,Item #,VendorModel1,Total,Store,Department,Image Dir.
7/31/2026,AAAA1,VMX,25,VJ-HEND,WATCHES,\\111.jpg
`;
const aliasCleaned = normalizeDailySalesCsv(aliasRaw);
assert.ok(aliasCleaned.includes("SKU #") || aliasCleaned.includes("Item #"), "SKU/item alias should remain parseable");
assert.ok(aliasCleaned.includes("Vendor Model") || aliasCleaned.includes("VendorModel1"), "vendor model alias should remain parseable");

console.log("check-daily-sales-csv: ok");
