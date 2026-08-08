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
 */
export function loadTxnPackageMemos(options?: {
  filterDate?: string | null;
  filterStore?: string | null;
}): {
  descByTxn: Map<string, string[]>;
  payByTxn: Map<string, string>;
} {
  const descByTxn = new Map<string, string[]>();
  const payByTxn = new Map<string, string>();

  const meta = getLatestReportMeta();
  const csv = meta
    ? readReportCsv(meta.id)
    : getLatestReportWithSummary()?.csv ?? null;
  if (!csv) return { descByTxn, payByTxn };

  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const { rows } = parseVendorPosRows(parsed.data ?? []);
  const filterDate = options?.filterDate?.trim() || null;
  const filterStore = options?.filterStore?.trim().toUpperCase() || null;

  for (const r of rows) {
    if (filterDate && r.date !== filterDate) continue;
    if (filterStore && r.storeName.trim().toUpperCase() !== filterStore) continue;
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
