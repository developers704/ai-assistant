import fs from "fs";
import Papa from "papaparse";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import { filterExcludedSalesRows } from "../src/lib/utils";
import { filterRows } from "../src/lib/sales/sales-aggregate";

const csv = fs.readFileSync(
  ".data/reports/91d03d91-83aa-40c9-89da-90dc0affa7e3.csv",
  "utf-8"
);
const rows = filterExcludedSalesRows(
  parseVendorPosRows(
    Papa.parse(csv, { header: true, skipEmptyLines: true }).data as Record<
      string,
      unknown
    >[]
  ).rows
);

const classes = [...new Set(rows.map((r) => r.productClass))].sort();
console.log("unique classes", classes.length, classes.slice(0, 50));
console.log(
  "empty",
  rows.filter((r) => !(r.productClass || "").trim()).length,
  "dash",
  rows.filter((r) => (r.productClass || "").trim() === "-").length
);

const all = filterRows(rows, { classes: classes.filter(Boolean) });
console.log("rows", rows.length, "filter all listed classes", all.length);

const sample = classes.find((c) => c && c !== "-") || "UV";
console.log("sample", sample, filterRows(rows, { classes: [sample] }).length);

// Simulate URL-encoded multi class like the API might receive
const joined = classes.filter(Boolean).join(",");
console.log("joined length", joined.length, "parts", joined.split(",").length);
