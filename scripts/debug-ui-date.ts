import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { listReports, readReportCsv } from "../src/lib/reports/store";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import { querySales } from "../src/lib/sales/query-sales";
import { GET as salesGet } from "../src/app/api/sales/route";

async function main() {
  const reports = listReports();
  console.log(
    "reports",
    reports.slice(0, 2).map((r) => ({
      id: r.id,
      label: r.label,
      dateRange: r.dateRange,
      fileName: r.fileName,
    }))
  );
  const id = reports[0]?.id;
  if (!id) {
    console.error("no report");
    process.exit(1);
  }
  const csv = readReportCsv(id)!;
  const lines = csv.split(/\r?\n/).slice(0, 4);
  console.log("STORED CSV head:");
  for (const l of lines) console.log(l.slice(0, 140));

  const p = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const dateCol = p.meta.fields?.find((f) => /transaction\s*date/i.test(f));
  const samples = [...new Set(p.data.slice(0, 80).map((r) => r[dateCol!]))].slice(0, 20);
  console.log("dateCol", dateCol, "raw samples", samples);

  const { rows } = parseVendorPosRows(p.data as Record<string, unknown>[]);
  const dates = [...new Set(rows.map((r) => r.date).filter(Boolean))].sort();
  console.log("parsed dates", dates[0], "→", dates[dates.length - 1], `(${dates.length})`);

  // Simulate API the way the browser does
  for (const day of ["2026-07-17", "2026-07-19", "2026-07-01"]) {
    const url = new URL("http://localhost/api/sales");
    url.searchParams.set("date", day);
    const res = await salesGet({
      nextUrl: { searchParams: url.searchParams },
    } as never);
    const json = await res.json();
    console.log("\nAPI ?date=" + day, {
      units: json.summary?.totalTransactions,
      net: json.summary?.totalRevenue,
      recs: json.summary?.recommendations?.slice(0, 2),
      filterDate: json.filterDate,
      availFirst: json.availableDates?.[0],
      availLast: json.availableDates?.[json.availableDates?.length - 1],
      warnings: json.summary?.recommendations,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
