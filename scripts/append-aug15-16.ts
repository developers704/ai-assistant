/**
 * Merge Aug 15 then Aug 16 into Sales-Report.csv (OneDrive/Excel-safe copy retries).
 * Run: npx tsx scripts/append-aug15-16.ts
 */
import fs from "fs";
import path from "path";
import { mergeSalesCsvAppend } from "../src/lib/reports/merge-sales-csv";
import { refreshSalesData } from "../src/lib/sales/refresh/service";

const seedPath = path.join(process.cwd(), "data", "reports", "Sales-Report.csv");
const reportsDir = path.join(process.cwd(), ".data", "reports");
const files = [
  "c:\\Users\\ACCTON-PC-KM-MR-60\\OneDrive\\Attachments\\Desktop\\15 aug report.CSV",
  "c:\\Users\\ACCTON-PC-KM-MR-60\\OneDrive\\Attachments\\Desktop\\aug-16.CSV",
];

async function copyWithRetry(src: string, dest: string): Promise<void> {
  let lastErr: unknown = null;
  for (let i = 0; i < 20; i++) {
    try {
      fs.copyFileSync(src, dest);
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

async function main() {
  let csv = fs.readFileSync(seedPath, "utf-8");
  const summaries = [];
  for (const dailyPath of files) {
    const result = mergeSalesCsvAppend(csv, fs.readFileSync(dailyPath, "utf-8"));
    csv = result.csvText;
    summaries.push({
      dailyPath,
      newDates: result.newDates,
      replacedDates: result.replacedDates,
      appendedRows: result.appendedRows,
      totalRows: result.totalRows,
      dateRange: result.dateRange,
    });
  }

  const tmpPath = `${seedPath}.tmp`;
  fs.writeFileSync(tmpPath, csv, "utf-8");
  await copyWithRetry(tmpPath, seedPath);
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    /* ignore */
  }

  if (fs.existsSync(reportsDir)) {
    for (const name of fs.readdirSync(reportsDir)) {
      fs.unlinkSync(path.join(reportsDir, name));
    }
  }

  const refresh = await refreshSalesData({ force: true, clearMemory: true });
  console.log(
    JSON.stringify(
      {
        summaries,
        seedBytes: fs.statSync(seedPath).size,
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
