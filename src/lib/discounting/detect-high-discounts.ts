import type { FinancingPlan, InventoryItem, ManagerTier } from "@/lib/inventory/types";
import {
  calculateFinancedPrice,
  calculatePricing,
} from "@/lib/inventory/pricing";
import { lookupInventory } from "@/lib/inventory/store";
import type { VendorPosRow } from "@/lib/reports/types";
import { loadRankRows } from "@/lib/reports/load-rank-rows";
import { parseApprovalFromDescriptions } from "@/lib/discounting/parse-approval";
import {
  pickApproverForV1,
  DEFAULT_DISCOUNTING_ROLES,
  type ApproverEntry,
} from "@/lib/discounting/approvers";
import { loadTxnPackageMemos } from "@/lib/discounting/load-txn-memos";
import { loadTxnPayCodes } from "@/lib/discounting/load-txn-paycodes";
import {
  normalizePayCode,
  PAY_CHANNEL_LABELS,
  type PayChannel,
} from "@/lib/discounting/pay-codes";

/** Ignore sub-cent noise when comparing Total vs calculator ceiling. */
const DOLLAR_EPSILON = 0.01;

/** Soft-hide from Discounting overage table (still in sales). Restore by removing SKU. */
const HIDDEN_DISCOUNT_SKUS = new Set(["731903468252", "225392-18"]);

function isHiddenDiscountSku(sku: string): boolean {
  const key = sku.trim().replace(/v$/i, "").toUpperCase();
  return HIDDEN_DISCOUNT_SKUS.has(key);
}

const MONTHS_TO_PLAN: Record<number, FinancingPlan> = {
  6: "6_months",
  12: "12_months",
  18: "18_months",
  24: "24_months",
  36: "36_months",
  48: "48_months",
  60: "60_months",
};

export type HighDiscountHit = {
  date: string;
  store: string;
  transactionId: string;
  sku: string;
  itemNumber: string;
  design: string;
  department: string;
  description: string;
  /** Sales Amount (gross / tag side). */
  salesAmount: number;
  discAmt: number;
  /** Line Total / net sold. */
  soldTotal: number;
  /** Calculator cash price for approver tier. */
  cashPrice: number;
  /** Calculator final for this single tender (cash/CC/financing/lease/affirm). */
  ceilingAmount: number;
  surchargePercent: number;
  /** soldTotal − ceilingAmount when over. */
  overageDollars: number;
  /** Overage as % of ceiling. */
  overagePct: number;
  /** Legacy display: disc % off sales amount. */
  givenPct: number;
  /** Legacy display: allowed off-tag % for tier. */
  allowedPct: number;
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
  skippedNoPay: number;
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
  if (/^\s*(APP|FIN)\b/i.test(row.description) && !row.design && row.grossSales < 1) {
    return false;
  }
  return true;
}

function tierCashPrice(item: InventoryItem, tier: ManagerTier): {
  cashPrice: number;
  allowedPct: number;
  rulesSummary: string;
} {
  const pricing = calculatePricing(item);
  const t = pricing.tiers.find((x) => x.tier === tier);
  return {
    cashPrice: t?.cashPrice ?? 0,
    allowedPct: t?.discountPercent ?? 0,
    rulesSummary: pricing.rulesSummary,
  };
}

/**
 * Single-tender calculator ceiling.
 * Financing requires months (12/0 → 12_months → 7% surcharge).
 * Missing pay channel or months → null (do not flag).
 */
export function calculatorCeilingAmount(
  cashPrice: number,
  channel: PayChannel,
  financingMonths: number | null
): { ceiling: number; surchargePercent: number } | null {
  if (!(cashPrice > 0)) return null;
  if (channel === "unknown") return null;

  if (channel === "cash") {
    return { ceiling: cashPrice, surchargePercent: 0 };
  }

  if (channel === "credit_card") {
    const { financedPrice, surchargePercent } = calculateFinancedPrice(
      cashPrice,
      "credit_card",
      "12_months"
    );
    return { ceiling: financedPrice, surchargePercent };
  }

  if (channel === "lease") {
    const { financedPrice, surchargePercent } = calculateFinancedPrice(
      cashPrice,
      "lease",
      "12_months"
    );
    return { ceiling: financedPrice, surchargePercent };
  }

  if (channel === "affirm") {
    const { financedPrice, surchargePercent } = calculateFinancedPrice(
      cashPrice,
      "affirm",
      "12_months"
    );
    return { ceiling: financedPrice, surchargePercent };
  }

  if (channel === "financing") {
    if (financingMonths == null) return null;
    const plan = MONTHS_TO_PLAN[financingMonths];
    if (!plan) return null;
    const { financedPrice, surchargePercent } = calculateFinancedPrice(
      cashPrice,
      "financing",
      plan
    );
    return { ceiling: financedPrice, surchargePercent };
  }

  return null;
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
    filterDate || (dates.length ? dates[dates.length - 1] : null);

  const scoped = rows.filter((r) => {
    if (effectiveDate && r.date !== effectiveDate) return false;
    if (filterStore && r.storeName.trim().toUpperCase() !== filterStore) {
      return false;
    }
    return true;
  });

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

  // Daily paycode export (Transaction # → single-tender Pay Codes). Wins over sales CSV.
  const payOverlay = loadTxnPayCodes();

  const hits: HighDiscountHit[] = [];
  let scannedProductLines = 0;
  let skippedNoApprover = 0;
  let skippedNoPricing = 0;
  let skippedNoPay = 0;

  for (const row of scoped) {
    if (!isProductDiscountLine(row)) continue;
    scannedProductLines++;

    const tid = row.transactionId;
    const approval = parseApprovalFromDescriptions(
      descByTxn.get(tid) ?? [row.description]
    );
    const approver = pickApproverForV1(approval.approverCodes);
    if (!approver || !roles.has(approver.role)) {
      skippedNoApprover++;
      continue;
    }

    // Prefer paycode overlay (Aug 11 file, …); else sales/memo pay. Multi-tender → skip.
    const payRaw =
      payOverlay.get(tid) ||
      row.payCode?.trim() ||
      payByTxn.get(tid) ||
      "";
    if (!payRaw) {
      skippedNoPay++;
      continue;
    }
    const payChannel = normalizePayCode(payRaw);
    if (payChannel === "unknown") {
      skippedNoPay++;
      continue;
    }

    const resolved = resolveItem(row);
    if (!resolved) {
      skippedNoPricing++;
      continue;
    }
    if (
      resolved.source === "sales_row" &&
      !row.department &&
      !row.design &&
      !row.productClass
    ) {
      skippedNoPricing++;
      continue;
    }

    const { cashPrice, allowedPct, rulesSummary } = tierCashPrice(
      resolved.item,
      approver.role
    );
    if (!(cashPrice > 0)) {
      skippedNoPricing++;
      continue;
    }

    const ceiling = calculatorCeilingAmount(
      cashPrice,
      payChannel,
      approval.financingMonths
    );
    if (!ceiling) {
      // Financing without months (or unsupported term) — do not show
      skippedNoPay++;
      continue;
    }

    const soldTotal = row.netRevenue;
    if (soldTotal <= ceiling.ceiling + DOLLAR_EPSILON) continue;

    const overageDollars = soldTotal - ceiling.ceiling;
    const salesAmount = row.grossSales;
    const discAmt = row.discountAmount;
    const givenPct = salesAmount > 0 ? (discAmt / salesAmount) * 100 : 0;

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
      soldTotal,
      cashPrice,
      ceilingAmount: ceiling.ceiling,
      surchargePercent: ceiling.surchargePercent,
      overageDollars,
      overagePct:
        ceiling.ceiling > 0 ? (overageDollars / ceiling.ceiling) * 100 : 0,
      givenPct,
      allowedPct,
      payChannel,
      payChannelLabel: PAY_CHANNEL_LABELS[payChannel],
      payCode: payRaw,
      financingMonths: approval.financingMonths,
      approver,
      rulesSummary,
      approvalHints: approval.rawHits,
    });
  }

  hits.sort((a, b) => b.overageDollars - a.overageDollars);

  return {
    hits,
    scannedProductLines,
    skippedNoApprover,
    skippedNoPricing,
    skippedNoPay,
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
    return `**High discounts** (${dateLabel}): none — all Totals within Price Calculator ceilings for APP + paycode.`;
  }
  const lines = [
    `**High discounts** — ${dateLabel} (${result.hits.length} flag${result.hits.length === 1 ? "" : "s"})`,
    "",
  ];
  for (const h of result.hits.slice(0, limit)) {
    lines.push(
      `- **${h.store}** · ${h.sku} · txn \`${h.transactionId}\` · ${h.approver.name} (${h.approver.code})` +
        `\n  Sold **$${h.soldTotal.toFixed(2)}** vs ceiling **$${h.ceilingAmount.toFixed(2)}**` +
        ` · over +$${h.overageDollars.toFixed(2)}` +
        ` · ${h.payChannelLabel}` +
        (h.financingMonths ? ` · ${h.financingMonths}/0` : "")
    );
  }
  if (result.hits.length > limit) {
    lines.push(`\n_…and ${result.hits.length - limit} more._`);
  }
  return lines.join("\n");
}
