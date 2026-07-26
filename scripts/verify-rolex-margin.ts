import fs from "fs";
import Papa from "papaparse";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import { filterExcludedSalesRows, salesUnitsSold } from "../src/lib/utils";

const MODEL = "DATEJUST-TT-26MM-OLD-DB";
const csv = fs.readFileSync("data/reports/Sales-Report.csv", "utf8");
const { rows } = parseVendorPosRows(
  Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: true }).data
);
const kept = filterExcludedSalesRows(rows).filter(
  (r) => (r.vendorModel || "").toUpperCase() === MODEL
);

const rev = kept.reduce((s, r) => s + r.netRevenue, 0);
const cost = kept.reduce((s, r) => s + r.inventoryCost, 0);
const units = kept.reduce((s, r) => s + salesUnitsSold(r.quantity), 0);
const profit = rev - cost;

// What cost would be if prorated by |qty| share within each txn+sku group
const groups = new Map<string, typeof kept>();
for (const r of kept) {
  const key = `${r.transactionId}|${(r.sku || "").toUpperCase()}`;
  const g = groups.get(key) ?? [];
  g.push(r);
  groups.set(key, g);
}
let proratedCost = 0;
for (const g of groups.values()) {
  const absQty = g.reduce((s, r) => s + Math.abs(r.quantity), 0);
  // POS repeats full unit cost on each split; true unit cost is first line's cost
  // (all splits share same Inventory Cost value)
  const unitCost = g[0]?.inventoryCost ?? 0;
  const signedQty = g.reduce((s, r) => s + r.quantity, 0);
  // For a sale of 1 unit split across people: cost once. For return qty -1: cost once (as POS has it).
  proratedCost += unitCost * (signedQty === 0 ? 0 : Math.sign(signedQty) || 1);
  // Better: one unit of cost per unique physical unit = sum of qty (can be -1 for return)
  // Actually for splits totaling qty 1, cost should be unitCost * 1; for qty -1, POS still has positive cost.
  void absQty;
}
// Simpler fix estimate: within each txn+sku, take cost once (max of costs, since all equal) * sign of total qty
let fixedCost = 0;
for (const g of groups.values()) {
  const totalQty = g.reduce((s, r) => s + r.quantity, 0);
  const unitCost = Math.max(...g.map((r) => r.inventoryCost));
  if (totalQty > 0) fixedCost += unitCost;
  else if (totalQty < 0) fixedCost += unitCost; // POS keeps positive cost on return
  // totalQty === 0 shouldn't happen for one sku
}

const fixedProfit = rev - fixedCost;

console.log(
  JSON.stringify(
    {
      units,
      revenue: +rev.toFixed(2),
      inventoryCostSummedAsIs: +cost.toFixed(2),
      profitAsIs: +profit.toFixed(2),
      marginPctAsIs: +((profit / rev) * 100).toFixed(2),
      inventoryCostIfOncePerSkuTxn: +fixedCost.toFixed(2),
      marginPctIfFixed: +((fixedProfit / rev) * 100).toFixed(2),
      lines: kept.map((r) => ({
        date: r.date,
        store: r.storeName,
        sku: r.sku,
        qty: r.quantity,
        total: r.netRevenue,
        cost: r.inventoryCost,
      })),
    },
    null,
    2
  )
);
