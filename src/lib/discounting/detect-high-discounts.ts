import type { InventoryItem, ManagerTier } from "@/lib/inventory/types";
import { getAllowedDiscountPercent } from "@/lib/inventory/pricing";
import { lookupInventory } from "@/lib/inventory/store";
import type { VendorPosRow } from "@/lib/reports/types";
import { loadRankRows } from "@/lib/reports/load-rank-rows";
import { parseApprovalFromDescriptions } from "@/lib/discounting/parse-approval";
import { pickApproverForV1, DEFAULT_DISCOUNTING_ROLES, type ApproverEntry } from "@/lib/discounting/approvers";
import { loadTxnPackageMemos } from "@/lib/discounting/load-txn-memos";
import {
  normalizePayCode,
  PAY_CHANNEL_LABELS,
  type PayChannel,
} from "@/lib/discounting/pay-codes";

const PCT_EPSILON = 0.05;

/** Soft-hide from Discounting overage table (still in sales). Restore by removing SKU. */
const HIDDEN_DISCOUNT_SKUS = new Set(["731903468252"]);

function isHiddenDiscountSku(sku: string): boolean {
  const key = sku.trim().replace(/v$/i, "");
  return HIDDEN_DISCOUNT_SKUS.has(key);
}

export type HighDiscountHit = {
  date: string;
  store: string;
  transactionId: string;
  sku: string;
  itemNumber: string;
  design: string;
  department: string;
  description: string;
  salesAmount: number;
  discAmt: number;
  givenPct: number;
  allowedPct: number;
  overagePct: number;
  overageDollars: number;
  payChannel: PayChannel;
  payChannelLabel: string;
  payCode: string;
  financingMonths: number | null;
  approver: ApproverEntry;
  rulesSummary?: string;
  approvalHints: string[];
};

export type DetectHighDiscountsResult = {
  hits: HighDiscountHit[];
  scannedProductLines: number;
  skippedNoApprover: number;
  skippedNoPricing: number;
  availableDates: string[];
  filterDate: string | null;
};

function synthesizeItemFromRow(row: VendorPosRow): InventoryItem {
  const tag = row.grossSales > 0 ? row.grossSales : row.netRevenue + row.discountAmount;
  return {
    sku: row.sku || row.itemNumber,
    description: row.description,
    vendorModel: row.vendorModel,
    vendor: row.vendor,
    tagPrice: tag,
    costPrice: row.inventoryCost,
    wholesaleCost: row.wholesaleCost,
    store: row.storeName,
    onHand: 0,
    department: row.department,
    design: row.design,
    class: row.productClass,
    subClass: row.subClass,
    avgWeight: 0,
    brand: "",
  };
}

function resolveItem(row: VendorPosRow): {
  item: InventoryItem;
  source: "inventory" | "sales_row";
} | null {
  const sku = (row.sku || row.itemNumber || "").trim();
  if (!sku) return null;
  const found = lookupInventory(sku, row.storeName);
  if (found?.item) {
    const item = { ...found.item };
    if (!(item.tagPrice > 0) && row.grossSales > 0) item.tagPrice = row.grossSales;
    if (!item.department && row.department) item.department = row.department;
    if (!item.design && row.design) item.design = row.design;
    if (!item.class && row.productClass) item.class = row.productClass;
    if (!item.description && row.description) item.description = row.description;
    return { item, source: "inventory" };
  }
  return { item: synthesizeItemFromRow(row), source: "sales_row" };
}

function isProductDiscountLine(row: VendorPosRow): boolean {
  const sku = (row.sku || row.itemNumber || "").trim();
  if (!sku) return false;
  if (isHiddenDiscountSku(sku)) return false;
  if (row.grossSales <= 0) return false;
  if (!(row.discountAmount > 0)) return false;
  // Skip pure APP/FIN memo lines that somehow have amounts
  if (/^\s*(APP|FIN)\b/i.test(row.description) && !row.design && row.grossSales < 1) {
    return false;
  }
  return true;
}

export function detectHighDiscounts(options?: {
  filterDate?: string | null;
  filterStore?: string | null;
  /** Roles to flag (default: dm + cm + m). */
  roles?: ManagerTier[];
}): DetectHighDiscountsResult {
  const rows = loadRankRows() ?? [];
  const roles = new Set(
    options?.roles?.length ? options.roles : DEFAULT_DISCOUNTING_ROLES
  );
  const filterDate = options?.filterDate?.trim() || null;
  const filterStore = options?.filterStore?.trim().toUpperCase() || null;

  const dates = [...new Set(rows.map((r) => r.date).filter(Boolean))].sort();
  const effectiveDate =
    filterDate ||
    (dates.length ? dates[dates.length - 1] : null);

  const scoped = rows.filter((r) => {
    if (effectiveDate && r.date !== effectiveDate) return false;
    if (filterStore && r.storeName.trim().toUpperCase() !== filterStore) return false;
    return true;
  });

  // Product lines from filtered sales; ITEM APP/FIN memos reattached by Transaction #
  const descByTxn = new Map<string, string[]>();
  const payByTxn = new Map<string, string>();
  for (const r of scoped) {
    const tid = r.transactionId || "";
    if (!tid) continue;
    const list = descByTxn.get(tid) ?? [];
    if (r.description?.trim()) list.push(r.description.trim());
    descByTxn.set(tid, list);
    if (r.payCode?.trim() && !payByTxn.has(tid)) {
      payByTxn.set(tid, r.payCode.trim());
    }
  }
  const memos = loadTxnPackageMemos({
    filterDate: effectiveDate,
    filterStore,
  });
  for (const [tid, memosDesc] of memos.descByTxn) {
    const list = descByTxn.get(tid) ?? [];
    for (const d of memosDesc) {
      if (!list.includes(d)) list.push(d);
    }
    descByTxn.set(tid, list);
  }
  for (const [tid, pay] of memos.payByTxn) {
    if (!payByTxn.has(tid)) payByTxn.set(tid, pay);
  }

  const hits: HighDiscountHit[] = [];
  let scannedProductLines = 0;
  let skippedNoApprover = 0;
  let skippedNoPricing = 0;

  for (const row of scoped) {
    if (!isProductDiscountLine(row)) continue;
    scannedProductLines++;

    const tid = row.transactionId;
    const approval = parseApprovalFromDescriptions(descByTxn.get(tid) ?? [row.description]);
    const approver = pickApproverForV1(approval.approverCodes);
    if (!approver || !roles.has(approver.role)) {
      skippedNoApprover++;
      continue;
    }

    const resolved = resolveItem(row);
    if (!resolved) {
      skippedNoPricing++;
      continue;
    }

    const allowedPct = getAllowedDiscountPercent(resolved.item, approver.role);
    // Unpriced / zero-rule products: do not invent a high-discount flag
    if (
      resolved.source === "sales_row" &&
      !row.department &&
      !row.design &&
      !row.productClass
    ) {
      skippedNoPricing++;
      continue;
    }

    const salesAmount = row.grossSales;
    const discAmt = row.discountAmount;
    const givenPct = salesAmount > 0 ? (discAmt / salesAmount) * 100 : 0;
    if (givenPct <= allowedPct + PCT_EPSILON) continue;

    const payRaw = row.payCode?.trim() || payByTxn.get(tid) || "";
    const payChannel = normalizePayCode(payRaw);
    const overagePct = givenPct - allowedPct;
    const overageDollars = salesAmount * (overagePct / 100);

    hits.push({
      date: row.date,
      store: row.storeName,
      transactionId: tid,
      sku: row.sku || row.itemNumber,
      itemNumber: row.itemNumber || row.sku,
      design: row.design,
      department: row.department,
      description: row.description,
      salesAmount,
      discAmt,
      givenPct,
      allowedPct,
      overagePct,
      overageDollars,
      payChannel,
      payChannelLabel: PAY_CHANNEL_LABELS[payChannel],
      payCode: payRaw,
      financingMonths: approval.financingMonths,
      approver,
      approvalHints: approval.rawHits,
    });
  }

  hits.sort((a, b) => b.overageDollars - a.overageDollars);

  return {
    hits,
    scannedProductLines,
    skippedNoApprover,
    skippedNoPricing,
    availableDates: dates,
    filterDate: effectiveDate,
  };
}

export function formatHighDiscountsMarkdown(
  result: DetectHighDiscountsResult,
  limit = 25
): string {
  const dateLabel = result.filterDate ?? "all dates";
  if (!result.hits.length) {
    return `**High discounts** (${dateLabel}): none found above calculator limits for Manager / CM / DM approvers.`;
  }
  const lines = [
    `**High discounts** — ${dateLabel} (${result.hits.length} flag${result.hits.length === 1 ? "" : "s"})`,
    "",
  ];
  for (const h of result.hits.slice(0, limit)) {
    lines.push(
      `- **${h.store}** · ${h.sku} · txn \`${h.transactionId}\` · ${h.approver.name} (${h.approver.code})` +
        `\n  Given **${h.givenPct.toFixed(1)}%** vs allowed **${h.allowedPct.toFixed(1)}%**` +
        ` · Disc $${h.discAmt.toFixed(2)} on $${h.salesAmount.toFixed(2)}` +
        ` · ${h.payChannelLabel}` +
        (h.financingMonths ? ` · ${h.financingMonths} mo` : "")
    );
  }
  if (result.hits.length > limit) {
    lines.push(`\n_…and ${result.hits.length - limit} more._`);
  }
  return lines.join("\n");
}
