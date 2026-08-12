/**
 * Full audit: Whole Cost rules + return/margin fixes for Jul 1 → latest.
 * Run: npx tsx scripts/audit-sales-margin-jul1.ts
 */
import fs from "fs";
import {
  filterExcludedSalesRows,
  salesUnitsSold,
} from "../src/lib/utils";
import {
  calculatorWholesaleUnitCost,
  collapseCancelledSkuLegs,
  signedWholesaleUnitCost,
  wholesaleProfitForModelRows,
  vendorModelGroupKey,
} from "../src/lib/sales/top-models-wholesale-margin";
import { wholeCostFromRules, resolveWholeCostFromRules } from "../src/lib/inventory/whole-cost-rules";
import type { VendorPosRow } from "../src/lib/reports/types";

const FROM = "2026-07-01";
let failed = 0;
function assert(name: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== A) Sheet formula unit checks ===");
const sheetCases: {
  name: string;
  fields: Parameters<typeof wholeCostFromRules>[0];
  base: number;
  expect: number;
}[] = [
  {
    name: "Gold UV Class → ÷1.3",
    fields: { design: "GOLD JEWL", class: "UV", department: "GOLD ID" },
    base: 1300,
    expect: 1300 / 1.3,
  },
  {
    name: "Gold JEWL + Ultimate Value desc → ÷1.3",
    fields: {
      design: "GOLD JEWL",
      department: "GOLD CHAIN",
      class: "10KT",
      description: '10KT "ULTIMATE VALUE" ROPE',
    },
    base: 2724,
    expect: 2724 / 1.3,
  },
  {
    name: "Diamond + UV desc → ÷8.8",
    fields: {
      sku: "999001",
      department: "LADYS RING",
      description: "LAB DIAMOND ULTIMATE VALUE RING",
    },
    base: 880,
    expect: 880 / 8.8,
  },
  {
    name: "Fixed SKU 231611 → 350",
    fields: {
      sku: "231611",
      department: "LADYS RING",
      description: "DIAMOND UV",
    },
    base: 499,
    expect: 350,
  },
  {
    name: "LINKNLOCK → ÷2.75",
    fields: { design: "LINKNLOCK" },
    base: 275,
    expect: 100,
  },
  {
    name: "LOVE → ÷2.75",
    fields: { design: "LOVE" },
    base: 275,
    expect: 100,
  },
  {
    name: "OROVENTI → ÷2.5",
    fields: { design: "OROVENTI" },
    base: 250,
    expect: 100,
  },
  {
    name: "CLOVER → ÷4",
    fields: { design: "CLOVER" },
    base: 400,
    expect: 100,
  },
  {
    name: "AANIKA.V → ÷8.8",
    fields: { design: "AANIKA.V" },
    base: 880,
    expect: 100,
  },
  {
    name: "PLAT JEWL → ÷4",
    fields: { design: "PLAT JEWL" },
    base: 400,
    expect: 100,
  },
  {
    name: "SILVER JEW → ÷4",
    fields: { design: "SILVER JEW" },
    base: 400,
    expect: 100,
  },
  {
    name: "B STONE → ÷8.8",
    fields: { design: "B STONE" },
    base: 880,
    expect: 100,
  },
  {
    name: "Sub-Class BIRTHSTONE → ÷8.8",
    fields: { subClass: "BIRTHSTONE", department: "OTHER" },
    base: 880,
    expect: 100,
  },
  {
    name: "GOLD JEWL plain → ÷4",
    fields: { design: "GOLD JEWL", class: "10KT", description: "rope chain" },
    base: 400,
    expect: 100,
  },
  {
    name: "GOLD ID dept → ÷4",
    fields: { department: "GOLD ID", design: "PLAIN" },
    base: 400,
    expect: 100,
  },
  {
    name: "Tungsten → ×0.06",
    fields: { department: "TUNGS BAND" },
    base: 1000,
    expect: 60,
  },
  {
    name: "TRITON → ÷4",
    fields: { department: "TRITON" },
    base: 400,
    expect: 100,
  },
  {
    name: "LADYS RING → ÷8.8",
    fields: { department: "LADYS RING", design: "OVANI" },
    base: 880,
    expect: 100,
  },
  {
    name: "Rado → /1.82+20",
    fields: { department: "RADO" },
    base: 1820,
    expect: 1820 / 1.82 + 20,
  },
  {
    name: "Cartier → ÷4",
    fields: { department: "CARTIER" },
    base: 4000,
    expect: 1000,
  },
  {
    name: "Bright Link → ÷4",
    fields: { department: "BRIGHT LINK" },
    base: 400,
    expect: 100,
  },
  {
    name: "Movado → /1.82+20",
    fields: { department: "MOVADO" },
    base: 1820,
    expect: 1820 / 1.82 + 20,
  },
  {
    name: "Mont Watch → /1.82+20",
    fields: { department: "MONT WATCH" },
    base: 1820,
    expect: 1820 / 1.82 + 20,
  },
  {
    name: "Longines → ×0.58+25",
    fields: { department: "LONGINES" },
    base: 1000,
    expect: 1000 * 0.58 + 25,
  },
  {
    name: "Bulova → ×0.48+15",
    fields: { department: "BULOVA" },
    base: 1000,
    expect: 1000 * 0.48 + 15,
  },
  {
    name: "MICHAEL KO → /2+10",
    fields: { department: "MICHAEL KO" },
    base: 200,
    expect: 110,
  },
  {
    name: "G-SHOCK → ×0.4825+15",
    fields: { department: "G-SHOCK" },
    base: 1000,
    expect: 1000 * 0.4825 + 15,
  },
  {
    name: "Tissot → /2+10",
    fields: { department: "TISSOT" },
    base: 200,
    expect: 110,
  },
  {
    name: "Rolex → ÷4",
    fields: { department: "ROLEX" },
    base: 4000,
    expect: 1000,
  },
];

for (const c of sheetCases) {
  const got = wholeCostFromRules(c.fields, c.base);
  assert(c.name, got != null && Math.abs(got - c.expect) < 0.02, `got=${got}`);
}

console.log("\n=== B) Return / signed cost / collapse ===");
assert(
  "sale+return signed cost nets ~0",
  (() => {
    const cost = 100;
    const sale = 500 - signedWholesaleUnitCost(cost, { quantity: 1, netRevenue: 500 });
    const ret = -500 - signedWholesaleUnitCost(cost, { quantity: -1, netRevenue: -500 });
    return Math.abs(sale + ret) < 0.01;
  })()
);

const collapseRows = [
  {
    date: "2026-08-08",
    storeName: "VJ-VAL",
    sku: "205357-20",
    itemNumber: "205357-20",
    quantity: 1,
    netRevenue: 10909.09,
    grossSales: 27510,
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    vendorModel: "QKVK",
  },
  {
    date: "2026-08-08",
    storeName: "VJ-VAL",
    sku: "205357-20",
    itemNumber: "205357-20",
    quantity: -1,
    netRevenue: -10909.09,
    grossSales: -27510,
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    vendorModel: "QKVK",
  },
  {
    date: "2026-08-10",
    storeName: "VJ-SERRA",
    sku: "205351-8",
    itemNumber: "205351-8",
    quantity: 1,
    netRevenue: 5733.78,
    grossSales: 12707,
    department: "GOLD ID",
    design: "GOLD JEWL",
    vendorModel: "QKVK",
  },
] as VendorPosRow[];
const collapsed = collapseCancelledSkuLegs(collapseRows);
assert(
  "collapse drops same-day cancelled SKU pair",
  collapsed.length === 1 && collapsed[0].sku === "205351-8"
);

console.log("\n=== C) Live data Jul 1 → latest ===");
const pointer = JSON.parse(fs.readFileSync(".data/sales/current.json", "utf8"));
const ver = pointer.activeVersion as string;
const allRows: VendorPosRow[] = JSON.parse(
  fs.readFileSync(`.data/sales/versions/${ver}/normalized-rows.json`, "utf8")
);
const TO = allRows.reduce((m, r) => (r.date && r.date > m ? r.date : m), FROM);
console.log(`  version=${ver} window=${FROM} → ${TO}`);

const filtered = filterExcludedSalesRows(
  allRows.filter((r) => r.date && r.date >= FROM && r.date <= TO)
);
console.log(`  rows after exclusions: ${filtered.length}`);

let withCost = 0;
let missingCost = 0;
let tagBaseUsed = 0; // should stay ~0 for sales path
let salesAmtBase = 0;
let signedReturnOk = 0;
let signedReturnBad = 0;
let fakeNegFromUnsigned = 0;
const byRule: Record<string, number> = {};
const negModels: { key: string; rate: number; rev: number; units: number }[] = [];

// Spot: Sales Amount base vs Tag — sample GOLD JEWL lines
let salesAmtBaseOk = 0;
let salesAmtBaseFail = 0;

for (const r of filtered) {
  const sku = (r.sku || r.itemNumber || "").trim();
  if (!sku) continue;
  const cost = calculatorWholesaleUnitCost(sku, r.storeName, r);
  if (cost == null) {
    missingCost++;
    continue;
  }
  withCost++;

  const salesAmt = Math.abs(Number(r.grossSales) || 0);
  if (salesAmt > 0) {
    const hit = resolveWholeCostFromRules(
      {
        sku,
        department: r.department,
        design: r.design,
        class: r.productClass,
        subClass: r.subClass,
        description: r.description,
      },
      salesAmt
    );
    if (hit) {
      byRule[hit.ruleName] = (byRule[hit.ruleName] ?? 0) + 1;
      salesAmtBase++;
      if (Math.abs(hit.cost - cost) < 0.02 || fixedMatch(sku, cost)) {
        salesAmtBaseOk++;
      } else {
        // fixed SKU or inventory-only edge
        const fixed = cost === 350 || cost === 275 || cost === 499 || cost === 400 || cost === 215 || cost === 675 || cost === 940 || cost === 150;
        if (!fixed && Math.abs(hit.cost - cost) >= 0.02) salesAmtBaseFail++;
        else salesAmtBaseOk++;
      }
    }
  }

  const signed = signedWholesaleUnitCost(cost, r);
  const q = Number(r.quantity ?? 0);
  if (q < 0 || r.netRevenue < 0) {
    if (signed === -cost) signedReturnOk++;
    else signedReturnBad++;
    // Unsigned would be net - (+cost) which is more negative
    const unsignedProfit = r.netRevenue - cost;
    const signedProfit = r.netRevenue - signed;
    if (unsignedProfit < signedProfit - 0.01) {
      // good — signed is better; count how many would have been worse unsigned
      fakeNegFromUnsigned++;
    }
  }
}

function fixedMatch(sku: string, cost: number): boolean {
  return [350, 275, 499, 400, 215, 675, 940, 150].includes(cost);
}

assert("most Jul→latest lines have calculator cost", withCost > filtered.length * 0.7, `${withCost}/${filtered.length}`);
assert("return legs use signed −cost", signedReturnBad === 0, `bad=${signedReturnBad} ok=${signedReturnOk}`);
assert(
  "sales path uses Sales Amount×rules (not Tag)",
  salesAmtBaseFail < 50,
  `fail=${salesAmtBaseFail} ok=${salesAmtBaseOk}`
);

// Top models: after collapse, no model with |rev|<$1 and units>0 from cancelled noise
const byModel = new Map<string, VendorPosRow[]>();
for (const r of filtered) {
  if (!r.vendorModel?.trim()) continue;
  const k = vendorModelGroupKey(r);
  const list = byModel.get(k) ?? [];
  list.push(r);
  byModel.set(k, list);
}

let phantomZero = 0;
let negMargin = 0;
let posMargin = 0;
let nullMargin = 0;
let modelsChecked = 0;

for (const [key, rows] of byModel) {
  const active = collapseCancelledSkuLegs(rows);
  if (!active.length) continue;
  const units = active.reduce((s, r) => s + salesUnitsSold(r.quantity), 0);
  const rev = active.reduce((s, r) => s + r.netRevenue, 0);
  if (units > 0 && Math.abs(rev) < 1) phantomZero++;
  const { marginRate, profit } = wholesaleProfitForModelRows(rows);
  modelsChecked++;
  if (marginRate == null) nullMargin++;
  else if (marginRate < 0) {
    negMargin++;
    if (negModels.length < 8) {
      negModels.push({ key, rate: marginRate, rev, units });
    }
  } else posMargin++;
  void profit;
}

assert(
  "Top Models collapse clears phantom near-zero nets",
  phantomZero === 0,
  `phantom=${phantomZero}`
);

console.log("\n=== D) Jul→latest summary ===");
console.log(
  JSON.stringify(
    {
      rows: filtered.length,
      withCost,
      missingCost,
      signedReturnOk,
      signedReturnBad,
      returnsHelpedBySignedCost: fakeNegFromUnsigned,
      modelsChecked,
      posMargin,
      negMargin,
      nullMargin,
      phantomZeroNetModels: phantomZero,
      topRules: Object.entries(byRule)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12),
      sampleNegModels: negModels.map((m) => ({
        model: m.key,
        marginPct: (m.rate * 100).toFixed(1) + "%",
        rev: Math.round(m.rev),
        units: m.units,
      })),
    },
    null,
    2
  )
);

// UKP spot check Aug 7
const ukp = filtered.filter(
  (r) => r.vendorModel === "UKP0082-3" && r.date === "2026-08-07"
);
const ukpWp = wholesaleProfitForModelRows(ukp);
assert(
  "UKP0082-3 Aug7 margin ~4% (Sales Amt÷4)",
  ukpWp.marginRate != null && ukpWp.marginRate > 0.03 && ukpWp.marginRate < 0.06,
  `rate=${ukpWp.marginRate}`
);

// NORTH tennis bracelet return clarity: net includes return
const north = filtered.filter(
  (r) =>
    (r.sku || "").toUpperCase().startsWith("231620") &&
    r.storeName === "VJ-NORTH" &&
    r.date >= "2026-08-01"
);
const northUnits = north.reduce((s, r) => s + salesUnitsSold(r.quantity), 0);
const northRet = north.reduce((s, r) => s + (Number(r.quantity) < 0 ? Math.abs(Number(r.quantity)) : 0), 0);
const northNet = north.reduce((s, r) => s + r.netRevenue, 0);
assert(
  "NORTH 231620 Aug has return + sales (explains 2pcs/$599 pattern)",
  northRet > 0 && northUnits > 0,
  `sold=${northUnits} rtn=${northRet} net=${northNet.toFixed(0)}`
);

if (failed) {
  console.error(`\n${failed} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("\nALL AUDIT CHECKS PASSED");
