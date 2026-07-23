import type { VendorPosRow } from "@/lib/reports/types";
import {
  loadSalespersonDirectory,
  resolveSalespersonLabelWithCode,
  type SalespersonDirectoryEntry,
} from "@/lib/sales/salesperson-directory";
import { salesUnitsSold } from "@/lib/utils";

export type SalespersonSplit = { code: string; percent: number };

export type SalespersonCredit = {
  code: string;
  /** Display label (name + code when known). */
  name: string;
  netSales: number;
  units: number;
  margin: number;
  transactions: number;
};

/** Extract `CODE/NN%` tokens from a Salespersons cell (trailing `-` ignored). */
export function parseSalespersonSplits(
  raw: string | null | undefined
): SalespersonSplit[] {
  if (raw == null || !String(raw).trim()) return [];
  const re = /([A-Za-z0-9_.-]+)\s*\/\s*(\d+(?:\.\d+)?)\s*%/g;
  const found: SalespersonSplit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(raw))) !== null) {
    const code = m[1].trim().toUpperCase();
    const percent = parseFloat(m[2]);
    if (!code || !Number.isFinite(percent) || percent <= 0) continue;
    found.push({ code, percent });
  }
  if (!found.length) return [];
  const sum = found.reduce((s, x) => s + x.percent, 0);
  if (sum <= 0) return [];
  if (Math.abs(sum - 100) < 0.05) return found;
  return found.map((x) => ({ code: x.code, percent: (x.percent / sum) * 100 }));
}

/** Fraction of line Total credited to this associate code (0–1). */
export function salespersonShare(row: VendorPosRow, code: string): number {
  const needle = code.trim().toUpperCase();
  if (!needle) return 0;
  const hit = parseSalespersonSplits(row.salespersons).find((s) => s.code === needle);
  return hit ? hit.percent / 100 : 0;
}

export function rowIncludesSalesperson(row: VendorPosRow, code: string): boolean {
  return salespersonShare(row, code) > 0;
}

/**
 * Credit each associate their share of line Total (net).
 * Units / margin attributed by share; ranking is primarily by credited net.
 */
export function creditSalespersonRows(
  rows: VendorPosRow[],
  directory?: Map<string, SalespersonDirectoryEntry>
): SalespersonCredit[] {
  const dir = directory ?? loadSalespersonDirectory();
  const map = new Map<
    string,
    { netSales: number; units: number; margin: number; txns: Set<string> }
  >();

  for (const r of rows) {
    const splits = parseSalespersonSplits(r.salespersons);
    if (!splits.length) continue;
    for (const s of splits) {
      const share = s.percent / 100;
      const cur = map.get(s.code) ?? {
        netSales: 0,
        units: 0,
        margin: 0,
        txns: new Set<string>(),
      };
      cur.netSales += r.netRevenue * share;
      cur.units += salesUnitsSold(r.quantity) * share;
      cur.margin += r.margin * share;
      if (r.transactionId) cur.txns.add(r.transactionId);
      map.set(s.code, cur);
    }
  }

  return [...map.entries()]
    .map(([code, v]) => ({
      code,
      name: resolveSalespersonLabelWithCode(code, dir),
      netSales: v.netSales,
      units: v.units,
      margin: v.margin,
      transactions: v.txns.size,
    }))
    .sort((a, b) => b.netSales - a.netSales || a.code.localeCompare(b.code));
}
