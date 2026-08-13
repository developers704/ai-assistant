import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { normalizePayCode } from "@/lib/discounting/pay-codes";

/**
 * Overlay Pay Codes by Transaction # from `data/discounting/paycodes/*.csv`
 * (e.g. 2026-08-11.csv from Umair daily paycode export).
 *
 * V1: only single-tender codes (one CASH / CC / IDDEAL / …). Multi-tender
 * (`CASH,CC`) stays out of the map so Discounting skips those txns for now.
 */

function paycodesDir(): string {
  return path.join(process.cwd(), "data", "discounting", "paycodes");
}

function findTxnCol(columns: string[]): string | null {
  return (
    columns.find((c) => /^transaction\s*#$/i.test(c.trim())) ??
    columns.find((c) => /transaction/i.test(c) && /#/.test(c)) ??
    null
  );
}

function findPayCol(columns: string[]): string | null {
  return (
    columns.find((c) => /^pay\s*codes?$/i.test(c.trim())) ??
    columns.find((c) => /pay/i.test(c) && /code/i.test(c)) ??
    null
  );
}

/** True when Pay Codes is a single V1 channel (cash / CC / financing / lease / affirm). */
export function isSingleTenderPayCode(raw?: string | null): boolean {
  return normalizePayCode(raw) !== "unknown";
}

/**
 * Parse one paycode CSV → Transaction # → Pay Codes (raw string).
 * First non-empty pay wins per txn. Multi-tender rows omitted.
 */
export function parseTxnPayCodesCsv(csv: string): Map<string, string> {
  const out = new Map<string, string>();
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = parsed.data ?? [];
  if (!rows.length) return out;
  const columns = Object.keys(rows[0] ?? {});
  const txnCol = findTxnCol(columns);
  const payCol = findPayCol(columns);
  if (!txnCol || !payCol) return out;

  for (const rec of rows) {
    const tid = String(rec[txnCol] ?? "").trim();
    if (!tid) continue;
    const pay = String(rec[payCol] ?? "").trim();
    if (!pay) continue;
    if (out.has(tid)) continue;
    // V1: ignore multi-tender / unknown (cash+CC, dual finance, …)
    if (!isSingleTenderPayCode(pay)) continue;
    out.set(tid, pay.replace(/,+\s*$/, "").trim());
  }
  return out;
}

let cached: Map<string, string> | null = null;

/** Load all `data/discounting/paycodes/*.csv` (later files overwrite earlier on same txn). */
export function loadTxnPayCodes(forceReload = false): Map<string, string> {
  if (cached && !forceReload) return cached;
  const dir = paycodesDir();
  const map = new Map<string, string>();
  if (!fs.existsSync(dir)) {
    cached = map;
    return cached;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.csv$/i.test(f))
    .sort();
  for (const file of files) {
    const csv = fs.readFileSync(path.join(dir, file), "utf8");
    for (const [tid, pay] of parseTxnPayCodesCsv(csv)) {
      map.set(tid, pay);
    }
  }
  cached = map;
  return cached;
}

/** Clear cache after uploading a new daily paycode file. */
export function clearTxnPayCodesCache(): void {
  cached = null;
}
