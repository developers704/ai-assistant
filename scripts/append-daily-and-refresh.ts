/**
 * Append a daily POS CSV into data/reports/Sales-Report.csv (same-day replace),
 * then force-refresh sales intelligence.
 *
 * Usage:
 *   npx tsx scripts/append-daily-and-refresh.ts "C:\path\to\10thaug.CSV"
 */
import fs from "fs";
import path from "path";
import { mergeSalesCsvAppend } from "../src/lib/reports/merge-sales-csv";
import { refreshSalesData } from "../src/lib/sales/refresh/service";

async function main() {
  const dailyPath = process.argv[2];
  if (!dailyPath || !fs.existsSync(dailyPath)) {
    console.error("Usage: npx tsx scripts/append-daily-and-refresh.ts <daily.csv>");
    process.exit(1);
  }

  const seedPath = path.join(process.cwd(), "data", "reports", "Sales-Report.csv");
  if (!fs.existsSync(seedPath)) {
    console.error("Missing seed:", seedPath);
    process.exit(1);
  }

  const prev = fs.readFileSync(seedPath, "utf-8");
  const next = fs.readFileSync(dailyPath, "utf-8");
  const merged = mergeSalesCsvAppend(prev, next);
  fs.writeFileSync(seedPath, merged.csvText, "utf-8");

  console.log(
    JSON.stringify(
      {
        seedPath,
        dailyPath,
        newDates: merged.newDates,
        replacedDates: merged.replacedDates,
        keptOldRows: merged.keptOldRows,
        appendedRows: merged.appendedRows,
        totalRows: merged.totalRows,
        dateRange: merged.dateRange,
        suggestedLabel: merged.suggestedLabel,
        bytes: fs.statSync(seedPath).size,
      },
      null,
      2
    )
  );

  const refresh = await refreshSalesData({ force: true, clearMemory: true });
  console.log("refresh:", JSON.stringify(refresh, null, 2));
  if (!refresh.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
