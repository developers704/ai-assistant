/**
 * Append a daily sales CSV + companion payment CSV into the bundled seed.
 *
 *   npx tsx scripts/append-daily-sales-and-payments.ts <sales.csv> <payments.csv>
 */
import fs from "fs";
import path from "path";
import { mergeSalesCsvAppend } from "../src/lib/reports/merge-sales-csv";
import { mergePaymentCsvAppend } from "../src/lib/reports/merge-payment-csv";
import { refreshSalesData } from "../src/lib/sales/refresh/service";
import { clearPaycodeOverlayCache } from "../src/lib/sales/paycode-overlay";

const salesPath = process.argv[2];
const payPath = process.argv[3];
if (!salesPath || !payPath) {
  console.error(
    "Usage: npx tsx scripts/append-daily-sales-and-payments.ts <sales.csv> <payments.csv>"
  );
  process.exit(1);
}
if (!fs.existsSync(salesPath) || !fs.existsSync(payPath)) {
  console.error("File not found:", salesPath, payPath);
  process.exit(1);
}

const seedSales = path.join(process.cwd(), "data/reports/Sales-Report.csv");
const seedPay = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");

const sales = mergeSalesCsvAppend(
  fs.readFileSync(seedSales, "utf8"),
  fs.readFileSync(salesPath, "utf8")
);
fs.writeFileSync(seedSales, sales.csvText, "utf8");

const payPrev = fs.existsSync(seedPay) ? fs.readFileSync(seedPay, "utf8") : "Transaction  #,Transaction Date,Type,Pay Code,Applied Amt\n";
const pay = mergePaymentCsvAppend(payPrev, fs.readFileSync(payPath, "utf8"));
fs.writeFileSync(seedPay, pay.csvText, "utf8");
clearPaycodeOverlayCache();

async function main() {
  const refresh = await refreshSalesData({ force: true, clearMemory: true });
  console.log(
    JSON.stringify(
      {
        sales: {
          newDates: sales.newDates,
          replacedDates: sales.replacedDates,
          keptOldRows: sales.keptOldRows,
          appendedRows: sales.appendedRows,
          totalRows: sales.totalRows,
          dateRange: sales.dateRange,
        },
        payments: {
          newDates: pay.newDates,
          replacedDates: pay.replacedDates,
          keptOldRows: pay.keptOldRows,
          appendedRows: pay.appendedRows,
          skippedDuplicateRows: pay.skippedDuplicateRows,
          totalRows: pay.totalRows,
        },
        refresh,
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
