/** Find date range ending at 2026-08-18 that sums to dashboard total. */
import { readNormalizedRows } from "../src/lib/sales/data/version-store";
import { filterRows, summarizeRows } from "../src/lib/sales/sales-aggregate";

const target = 84_585_390;
const rows = readNormalizedRows()!;
const end = "2026-08-18";

const starts = ["2025-01-01", "2025-07-01", "2026-01-01", "2026-07-01"];
for (const from of starts) {
  const s = summarizeRows(filterRows(rows, { dateFrom: from, dateTo: end }));
  console.log(from, "->", end, +s.netSales.toFixed(0), s.unitsSold);
}

// Scan year-to-month totals in 2025
for (let m = 1; m <= 12; m++) {
  const from = `2025-${String(m).padStart(2, "0")}-01`;
  const to =
    m === 12
      ? "2025-12-31"
      : `2025-${String(m + 1).padStart(2, "0")}-01`.replace(/-13-/, "-12-");
  const lastDay = new Date(Date.UTC(2025, m, 0)).getUTCDate();
  const toM = `2025-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const s = summarizeRows(filterRows(rows, { dateFrom: from, dateTo: toM }));
  if (Math.abs(s.netSales - target) < 1_000_000) {
    console.log("month near target", from, toM, s.netSales);
  }
}

// Cumulative from Jan 1 2025 — find when we hit ~84.6M
let cum = 0;
const byDate = new Map<string, number>();
for (const r of rows) {
  if (!r.date || r.date < "2025-01-01" || r.date > end) continue;
  byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.netRevenue);
}
const dates = [...byDate.keys()].sort();
for (const d of dates) {
  cum += byDate.get(d)!;
  if (Math.abs(cum - target) < 500_000) {
    console.log("cumulative near target through", d, +cum.toFixed(0));
  }
}
