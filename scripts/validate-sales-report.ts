/**
 * Validate bundled + saved sales reports after upload / exclusion changes.
 * Run: npx tsx scripts/validate-sales-report.ts
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { parseVendorPosRows, summarizeVendorPos } from "../src/lib/reports/vendor-pos";
import { filterExcludedSalesRows } from "../src/lib/utils";

function parseCsvRecords(csvText: string): Record<string, unknown>[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse error");
  }
  return parsed.data;
}

function validateCsv(label: string, csvText: string) {
  const records = parseCsvRecords(csvText);
  const { rows, columns } = parseVendorPosRows(records);
  const kept = filterExcludedSalesRows(rows);
  const winderRows = rows.filter(
    (r) =>
      (r.vendorModel ?? "").toUpperCase().includes("WATCH WINDER") ||
      (r.sku ?? "").toUpperCase().includes("WATCH WINDER") ||
      (r.style ?? "").toUpperCase().includes("WATCH WINDER")
  );
  const winderKept = kept.filter(
    (r) =>
      (r.vendorModel ?? "").toUpperCase().includes("WATCH WINDER") ||
      (r.sku ?? "").toUpperCase().includes("WATCH WINDER")
  );
  const summary = summarizeVendorPos(rows, { period: "custom", schema: "store_sales" });
  const topWinder = (summary.summary.topProducts ?? []).find(
    (p) =>
      (p.vendorModel ?? "").toUpperCase().includes("WATCH WINDER") ||
      (p.name ?? "").toUpperCase().includes("WATCH WINDER")
  );
  const dates = [...new Set(kept.map((r) => r.date).filter(Boolean))].sort();

  console.log(`\n── ${label} ──`);
  console.log(`  columns: ${columns.length} | parsed: ${rows.length} | kept: ${kept.length}`);
  console.log(`  date range: ${dates[0] ?? "—"} → ${dates[dates.length - 1] ?? "—"} (${dates.length} days)`);
  console.log(`  watch winder rows: ${winderRows.length} raw → ${winderKept.length} after filter`);
  console.log(`  net sales: $${Math.round(summary.summary.totalRevenue ?? 0).toLocaleString()}`);
  console.log(`  top products: ${summary.summary.topProducts?.length ?? 0}`);
  console.log(`  watch winder in top 20: ${topWinder ? "YES — FAIL" : "no"}`);

  return {
    ok: winderKept.length === 0 && !topWinder && rows.length > 0,
    rows: rows.length,
    kept: kept.length,
  };
}

function main() {
  console.log("Sales report validation");

  const seedPath = path.join(process.cwd(), "data", "reports", "Sales-Report.csv");
  if (!fs.existsSync(seedPath)) {
    console.error("Missing seed CSV:", seedPath);
    process.exit(1);
  }
  const seed = validateCsv("Bundled seed (data/reports/Sales-Report.csv)", fs.readFileSync(seedPath, "utf-8"));

  const indexPath = path.join(process.cwd(), ".data", "reports", "index.json");
  let savedOk = true;
  if (fs.existsSync(indexPath)) {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as { id: string; fileName: string; label: string }[];
    const latest = index[0];
    if (latest) {
      const csvPath = path.join(process.cwd(), ".data", "reports", `${latest.id}.csv`);
      if (fs.existsSync(csvPath)) {
        const saved = validateCsv(
          `Saved report (${latest.label || latest.fileName})`,
          fs.readFileSync(csvPath, "utf-8")
        );
        savedOk = saved.ok;
        if (saved.rows !== seed.rows) {
          console.log(
            `\n  Note: saved report row count (${saved.rows}) differs from bundled seed (${seed.rows}). ` +
              "Re-upload in Data Analyst or restart the app to sync if the bundled file is newer."
          );
        }
      }
    }
  } else {
    console.log("\n  No .data/reports saved upload yet (seed only).");
  }

  const ok = seed.ok && savedOk;
  console.log(ok ? "\n✓ Sales report validation passed." : "\n✗ Sales report validation failed.");
  if (!ok) process.exit(1);
}

main();
