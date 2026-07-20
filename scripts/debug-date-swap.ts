import { readActivePointer, readNormalizedRows, readVersionMetadata } from "../src/lib/sales/data/version-store";
import { getLatestReportWithSummary } from "../src/lib/reports/store";
import { querySales } from "../src/lib/sales/query-sales";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import Papa from "papaparse";
import fs from "fs";
import path from "path";

async function main() {
  const v = readActivePointer().activeVersion;
  const rows = readNormalizedRows(v ?? undefined) ?? [];
  const dates = [...new Set(rows.map((r) => r.date).filter(Boolean))].sort();
  console.log("version", v);
  console.log("normalized dates", dates);
  console.log("version meta", readVersionMetadata(v ?? "")?.dateRange);

  const m = getLatestReportWithSummary();
  console.log("availableDates", m?.availableDates);
  console.log("report meta dateRange", m?.meta?.dateRange);

  const csv = fs.readFileSync(path.join(process.cwd(), "data", "reports", "Sales-Report.csv"), "utf8");
  const parsed = Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: true });
  const { rows: parsedRows } = parseVendorPosRows(parsed.data);
  const parsedDates = [...new Set(parsedRows.map((r) => r.date).filter(Boolean))].sort();
  console.log("fresh parse dates", parsedDates.slice(0, 5), "...", parsedDates.slice(-5));
  console.log("sample raw date col", parsed.data[0]?.["Transaction Date"], "→", parsedRows[0]?.date);

  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-07-17", endDate: "2026-07-17" },
    exactFilters: true,
    resetContext: true,
    include: { summary: true },
  });
  console.log("query Jul 17", {
    ok: q.ok,
    warnings: q.warnings,
    coverage: q.coverage,
    units: q.summary?.unitsSold,
    loadedDatesHint: q.availability,
    resolved: q.query?.resolvedDateRange,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
