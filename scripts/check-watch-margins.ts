/**
 * Verify watch brand Whole Cost formulas + live sales margins.
 * Run: npx tsx scripts/check-watch-margins.ts
 */
import fs from "fs";
import { filterExcludedSalesRows } from "../src/lib/utils";
import {
  calculatorWholesaleUnitCost,
  signedWholesaleUnitCost,
  wholesaleProfitForModelRows,
  vendorModelGroupKey,
} from "../src/lib/sales/top-models-wholesale-margin";
import {
  resolveWholeCostFromRules,
  wholeCostFromRules,
} from "../src/lib/inventory/whole-cost-rules";
import type { VendorPosRow } from "../src/lib/reports/types";

let failed = 0;
function assert(name: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Sheet truth from owner image (base = Tag on calculator; Sales Amount on sales). */
const WATCHES: {
  name: string;
  dept: string;
  expect: (base: number) => number;
  formula: string;
}[] = [
  { name: "Rado", dept: "RADO", expect: (t) => t / 1.82 + 20, formula: "÷1.82 + $20" },
  { name: "Cartier", dept: "CARTIER", expect: (t) => t / 4, formula: "÷4" },
  { name: "Bright Link", dept: "BRIGHT LINK", expect: (t) => t / 4, formula: "÷4" },
  { name: "Movado", dept: "MOVADO", expect: (t) => t / 1.82 + 20, formula: "÷1.82 + $20" },
  {
    name: "Mont Blank",
    dept: "MONT WATCH",
    expect: (t) => t / 1.82 + 20,
    formula: "÷1.82 + $20",
  },
  {
    name: "Longines",
    dept: "LONGINES",
    expect: (t) => t * 0.58 + 25,
    formula: "×0.58 + $25",
  },
  { name: "Bulova", dept: "BULOVA", expect: (t) => t * 0.48 + 15, formula: "×0.48 + $15" },
  {
    name: "Michael Kors",
    dept: "MICHAEL KO",
    expect: (t) => t / 2 + 10,
    formula: "÷2 + $10",
  },
  {
    name: "G shock",
    dept: "G-SHOCK",
    expect: (t) => t * 0.4825 + 15,
    formula: "×0.4825 + $15",
  },
  { name: "Tissot", dept: "TISSOT", expect: (t) => t / 2 + 10, formula: "÷2 + $10" },
  { name: "Rolex", dept: "ROLEX", expect: (t) => t / 4, formula: "÷4" },
];

console.log("=== A) Formula unit checks (sheet) ===");
const BASE = 2000;
for (const w of WATCHES) {
  const got = wholeCostFromRules({ department: w.dept }, BASE);
  const want = w.expect(BASE);
  const ok = got != null && Math.abs(got - want) < 0.02;
  assert(`${w.name} ${w.formula}`, ok, `got=${got} want=${want}`);
  const resolved = resolveWholeCostFromRules({ department: w.dept }, BASE);
  assert(`${w.name} rule name`, resolved?.ruleName === w.name, `resolved=${resolved?.ruleName}`);
}

console.log("\n=== B) Live Jul 1 → latest sales margins ===");
const pointer = JSON.parse(fs.readFileSync(".data/sales/current.json", "utf8"));
const ver = pointer.activeVersion as string;
const allRows: VendorPosRow[] = JSON.parse(
  fs.readFileSync(`.data/sales/versions/${ver}/normalized-rows.json`, "utf8")
);
const FROM = "2026-07-01";
const filtered = filterExcludedSalesRows(
  allRows.filter((r) => r.date && r.date >= FROM)
);
console.log(`  version=${ver} rows=${filtered.length}`);

for (const w of WATCHES) {
  const deptNorm = w.dept.replace(/\s+/g, " ").toUpperCase();
  const brandRows = filtered.filter((r) => {
    const d = (r.department || "").trim().toUpperCase().replace(/\s+/g, " ");
    if (w.name === "Mont Blank") {
      return (
        d === "MONT WATCH" ||
        d === "MONT ACCES" ||
        d.includes("MONTBLANC") ||
        d.includes("MONT BLANC")
      );
    }
    if (w.name === "Michael Kors") {
      return d === "MICHAEL KO" || d === "MICHAEL KORS" || d.startsWith("MICHAEL");
    }
    if (w.name === "G shock") {
      return d === "G-SHOCK" || d === "G SHOCK";
    }
    if (w.name === "Bright Link") {
      return d === "BRIGHT LINK" || d === "BRIGHTLINK";
    }
    return d === deptNorm;
  });

  let costOk = 0;
  let costBad = 0;
  let marginOk = 0;
  let marginBad = 0;
  let samples: string[] = [];

  for (const r of brandRows) {
    const sku = (r.sku || r.itemNumber || "").trim();
    if (!sku) continue;
    const salesAmt = Math.abs(Number(r.grossSales) || 0);
    if (!(salesAmt > 0)) continue;
    const want = w.expect(salesAmt);
    const got = calculatorWholesaleUnitCost(sku, r.storeName, r);
    if (got == null) continue;
    if (Math.abs(got - want) < 0.05) costOk++;
    else {
      costBad++;
      if (samples.length < 2) {
        samples.push(
          `${r.date} ${sku} salesAmt=${salesAmt} got=${got?.toFixed(2)} want=${want.toFixed(2)} dept=${r.department}`
        );
      }
    }
    const signed = signedWholesaleUnitCost(got, r);
    const profit = r.netRevenue - signed;
    const expectProfit = r.netRevenue - (Number(r.quantity) < 0 ? -want : want);
    // For matching formula rows, margin math must be Net − signed(cost)
    if (Math.abs(got - want) < 0.05) {
      if (Math.abs(profit - expectProfit) < 0.02) marginOk++;
      else marginBad++;
    }
  }

  // Model-level: a few groups with cost should have finite margin = profit/rev
  const byModel = new Map<string, VendorPosRow[]>();
  for (const r of brandRows) {
    if (!r.vendorModel?.trim()) continue;
    const k = vendorModelGroupKey(r);
    const list = byModel.get(k) ?? [];
    list.push(r);
    byModel.set(k, list);
  }
  let modelChecked = 0;
  let modelMarginMathOk = 0;
  for (const [, rows] of byModel) {
    const { profit, marginRate } = wholesaleProfitForModelRows(rows);
    if (profit == null || marginRate == null) continue;
    const rev = rows.reduce((s, r) => s + r.netRevenue, 0);
    // After collapse, recompute with same helper — just check consistency
    if (Math.abs(rev) < 1) continue;
    modelChecked++;
    const expectedRate = profit / rev;
    if (Math.abs(expectedRate - marginRate) < 1e-9) modelMarginMathOk++;
  }

  if (costOk + costBad === 0) {
    console.log(`  · ${w.name}: no Jul→latest sales lines (formula-only OK)`);
  } else {
    assert(
      `${w.name}: Sales Amount×formula cost (${costOk} ok / ${costBad} bad)`,
      costBad === 0 && costOk > 0,
      samples.join(" | ") || `costOk=${costOk}`
    );
    assert(
      `${w.name}: row margin = Net − signed cost`,
      marginBad === 0 && marginOk === costOk,
      `marginOk=${marginOk} marginBad=${marginBad}`
    );
  }
  if (modelChecked > 0) {
    assert(
      `${w.name}: model marginRate = profit/net`,
      modelMarginMathOk === modelChecked,
      `${modelMarginMathOk}/${modelChecked}`
    );
  } else {
    console.log(`  · ${w.name}: no model margins in window (skip model check)`);
  }

  // One concrete example line
  const ex = brandRows.find(
    (r) =>
      Number(r.quantity) > 0 &&
      Math.abs(Number(r.grossSales) || 0) > 0 &&
      calculatorWholesaleUnitCost(r.sku || r.itemNumber || "", r.storeName, r) != null
  );
  if (ex) {
    const salesAmt = Math.abs(Number(ex.grossSales) || 0);
    const cost = calculatorWholesaleUnitCost(ex.sku || "", ex.storeName, ex)!;
    const profit = ex.netRevenue - signedWholesaleUnitCost(cost, ex);
    const pct = ex.netRevenue !== 0 ? (profit / ex.netRevenue) * 100 : 0;
    console.log(
      `    eg ${ex.date} ${ex.sku} SalesAmt $${salesAmt} → cost $${cost.toFixed(2)} | net $${ex.netRevenue.toFixed(2)} → margin ${pct.toFixed(1)}%`
    );
  } else {
    console.log(`    (no live sale lines for ${w.name} in Jul→latest)`);
  }
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL WATCH CHECKS PASSED");
process.exit(failed ? 1 : 0);
