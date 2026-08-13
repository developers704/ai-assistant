import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { normalizePayCode, type PayChannel } from "@/lib/discounting/pay-codes";

/**
 * Overlay paycodes by Transaction # from `data/discounting/paycodes/*.csv`.
 *
 * Supports:
 * - Legacy: one row / txn with `Pay Codes` (single tender string)
 * - Daily payment export: multi-row / txn with `Pay Code` + `Payment Amt`
 */

export type PaycodeLeg = {
  raw: string;
  channel: PayChannel;
  amount: number;
};

export type TxnPaySplit = {
  legs: PaycodeLeg[];
  /** Distinct raw codes joined */
  payCodeLabel: string;
  channels: Set<PayChannel>;
};

function paycodesDir(): string {
  return path.join(process.cwd(), "data", "discounting", "paycodes");
}

function findCol(columns: string[], ...tests: RegExp[]): string | null {
  for (const re of tests) {
    const hit = columns.find((c) => re.test(c.trim()));
    if (hit) return hit;
  }
  return null;
}

function parseMoney(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw ?? "")
    .replace(/[$,]/g, "")
    .trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function isReturnType(raw: unknown): boolean {
  return /return/i.test(String(raw ?? ""));
}

/** True when Pay Codes is a single V1 channel (cash / CC / financing / lease / affirm). */
export function isSingleTenderPayCode(raw?: string | null): boolean {
  return normalizePayCode(raw) !== "unknown";
}

function buildSplit(legs: PaycodeLeg[]): TxnPaySplit {
  const channels = new Set<PayChannel>();
  const labels: string[] = [];
  for (const leg of legs) {
    channels.add(leg.channel);
    const r = leg.raw.replace(/,+\s*$/, "").trim();
    if (r && !labels.includes(r)) labels.push(r);
  }
  return { legs, payCodeLabel: labels.join(","), channels };
}

/**
 * Parse paycode CSV → Transaction # → payment legs (with amounts when present).
 * Return-type rows skipped.
 */
export function parseTxnPaySplitsCsv(csv: string): Map<string, TxnPaySplit> {
  const buckets = new Map<string, PaycodeLeg[]>();
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = parsed.data ?? [];
  if (!rows.length) return new Map();
  const columns = Object.keys(rows[0] ?? {});
  const txnCol = findCol(
    columns,
    /^transaction\s*#$/i,
    /^transaction\s*#/i
  );
  const payCol = findCol(
    columns,
    /^pay\s*codes?$/i,
    /^pay\s*code$/i
  );
  const amtCol = findCol(
    columns,
    /^payment\s*amt$/i,
    /^applied\s*amt$/i
  );
  const typeCol = findCol(columns, /^type$/i);
  if (!txnCol || !payCol) return new Map();

  for (const rec of rows) {
    if (typeCol && isReturnType(rec[typeCol])) continue;
    const tid = String(rec[txnCol] ?? "").trim();
    if (!tid) continue;
    const pay = String(rec[payCol] ?? "")
      .replace(/,+\s*$/, "")
      .trim();
    if (!pay) continue;

    // Legacy multi-code cell `CASH,CC` — skip until weighted (use amount rows instead)
    const parts = pay.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1 && !amtCol) continue;

    for (const part of parts.length ? parts : [pay]) {
      const channel = normalizePayCode(part);
      if (channel === "unknown") continue;
      const amount = amtCol ? parseMoney(rec[amtCol]) : 0;
      const list = buckets.get(tid) ?? [];
      list.push({
        raw: part.replace(/,+\s*$/, "").trim(),
        channel,
        amount,
      });
      buckets.set(tid, list);
    }
  }

  const out = new Map<string, TxnPaySplit>();
  for (const [tid, legs] of buckets) {
    if (!legs.length) continue;
    out.set(tid, buildSplit(legs));
  }
  return out;
}

/**
 * Legacy: Transaction # → single Pay Codes string (one channel only).
 * Multi-channel txns omitted.
 */
export function parseTxnPayCodesCsv(csv: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [tid, split] of parseTxnPaySplitsCsv(csv)) {
    const channels = [...split.channels].filter((c) => c !== "unknown");
    if (channels.length !== 1) continue;
    const first = split.legs.find((l) => l.channel === channels[0]);
    if (first) out.set(tid, first.raw);
  }
  return out;
}

let cachedSplits: Map<string, TxnPaySplit> | null = null;
let cachedSingle: Map<string, string> | null = null;

/** Load all paycode CSVs → txn payment splits (later files merge/overwrite legs). */
export function loadTxnPaySplits(forceReload = false): Map<string, TxnPaySplit> {
  if (cachedSplits && !forceReload) return cachedSplits;
  const dir = paycodesDir();
  const map = new Map<string, TxnPaySplit>();
  if (!fs.existsSync(dir)) {
    cachedSplits = map;
    return cachedSplits;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.csv$/i.test(f))
    .sort();
  for (const file of files) {
    const csv = fs.readFileSync(path.join(dir, file), "utf8");
    for (const [tid, split] of parseTxnPaySplitsCsv(csv)) {
      map.set(tid, split);
    }
  }
  cachedSplits = map;
  return cachedSplits;
}

/** Load single-tender overlay (compat). */
export function loadTxnPayCodes(forceReload = false): Map<string, string> {
  if (cachedSingle && !forceReload) return cachedSingle;
  const splits = loadTxnPaySplits(forceReload);
  const map = new Map<string, string>();
  for (const [tid, split] of splits) {
    const channels = [...split.channels].filter((c) => c !== "unknown");
    if (channels.length !== 1) continue;
    const first = split.legs.find((l) => l.channel === channels[0]);
    if (first) map.set(tid, first.raw);
  }
  cachedSingle = map;
  return cachedSingle;
}

export function clearTxnPayCodesCache(): void {
  cachedSplits = null;
  cachedSingle = null;
}

/** Cash + CC paid (CC as cash-equivalent) and financing/lease/affirm totals. */
export function summarizePaySplit(split: TxnPaySplit): {
  cashPaid: number;
  ccPaid: number;
  financePaid: number;
  financeChannel: PayChannel | null;
  isMultiTender: boolean;
  singleChannel: PayChannel | null;
  payCodeLabel: string;
} {
  let cashPaid = 0;
  let ccPaid = 0;
  let financePaid = 0;
  let financeChannel: PayChannel | null = null;
  for (const leg of split.legs) {
    if (leg.channel === "cash") cashPaid += leg.amount;
    else if (leg.channel === "credit_card") ccPaid += leg.amount;
    else if (
      leg.channel === "financing" ||
      leg.channel === "lease" ||
      leg.channel === "affirm"
    ) {
      financePaid += leg.amount;
      if (!financeChannel) financeChannel = leg.channel;
    }
  }
  const channels = [...split.channels].filter((c) => c !== "unknown");
  const hasDown = cashPaid > 0 || ccPaid > 0;
  const hasFinance = financePaid > 0 && financeChannel != null;
  const isMultiTender = hasDown && hasFinance;
  return {
    cashPaid,
    ccPaid,
    financePaid,
    financeChannel,
    isMultiTender,
    singleChannel: !isMultiTender && channels.length === 1 ? channels[0]! : null,
    payCodeLabel: split.payCodeLabel,
  };
}
