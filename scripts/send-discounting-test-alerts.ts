/**
 * Send current Discounting overages to AJ/Shaun test recipients.
 *
 * Preview:
 *   npx tsx scripts/send-discounting-test-alerts.ts --dry-run [YYYY-MM-DD]
 * Send:
 *   npx tsx scripts/send-discounting-test-alerts.ts [YYYY-MM-DD]
 */
import { sendDiscountingEmailAlerts } from "../src/lib/discounting/email-alerts";

const dryRun = process.argv.includes("--dry-run");
const date =
  process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? null;
const transactionId =
  process.argv.find((arg) => arg.startsWith("--txn="))?.slice(6) ?? null;
const sku = process.argv.find((arg) => arg.startsWith("--sku="))?.slice(6) ?? null;

async function main() {
  const results = await sendDiscountingEmailAlerts({
    filterDate: date,
    dryRun,
    transactionId,
    sku,
  });

  console.log(JSON.stringify({ dryRun, results }, null, 2));

  if (!dryRun && results.some((r) => !r.sent && !r.skippedDuplicate)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
