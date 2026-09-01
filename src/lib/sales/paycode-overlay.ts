/**
 * Payment-transaction overlay for Sales Dashboard.
 *
 * Match Payment `Transaction #` → sales `Transaction #`.
 * Paycode amounts use **Applied Amt** (not Payment Amt, not sales-line Total).
 *
 * Display / filter keys are the method after the store hyphen (`VJS-CASH` →
 * `CASH`) with ACIM→ACIMA, AFFR/AFRIM→AFFIRM, IDEA/IDEAL→IDDEAL,
 * SYNY/Synchrony truncations→SYNC (incl. SYNCHRO), PROG*→PROG,
 * WELL/WELS/WELLS FARGO/WE→WELLS.
 * Store prefixes (VJF, VIS, VJPB, …) are never listed as paycodes.
 * HR Management Sales has no paycode filter.
 *
 * Unfiltered Net Sales stays CSV **Total** (sales-report.mdc).
 * When a Paycode is selected, line revenue is that paycode's Applied Amt
 * allocated across the transaction's sales lines by |Total| share.
 *
 * Overlay (paycode **filter** allocation) skips blank Type and Returns/Refunds.
 * Paycodes **card** sums Applied Amt by payment `Transaction Date` (POS Excel
 * SUMIFS), including CR/OL/CL legs and Returns/Refunds. Blank Type / POS
 * grand-total rows stay excluded.
 *
 * Daily payment appends stay raw in Payment-Transactions.csv; this parse step
 * applies the same canonical rule for Aug 1 → current overlay dates.
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import type { VendorPosRow } from "@/lib/reports/types";
import { rowIncludesSalesperson, salespersonShare, resolveSalespersonFilterCode } from "@/lib/sales/salesperson-credit";
import { parseReportFilterDate } from "@/lib/reports/date-utils";
import {
  canonicalPaycode,
  canonicalizePaycodeList,
  sortPaycodeLabels,
} from "@/lib/sales/paycode-normalize";

export const PAYCODE_OVERLAY_VERSION = 4;
export { canonicalPaycode, canonicalizePaycodeList } from "@/lib/sales/paycode-normalize";

export type PaycodeAmountMap = Map<string, number>;
export type TxnPaycodeAmounts = Map<string, PaycodeAmountMap>;

/** One Applied Amt line from the payment CSV (POS Excel SUMIFS grain). */
export type PaycodeLeg = {
  txnId: string;
  date: string;
  store: string;
  code: string;
  amount: number;
  type: string;
};

function paymentTransactionsPath(): string {
  return path.join(process.cwd(), "data", "reports", "Payment-Transactions.csv");
}

function parseMoney(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw ?? "")
    .replace(/[$,]/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function findCol(columns: string[], ...tests: RegExp[]): string | null {
  for (const re of tests) {
    const hit = columns.find((c) => re.test(c.trim()));
    if (hit) return hit;
  }
  return null;
}

function normalizeTxnId(raw: string): string {
  return raw.trim().toUpperCase();
}

function normalizePaycode(raw: string): string {
  return canonicalPaycode(raw);
}

function normalizePaymentType(typeRaw: unknown): string {
  return String(typeRaw ?? "")
    .replace(/,+\s*$/, "")
    .trim();
}

function isReturnOrRefundType(type: string): boolean {
  return /^returns?$/i.test(type) || /^refunds?$/i.test(type);
}

function storeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ");
}

/**
 * Parse payment CSV → Applied Amt legs (POS Excel grain).
 * Skips blank Type (grand-total / junk rows) and rows without txn, date, or method.
 * Includes Returns/Refunds and CR/OL/CL/CSO legs.
 */
export function parsePaycodeLegs(csvText: string): PaycodeLeg[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const rows = (parsed.data ?? []).filter((r) =>
    Object.values(r).some((v) => String(v ?? "").trim())
  );
  const out: PaycodeLeg[] = [];
  if (!rows.length) return out;
  const columns = Object.keys(rows[0] ?? {});
  const txnCol = findCol(columns, /^transaction\s*#$/i, /^transaction\s*#/i);
  const payCol = findCol(columns, /^pay\s*code$/i, /^pay\s*codes?$/i);
  const appliedCol = findCol(columns, /^applied\s*amt$/i);
  const typeCol = findCol(columns, /^type$/i);
  const dateCol = findCol(columns, /^transaction\s*date$/i);
  const storeCol = findCol(columns, /^store$/i);
  if (!txnCol || !payCol || !appliedCol) return out;

  for (const rec of rows) {
    const type = typeCol ? normalizePaymentType(rec[typeCol]) : "Sales";
    if (!type) continue;
    const tid = normalizeTxnId(String(rec[txnCol] ?? ""));
    const code = canonicalPaycode(String(rec[payCol] ?? ""));
    const date = dateCol ? parseReportFilterDate(String(rec[dateCol] ?? "")) : null;
    if (!tid || !code || !date) continue;
    out.push({
      txnId: tid,
      date,
      store: storeCol ? String(rec[storeCol] ?? "").trim() : "",
      code,
      amount: parseMoney(rec[appliedCol]),
      type,
    });
  }
  return out;
}

/** Filter overlay: skip Returns/Refunds so refund legs do not allocate as Net Sales. */
export function overlayFromLegs(legs: PaycodeLeg[]): TxnPaycodeAmounts {
  const out: TxnPaycodeAmounts = new Map();
  for (const leg of legs) {
    if (isReturnOrRefundType(leg.type)) continue;
    const inner = out.get(leg.txnId) ?? new Map();
    inner.set(leg.code, (inner.get(leg.code) ?? 0) + leg.amount);
    out.set(leg.txnId, inner);
  }
  return out;
}

/** Parse payment CSV → Transaction # → Pay Code → Applied Amt sum. */
export function parsePaymentAppliedByTxn(csvText: string): TxnPaycodeAmounts {
  return overlayFromLegs(parsePaycodeLegs(csvText));
}

let cachedLegs: PaycodeLeg[] | null = null;
let cachedOverlay: TxnPaycodeAmounts | null = null;
let cachedMtime = 0;
let cachedVersion = 0;

export function clearPaycodeOverlayCache() {
  cachedLegs = null;
  cachedOverlay = null;
  cachedMtime = 0;
  cachedVersion = 0;
}

function hydratePaycodeCache(force = false) {
  const file = paymentTransactionsPath();
  if (!fs.existsSync(file)) {
    cachedLegs = [];
    cachedOverlay = new Map();
    cachedMtime = 0;
    cachedVersion = PAYCODE_OVERLAY_VERSION;
    return;
  }
  const mtime = fs.statSync(file).mtimeMs;
  if (
    !force &&
    cachedLegs &&
    cachedOverlay &&
    cachedMtime === mtime &&
    cachedVersion === PAYCODE_OVERLAY_VERSION
  ) {
    return;
  }
  cachedLegs = parsePaycodeLegs(fs.readFileSync(file, "utf8"));
  cachedOverlay = overlayFromLegs(cachedLegs);
  cachedMtime = mtime;
  cachedVersion = PAYCODE_OVERLAY_VERSION;
}

export function loadPaycodeLegs(force = false): PaycodeLeg[] {
  hydratePaycodeCache(force);
  return cachedLegs ?? [];
}

export function loadPaycodeOverlay(force = false): TxnPaycodeAmounts {
  hydratePaycodeCache(force);
  return cachedOverlay ?? new Map();
}

export function listPaycodes(overlay?: TxnPaycodeAmounts): string[] {
  const map = overlay ?? loadPaycodeOverlay();
  const set = new Set<string>();
  for (const inner of map.values()) {
    for (const code of inner.keys()) set.add(code);
  }
  return sortPaycodeLabels([...set]);
}

function txnPaycodesFromSalesCell(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((p) => normalizePaycode(p))
    .filter(Boolean);
}

/**
 * Applied Amt for selected paycodes on a txn.
 * Falls back to "has this code on the sales Pay Codes cell" with no amount
 * (caller should keep line Total in that case).
 */
export function txnSelectedAppliedAmt(
  overlay: TxnPaycodeAmounts,
  txnId: string,
  selected: string[]
): { amount: number; matched: boolean; hasOverlay: boolean } {
  if (!selected.length) return { amount: 0, matched: true, hasOverlay: false };
  const wanted = new Set(canonicalizePaycodeList(selected));
  const inner = overlay.get(normalizeTxnId(txnId));
  if (!inner) return { amount: 0, matched: false, hasOverlay: false };
  let amount = 0;
  let matched = false;
  for (const [code, amt] of inner) {
    if (wanted.has(code)) {
      matched = true;
      amount += amt;
    }
  }
  return { amount, matched, hasOverlay: true };
}

function scaleMoney(row: VendorPosRow, factor: number): VendorPosRow {
  if (factor === 1) return row;
  return {
    ...row,
    netRevenue: row.netRevenue * factor,
    grossSales: row.grossSales * factor,
    discountAmount: row.discountAmount * factor,
    margin: row.margin * factor,
  };
}

function scaleRow(row: VendorPosRow, factor: number): VendorPosRow {
  if (factor === 1) return row;
  return {
    ...scaleMoney(row, factor),
    quantity: row.quantity * factor,
  };
}

/**
 * When paycodes are selected, rewrite each line so Net = allocated Applied Amt.
 * Allocation weight = |line Total| within the txn (among `rows` passed in).
 *
 * Lines whose txn has no overlay but whose sales Pay Codes cell lists the
 * selected code keep CSV Total (cannot split without Applied Amt).
 */
export function applyPaycodeFilter(
  rows: VendorPosRow[],
  selectedPaycodes: string[],
  overlay?: TxnPaycodeAmounts
): VendorPosRow[] {
  if (!selectedPaycodes.length) return rows;
  const map = overlay ?? loadPaycodeOverlay();
  const wanted = canonicalizePaycodeList(selectedPaycodes);
  const wantedUpper = new Set(wanted);

  const byTxn = new Map<string, VendorPosRow[]>();
  for (const r of rows) {
    const tid = normalizeTxnId(r.transactionId || "");
    if (!tid) continue;
    const list = byTxn.get(tid) ?? [];
    list.push(r);
    byTxn.set(tid, list);
  }

  const out: VendorPosRow[] = [];
  for (const [tid, lines] of byTxn) {
    const { amount, matched, hasOverlay } = txnSelectedAppliedAmt(map, tid, wanted);
    if (hasOverlay && matched) {
      const weights = lines.map((r) => Math.abs(r.netRevenue));
      const weightSum = weights.reduce((s, w) => s + w, 0);
      lines.forEach((r, i) => {
        const share = weightSum > 0 ? weights[i]! / weightSum : 1 / lines.length;
        const allocated = amount * share;
        if (r.netRevenue === 0) {
          out.push({
            ...r,
            netRevenue: allocated,
            grossSales: allocated,
            discountAmount: 0,
          });
          return;
        }
        out.push(scaleMoney(r, allocated / r.netRevenue));
      });
      continue;
    }
    if (!hasOverlay) {
      const keep = lines.filter((r) =>
        txnPaycodesFromSalesCell(r.payCode).some((c) => wantedUpper.has(c.toUpperCase()))
      );
      out.push(...keep);
    }
  }
  return out;
}

function toPaycodeShareList(
  totals: Map<string, number>
): { name: string; revenue: number; share: number }[] {
  const list = [...totals.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  const sum = list.reduce((s, x) => s + x.revenue, 0) || 1;
  return list.map((x) => ({ ...x, share: (x.revenue / sum) * 100 }));
}

/**
 * Paycodes card / ranking: SUM Applied Amt by canonical method for payment
 * legs whose **Transaction Date** is in `[from, to]` (POS Excel SUMIFS).
 *
 * Date/store-only dashboard views include CR/OL/CL and Returns. Product /
 * salesperson filters pass `txnIds` so the card stays on those tickets.
 */
export function paycodeTotalsForPaymentWindow(opts: {
  from?: string | null;
  to?: string | null;
  stores?: string[];
  txnIds?: Iterable<string>;
  methods?: string[];
  includeReturns?: boolean;
  legs?: PaycodeLeg[];
}): { name: string; revenue: number; share: number }[] {
  const from = opts.from && opts.from.length >= 10 ? opts.from.slice(0, 10) : null;
  const to = opts.to && opts.to.length >= 10 ? opts.to.slice(0, 10) : null;
  const storeSet = opts.stores?.length
    ? new Set(opts.stores.map(storeKey))
    : null;
  const txnSet = opts.txnIds
    ? new Set(
        [...opts.txnIds].map((id) => normalizeTxnId(id)).filter(Boolean)
      )
    : null;
  const methodSet = opts.methods?.length
    ? new Set(canonicalizePaycodeList(opts.methods))
    : null;
  const includeReturns = opts.includeReturns !== false;
  const legs = opts.legs ?? loadPaycodeLegs();
  const totals = new Map<string, number>();
  for (const leg of legs) {
    if (!includeReturns && isReturnOrRefundType(leg.type)) continue;
    if (from && leg.date < from) continue;
    if (to && leg.date > to) continue;
    if (storeSet && !storeSet.has(storeKey(leg.store || "Unknown store"))) continue;
    if (txnSet && !txnSet.has(leg.txnId)) continue;
    if (methodSet && !methodSet.has(leg.code)) continue;
    totals.set(leg.code, (totals.get(leg.code) ?? 0) + leg.amount);
  }
  return toPaycodeShareList(totals);
}

/** SUM Applied Amt by Pay Code for txns present in `rows`. */
export function paycodeTotalsForRows(
  rows: VendorPosRow[],
  overlay?: TxnPaycodeAmounts
): { name: string; revenue: number; share: number }[] {
  const map = overlay ?? loadPaycodeOverlay();
  const txns = new Set(
    rows.map((r) => normalizeTxnId(r.transactionId || "")).filter(Boolean)
  );
  const totals = new Map<string, number>();
  for (const tid of txns) {
    const inner = map.get(tid);
    if (!inner) continue;
    for (const [code, amt] of inner) {
      totals.set(code, (totals.get(code) ?? 0) + amt);
    }
  }
  return toPaycodeShareList(totals);
}

/** Keep lines credited to this salesperson; scale money/qty by their split %. */
export function applySalespersonFilter(
  rows: VendorPosRow[],
  codes: string[]
): VendorPosRow[] {
  if (!codes.length) return rows;
  const needles = codes
    .map((c) => resolveSalespersonFilterCode(c))
    .filter(Boolean);
  const out: VendorPosRow[] = [];
  for (const r of rows) {
    for (const code of needles) {
      if (!rowIncludesSalesperson(r, code)) continue;
      const share = salespersonShare(r, code);
      out.push({
        ...scaleRow(r, share),
        salespersons: `${code}/100%`,
      });
      break;
    }
  }
  return out;
}

export function uniqueSubClasses(rows: VendorPosRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = (r.subClass ?? "").trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
