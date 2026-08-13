import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";
import {
  clearTxnPayCodesCache,
  parseTxnPayCodesCsv,
  parseTxnPaySplitsCsv,
} from "@/lib/discounting/load-txn-paycodes";

function paycodesDir(): string {
  return path.join(process.cwd(), "data", "discounting", "paycodes");
}

function detectPaycodeFileDate(csvText: string): string | null {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = parsed.data ?? [];
  if (!rows.length) return null;
  const columns = Object.keys(rows[0] ?? {});
  const dateCol =
    columns.find((c) => /transaction\s*date/i.test(c.trim())) ??
    columns.find((c) => /^date$/i.test(c.trim())) ??
    null;
  if (!dateCol) return null;
  const dates = new Set<string>();
  for (const r of rows) {
    const raw = r[dateCol];
    if (raw == null || raw === "") continue;
    const s = String(raw).trim();
    const parsedDate = parseReportFilterDate(s);
    if (parsedDate && isValidIsoDate(parsedDate)) {
      dates.add(parsedDate);
      continue;
    }
    // Excel serial (e.g. 46245 → 2026-08-11)
    if (/^\d{5}$/.test(s)) {
      const n = Number(s);
      const epoch = Date.UTC(1899, 11, 30) + n * 86400000;
      const d = new Date(epoch);
      if (!Number.isNaN(d.getTime())) {
        dates.add(d.toISOString().slice(0, 10));
      }
    }
  }
  if (!dates.size) return null;
  return [...dates].sort().at(-1) ?? null;
}

/**
 * Persist a daily paycode CSV under data/discounting/paycodes/{YYYY-MM-DD}.csv
 * and clear the in-memory overlay cache.
 */
export function saveTxnPaycodesCsv(
  csvText: string,
  opts?: { preferredDate?: string | null }
): {
  fileName: string;
  date: string;
  singleTenderTxnCount: number;
  txnSplitCount: number;
} {
  const text = csvText.trim();
  if (!text) throw new Error("Paycode file is empty");

  const map = parseTxnPayCodesCsv(text);
  const splits = parseTxnPaySplitsCsv(text);
  const date =
    (opts?.preferredDate && isValidIsoDate(opts.preferredDate)
      ? opts.preferredDate
      : null) ||
    detectPaycodeFileDate(text) ||
    new Date().toISOString().slice(0, 10);

  const dir = paycodesDir();
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${date}.csv`;
  fs.writeFileSync(path.join(dir, fileName), text, "utf8");
  clearTxnPayCodesCache();

  return {
    fileName,
    date,
    singleTenderTxnCount: map.size,
    txnSplitCount: splits.size,
  };
}
