import Papa from "papaparse";
import {
  getLatestReportMeta,
  getLatestReportWithSummary,
  readReportCsv,
} from "@/lib/reports/store";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";

/**
 * Same Transaction # package includes Item # = ITEM memo lines
 * (APP/EG, FINANCE SYNCHRONY 36/0). Those SKUs are excluded from
 * sales totals — re-read the live CSV so Discounting can join them.
 *
 * Only the newest month is kept (Discounting window) and the parse is
 * cached per CSV identity — the live seed is ~28MB, far too slow to
 * re-parse on every request.
 */

type MemoMaps = {
  descByTxn: Map<string, string[]>;
  payByTxn: Map<string, string>;
};

let cacheKey: string | null = null;
let cached: MemoMaps | null = null;

function monthOf(date: string): string {
  return date.slice(0, 7);
}

function buildMemoMaps(csv: string): MemoMaps {
  const descByTxn = new Map<string, string[]>();
  const payByTxn = new Map<string, string>();

  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const { rows } = parseVendorPosRows(parsed.data ?? []);

  let activeMonth = "";
  for (const r of rows) {
    if (r.date && monthOf(r.date) > activeMonth) activeMonth = monthOf(r.date);
  }

  for (const r of rows) {
    if (!r.date || monthOf(r.date) !== activeMonth) continue;
    const tid = (r.transactionId || "").trim();
    if (!tid) continue;

    const sku = (r.sku || r.itemNumber || "").trim().toUpperCase();
    const desc = (r.description || "").trim();
    const looksMemo =
      sku === "ITEM" ||
      /\bAPP\b|\bFIN\b|\bFINANCE\b|^APP\/|^FIN\//i.test(desc);

    if (looksMemo && desc) {
      const list = descByTxn.get(tid) ?? [];
      list.push(desc);
      descByTxn.set(tid, list);
    }
    if (r.payCode?.trim() && !payByTxn.has(tid)) {
      payByTxn.set(tid, r.payCode.trim());
    }
  }

  return { descByTxn, payByTxn };
}

export function clearTxnMemoCache(): void {
  cacheKey = null;
  cached = null;
}

export function loadTxnPackageMemos(_options?: {
  filterDate?: string | null;
  filterStore?: string | null;
}): MemoMaps {
  const meta = getLatestReportMeta();
  const csv = meta
    ? readReportCsv(meta.id)
    : getLatestReportWithSummary()?.csv ?? null;
  if (!csv) return { descByTxn: new Map(), payByTxn: new Map() };

  const key = `${meta?.id ?? "latest"}:${csv.length}`;
  if (cached && cacheKey === key) return cached;

  cached = buildMemoMaps(csv);
  cacheKey = key;
  return cached;
}
