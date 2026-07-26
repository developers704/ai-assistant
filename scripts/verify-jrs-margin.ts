import fs from "fs";
import Papa from "papaparse";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import { filterExcludedSalesRows, salesUnitsSold } from "../src/lib/utils";

const MODEL = "JRS90653FG4WXENQ4";
const SKUS = new Set(
  ["239923", "239948Y", "235029Y", "223718Y", "223537Y", "223527"].map((s) =>
    s.toUpperCase()
  )
);

const csv = fs.readFileSync("data/reports/Sales-Report.csv", "utf8");
const { rows } = parseVendorPosRows(
  Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: true }).data
);
const kept = filterExcludedSalesRows(rows).filter(
  (r) =>
    (r.vendorModel || "").toUpperCase() === MODEL ||
    SKUS.has((r.sku || "").toUpperCase())
);

const rev = kept.reduce((s, r) => s + r.netRevenue, 0);
const cost = kept.reduce((s, r) => s + r.inventoryCost, 0);
const units = kept.reduce((s, r) => s + salesUnitsSold(r.quantity), 0);
const profit = rev - cost;
const margin = rev !== 0 ? profit / rev : null;

console.log(
  JSON.stringify(
    {
      formula: "marginRate = (Total − Inventory Cost) ÷ Total   [= CSV Profit/Sales]",
      model: MODEL,
      lines: kept.length,
      units,
      revenue: +rev.toFixed(2),
      inventoryCost: +cost.toFixed(2),
      profit: +profit.toFixed(2),
      marginPct: margin == null ? null : +(margin * 100).toFixed(2),
      uiShows: "26%",
      linesDetail: kept.map((r) => ({
        date: r.date,
        store: r.storeName,
        sku: r.sku,
        qty: r.quantity,
        total: r.netRevenue,
        cost: r.inventoryCost,
        profit: +(r.netRevenue - r.inventoryCost).toFixed(2),
        marginPct: r.netRevenue
          ? +(((r.netRevenue - r.inventoryCost) / r.netRevenue) * 100).toFixed(1)
          : null,
      })),
    },
    null,
    2
  )
);
