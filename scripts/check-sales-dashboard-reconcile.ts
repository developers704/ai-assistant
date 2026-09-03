/**
 * Full Sales Dashboard ↔ CSV reconciliation.
 * Net Sales must equal CSV Total sum (all rows). Store / date / salesperson rollups checked.
 *
 * Run: npx tsx scripts/check-sales-dashboard-reconcile.ts
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import {
  filterRows,
  groupRows,
  summarizeRows,
} from "../src/lib/sales/sales-aggregate";
import { creditSalespersonRows, parseSalespersonSplits } from "../src/lib/sales/salesperson-credit";
import {
  readActivePointer,
  readNormalizedRows,
  readVersionMetadata,
} from "../src/lib/sales/data/version-store";
import { querySales } from "../src/lib/sales/query-sales";

const seedPath = path.join(process.cwd(), "data", "reports", "Sales-Report.csv");
const TOL = 0.02; // cents drift

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseMoney(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw)
    .trim()
    .replace(/[$,]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function usToIso(s: string): string | null {
  const m = String(s)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
}

type Fail = { check: string; detail: string };
const fails: Fail[] = [];
const ok: string[] = [];

function expectClose(check: string, a: number, b: number, detail = "") {
  const da = money(a);
  const db = money(b);
  if (Math.abs(da - db) > TOL) {
    fails.push({
      check,
      detail: `${detail} got ${da} vs ${db} (Δ ${money(da - db)})`,
    });
  } else {
    ok.push(`${check}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("=== Sales Dashboard CSV reconcile ===\n");

  const csvText = fs.readFileSync(seedPath, "utf8");
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const fields = (parsed.meta.fields ?? []).map((f) => f.trim());
  const totalCol = fields.find((c) => /^total$/i.test(c))!;
  const dateCol = fields.find((c) => /transaction\s*date/i.test(c))!;
  const storeCol = fields.find((c) => /^store$/i.test(c))!;

  // --- Raw CSV sums ---
  const byDate = new Map<string, number>();
  const byStore = new Map<string, number>();
  const byStoreDate = new Map<string, number>();
  let rawTotal = 0;
  let rawRows = 0;

  for (const r of parsed.data) {
    const iso = usToIso(String(r[dateCol] ?? ""));
    if (!iso) continue;
    const store = String(r[storeCol] ?? "").trim() || "Unknown";
    const t = parseMoney(r[totalCol]);
    rawTotal += t;
    rawRows += 1;
    byDate.set(iso, (byDate.get(iso) ?? 0) + t);
    byStore.set(store, (byStore.get(store) ?? 0) + t);
    const sk = `${store}|${iso}`;
    byStoreDate.set(sk, (byStoreDate.get(sk) ?? 0) + t);
  }

  console.log(`CSV rows: ${rawRows}`);
  console.log(`CSV Total sum (Net Sales): $${money(rawTotal).toLocaleString()}`);
  console.log(
    `Date span: ${[...byDate.keys()].sort()[0]} → ${[...byDate.keys()].sort().at(-1)}`
  );
  console.log(`Stores: ${byStore.size}\n`);

  // --- Parsed engine ---
  const { rows } = parseVendorPosRows(parsed.data ?? []);
  const allSummary = summarizeRows(rows);
  expectClose("overall netSales", allSummary.netSales, rawTotal, "parse vs CSV Total");

  // By date
  const engineByDate = groupRows(rows, "date", null, "netSales", "asc");
  for (const d of engineByDate) {
    expectClose(
      "by-date",
      d.netSales,
      byDate.get(d.name) ?? 0,
      d.name
    );
  }
  if (engineByDate.length !== byDate.size) {
    fails.push({
      check: "by-date coverage",
      detail: `engine days ${engineByDate.length} vs csv ${byDate.size}`,
    });
  } else {
    ok.push(`by-date coverage — ${byDate.size} days`);
  }

  // By store
  const engineByStore = groupRows(rows, "store", null);
  let storeRollup = 0;
  for (const s of engineByStore) {
    storeRollup += s.netSales;
    expectClose(
      "by-store",
      s.netSales,
      byStore.get(s.name) ?? 0,
      s.name
    );
  }
  expectClose("store rollup = chain", storeRollup, rawTotal);

  // Store × date for last 14 calendar days present
  const datesSorted = [...byDate.keys()].sort();
  const recentDates = datesSorted.slice(-14);
  let storeDateChecks = 0;
  for (const iso of recentDates) {
    const dayRows = filterRows(rows, { dateFrom: iso, dateTo: iso });
    const dayStores = groupRows(dayRows, "store", null);
    for (const s of dayStores) {
      const key = `${s.name}|${iso}`;
      expectClose("store×date", s.netSales, byStoreDate.get(key) ?? 0, key);
      storeDateChecks += 1;
    }
    const daySum = summarizeRows(dayRows).netSales;
    expectClose("day net", daySum, byDate.get(iso) ?? 0, iso);
  }
  console.log(`Checked ${storeDateChecks} store×date cells over ${recentDates.length} recent days.`);

  // Explicit Aug 18–24 spot check
  for (const iso of [
    "2026-08-18",
    "2026-08-19",
    "2026-08-20",
    "2026-08-21",
    "2026-08-22",
    "2026-08-23",
    "2026-08-24",
    "2026-09-01",
    "2026-09-02",
  ]) {
    const csvNet = byDate.get(iso) ?? 0;
    const eng = summarizeRows(filterRows(rows, { dateFrom: iso, dateTo: iso }));
    expectClose("aug window day", eng.netSales, csvNet, iso);
    if (csvNet === 0) {
      fails.push({ check: "aug window day", detail: `${iso} missing from CSV` });
    }
  }

  // Salesperson: credited net = sum of net for lines with parseable CODE/NN% splits
  // (0% tokens like "OE/0%" are intentionally ignored — not credited)
  const credits = creditSalespersonRows(rows);
  const creditSum = credits.reduce((s, c) => s + c.netSales, 0);
  let expectedCredit = 0;
  let rowsWithSp = 0;
  let rowsWithoutSp = 0;
  let zeroOnlySplits = 0;
  for (const r of rows) {
    const sp = (r.salespersons || "").trim();
    if (!sp) {
      rowsWithoutSp += 1;
      continue;
    }
    const splits = parseSalespersonSplits(sp);
    if (!splits.length) {
      if (/\//.test(sp)) zeroOnlySplits += 1;
      rowsWithoutSp += 1;
      continue;
    }
    rowsWithSp += 1;
    expectedCredit += r.netRevenue;
  }
  expectClose(
    "salesperson credit sum",
    creditSum,
    expectedCredit,
    `${credits.length} people; ${rowsWithSp} credited lines; ${rowsWithoutSp} blank/unparsed; ${zeroOnlySplits} zero-% only`
  );

  // Top 15 salespeople vs groupRows
  const topSp = groupRows(rows, "salesperson", 15);
  for (let i = 0; i < Math.min(10, topSp.length); i++) {
    const a = topSp[i]!;
    const b = credits.find((c) => c.name === a.name || c.code === a.code);
    if (!b) {
      fails.push({
        check: "salesperson rank",
        detail: `groupRows #${i + 1} ${a.name} not in creditSalespersonRows`,
      });
    } else {
      expectClose("salesperson rank net", a.netSales, b.netSales, a.name);
    }
  }

  // Cached unified version
  const pointer = readActivePointer();
  const meta = pointer.activeVersion
    ? readVersionMetadata(pointer.activeVersion)
    : null;
  const cached = readNormalizedRows();
  if (!cached?.length) {
    fails.push({ check: "cache", detail: "no normalized-rows cache" });
  } else {
    const cachedSum = summarizeRows(cached).netSales;
    expectClose("cache net = CSV", cachedSum, rawTotal, pointer.activeVersion ?? "");
    if (meta) {
      console.log(
        `Active version: ${meta.dataVersion} rows=${meta.rowCount} ${meta.dateRange.from}→${meta.dateRange.to}`
      );
    }
  }

  // querySales all dates (dashboard path)
  const q = await querySales({
    dateRange: { type: "all_dates" },
    resetContext: true,
    exactFilters: true,
    include: {
      summary: true,
      topStores: true,
      topSalesPeople: true,
    },
    limit: 50,
  });
  if (!q.ok || !q.summary) {
    fails.push({
      check: "querySales",
      detail: q.error ?? q.warnings?.join("; ") ?? "no summary",
    });
  } else {
    expectClose("querySales net", q.summary.netSales, rawTotal, "all_dates");
    const qStores = q.rankings?.topStores ?? q.breakdowns?.byStore ?? [];
    let qStoreSum = 0;
    for (const s of qStores) qStoreSum += s.netSales;
    // topStores may be uncapped when include.topStores — check rollup if full list
    if (qStores.length >= byStore.size - 1) {
      expectClose("querySales store rollup", qStoreSum, rawTotal);
    }
    for (const s of qStores.slice(0, 10)) {
      expectClose(
        "querySales store",
        s.netSales,
        byStore.get(s.name) ?? 0,
        s.name
      );
    }
  }

  // Full range filter (dashboard date picker style)
  const from = datesSorted[0]!;
  const to = datesSorted[datesSorted.length - 1]!;
  const qRange = await querySales({
    dateRange: { type: "custom", startDate: from, endDate: to },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 100,
  });
  expectClose(
    "querySales custom range net",
    qRange.summary?.netSales ?? 0,
    rawTotal,
    `${from}→${to}`
  );

  // Print recent day table
  console.log("\n--- Recent days (CSV Total = engine net) ---");
  console.log(
    "Date         CSV Net        Engine Net     Stores  Match"
  );
  for (const iso of recentDates) {
    const csvNet = money(byDate.get(iso) ?? 0);
    const eng = money(
      summarizeRows(filterRows(rows, { dateFrom: iso, dateTo: iso })).netSales
    );
    const stores = groupRows(
      filterRows(rows, { dateFrom: iso, dateTo: iso }),
      "store",
      null
    ).length;
    const match = Math.abs(csvNet - eng) <= TOL ? "OK" : "FAIL";
    console.log(
      `${iso}  $${csvNet.toLocaleString().padStart(12)}  $${eng.toLocaleString().padStart(12)}  ${String(stores).padStart(6)}  ${match}`
    );
  }

  console.log("\n--- Top 10 stores (CSV vs engine) ---");
  const topStores = [...byStore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [name, net] of topStores) {
    const eng = engineByStore.find((s) => s.name === name)?.netSales ?? 0;
    const match = Math.abs(money(net) - money(eng)) <= TOL ? "OK" : "FAIL";
    console.log(
      `${name.padEnd(12)} CSV $${money(net).toLocaleString().padStart(12)}  eng $${money(eng).toLocaleString().padStart(12)}  ${match}`
    );
  }

  console.log("\n--- Top 10 salespeople (credited net) ---");
  for (const c of credits.slice(0, 10)) {
    console.log(
      `${c.name.padEnd(28)} $${money(c.netSales).toLocaleString().padStart(12)}  units ${c.units.toFixed(1)}`
    );
  }

  console.log(`\n=== Result: ${fails.length === 0 ? "PASS" : "FAIL"} ===`);
  console.log(`Passed checks: ${ok.length}`);
  if (fails.length) {
    console.log(`Failed (${fails.length}):`);
    for (const f of fails.slice(0, 40)) {
      console.log(`  ✗ [${f.check}] ${f.detail}`);
    }
    if (fails.length > 40) console.log(`  … +${fails.length - 40} more`);
    process.exit(1);
  }
  console.log("All nets match CSV Total. Stores / dates / salespeople OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
