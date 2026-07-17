import { buildEntityIndex, normalizeFilterInputs } from "../src/lib/sales/sales-normalizer";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import { filterExcludedSalesRows } from "../src/lib/utils";
import fs from "fs";
import Papa from "papaparse";

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
const index = buildEntityIndex(rows);
console.log(
  "index classes sample",
  index.classes.filter((c) => c.length <= 3 || c.includes("-")).slice(0, 20)
);

for (const test of ["UV", "14KT", "-", "--", '"--"', "10K", "21-24KT", "B SAPPHIRE"]) {
  const res = normalizeFilterInputs({ classes: [test] }, index);
  console.log(
    JSON.stringify({
      test,
      values: res.filters.classes,
      clarification: res.clarification?.message ?? null,
    })
  );
}

const all = normalizeFilterInputs({ classes: index.classes }, index);
console.log(
  "select all → values",
  all.filters.classes.length,
  "clarification",
  all.clarification?.message ?? null
);
