/**
 * One-shot: append a daily sales CSV into data/reports/Sales-Report.csv
 * (same-day replace), clear .data/reports, force-rebuild sales version.
 *
 * Usage: npx tsx scripts/append-daily-now.ts "C:\path\to\5th-aug.CSV"
 */
import fs from "fs";
import path from "path";
import { mergeSalesCsvAppend } from "../src/lib/reports/merge-sales-csv";
import { refreshSalesData } from "../src/lib/sales/refresh/service";

const seedPath = path.join(process.cwd(), "data", "reports", "Sales-Report.csv");
const dailyPath = process.argv[2];
const reportsDir = path.join(process.cwd(), ".data", "reports");

async function main() {
  if (!dailyPath || !fs.existsSync(dailyPath)) {
    console.error("Usage: npx tsx scripts/append-daily-now.ts <daily.csv>");
    process.exit(1);
  }
  if (!fs.existsSync(seedPath)) {
    console.error("Missing seed:", seedPath);
    process.exit(1);
  }

  const result = mergeSalesCsvAppend(
    fs.readFileSync(seedPath, "utf-8"),
    fs.readFileSync(dailyPath, "utf-8")
  );
  // OneDrive often EBUSY-locks Sales-Report.csv; write tmp then copy with retries.
  const tmpPath = `${seedPath}.tmp`;
  fs.writeFileSync(tmpPath, result.csvText, "utf-8");
  let lastErr: unknown = null;
  for (let i = 0; i < 10; i++) {
    try {
      fs.copyFileSync(tmpPath, seedPath);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    /* ignore */
  }
  if (lastErr) throw lastErr;

  if (fs.existsSync(reportsDir)) {
    for (const name of fs.readdirSync(reportsDir)) {
      fs.unlinkSync(path.join(reportsDir, name));
    }
  }

  // Seed changed → unified sales version must rebuild or Discounting/ranks stay stale
  const refresh = await refreshSalesData({ force: true, clearMemory: true });

  console.log(
    JSON.stringify(
      {
        dailyPath,
        newDates: result.newDates,
        replacedDates: result.replacedDates,
        keptOldRows: result.keptOldRows,
        appendedRows: result.appendedRows,
        totalRows: result.totalRows,
        dateRange: result.dateRange,
        suggestedLabel: result.suggestedLabel,
        seedBytes: fs.statSync(seedPath).size,
        cacheCleared: true,
        refresh: {
          success: refresh.success,
          dataVersion: refresh.dataVersion,
          dateRange: refresh.dateRange,
          errors: refresh.errors,
        },
      },
      null,
      2
    )
  );

  if (!refresh.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
