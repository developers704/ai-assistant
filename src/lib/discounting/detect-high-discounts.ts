import type { FinancingPlan, InventoryItem, ManagerTier } from "@/lib/inventory/types";
import {
  CREDIT_CARD_SURCHARGE_PERCENT,
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
import { resolveStoreDmOwner } from "@/lib/discounting/store-dm-owners";
import { loadTxnPackageMemos } from "@/lib/discounting/load-txn-memos";
import {
  loadTxnPayCodes,
  loadTxnPaySplits,
  summarizePaySplit,
  type TxnPaySplit,
} from "@/lib/discounting/load-txn-paycodes";
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
  /** Line Total / net sold (or package sold for multi-tender). */
  soldTotal: number;
  /** Calculator cash price for approver tier (package cash for multi). */
  cashPrice: number;
  /** Calculator final (line) — or paycode Payment Amt for finance packages. */
  ceilingAmount: number;
  surchargePercent: number;
  /**
   * Overage dollars.
   * Line / single-tender: soldTotal − calculator ceiling.
   * Finance package (paycode Payment Amt): calculated − Payment Amt when calculated is higher.
   */
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

function isItemPlaceholder(sku: string): boolean {
  return sku.trim().toUpperCase() === "ITEM";
}

function isMulberryLine(row: VendorPosRow): boolean {
  const sku = (row.sku || row.itemNumber || "").trim().toUpperCase();
  if (sku.startsWith("MLB")) return true;
  return /mulberry/i.test(row.description || "");
}

function isReturnRow(row: VendorPosRow): boolean {
  if (row.quantity < 0) return true;
  if (row.netRevenue < 0) return true;
  return false;
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

/** CC Payment Amt → cash-equivalent toward package cash ceiling. */
export function ccToCashEquivalent(ccPaid: number): number {
  if (!(ccPaid > 0)) return 0;
  return ccPaid / (1 + CREDIT_CARD_SURCHARGE_PERCENT / 100);
}

/**
 * Multi-tender: package cash − cash − CC(cash-eq) → remaining × finance surcharge
 * = calculated financed amount. Ceiling to compare against = paycode Payment Amt.
 * Flag when calculated > Payment Amt.
 */
export function multiTenderMaxFinance(opts: {
  packageCash: number;
  cashPaid: number;
  ccPaid: number;
  financeChannel: PayChannel;
  financingMonths: number | null;
}): { maxFinance: number; surchargePercent: number; remainingCash: number } | null {
  const ccEq = ccToCashEquivalent(opts.ccPaid);
  const remainingCash = Math.max(
    0,
    opts.packageCash - opts.cashPaid - ccEq
  );
  if (!(remainingCash > 0)) {
    return { maxFinance: 0, surchargePercent: 0, remainingCash: 0 };
  }
  const ceiling = calculatorCeilingAmount(
    remainingCash,
    opts.financeChannel,
    opts.financingMonths
  );
  if (!ceiling) return null;
  return {
    maxFinance: ceiling.ceiling,
    surchargePercent: ceiling.surchargePercent,
    remainingCash,
  };
}

function resolveApproverForTxn(
  approverCodes: string[],
  store: string,
  roles: Set<ManagerTier>
): ApproverEntry | null {
  const fromApp = pickApproverForV1(approverCodes);
  if (fromApp && roles.has(fromApp.role)) return fromApp;
  // APP missing: store territory DM / Rozina; ceiling uses their role (DM → dm tier)
  const fromStore = resolveStoreDmOwner(store);
  if (fromStore && roles.has(fromStore.role)) return fromStore;
  // Serra → AJ is dm; Rozina is cm — if we need DM tier math but CM name, still OK via role
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
    // Returns ignored for now
    if (isReturnRow(r)) return false;
    return true;
  });

  const descByTxn = new Map<string, string[]>();
  const payByTxn = new Map<string, string>();
  const rowsByTxn = new Map<string, VendorPosRow[]>();
  for (const r of scoped) {
    const tid = r.transactionId || "";
    if (!tid) continue;
    const list = descByTxn.get(tid) ?? [];
    if (r.description?.trim()) list.push(r.description.trim());
    descByTxn.set(tid, list);
    if (r.payCode?.trim() && !payByTxn.has(tid)) {
      payByTxn.set(tid, r.payCode.trim());
    }
    const bag = rowsByTxn.get(tid) ?? [];
    bag.push(r);
    rowsByTxn.set(tid, bag);
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

  const paySplits = loadTxnPaySplits();
  const payOverlay = loadTxnPayCodes();

  const hits: HighDiscountHit[] = [];
  let scannedProductLines = 0;
  let skippedNoApprover = 0;
  let skippedNoPricing = 0;
  let skippedNoPay = 0;

  const multiTxnIds = new Set<string>();

  // ── Multi-tender packages (cash|CC + financing) ──
  for (const [tid, split] of paySplits) {
    const summary = summarizePaySplit(split);
    if (!summary.isMultiTender || !summary.financeChannel) continue;
    const txnRows = rowsByTxn.get(tid);
    if (!txnRows?.length) continue;

    const store = txnRows[0]!.storeName;
    const approval = parseApprovalFromDescriptions(
      descByTxn.get(tid) ?? txnRows.map((r) => r.description)
    );
    const approver = resolveApproverForTxn(
      approval.approverCodes,
      store,
      roles
    );
    if (!approver) {
      skippedNoApprover++;
      continue;
    }

    // Financing needs months; lease/affirm do not
    if (
      summary.financeChannel === "financing" &&
      approval.financingMonths == null
    ) {
      skippedNoPay++;
      continue;
    }

    let packageCash = 0;
    let mulberryFace = 0;
    let packageSold = 0;
    let packageDisc = 0;
    let packageGross = 0;
    const skuLabels: string[] = [];
    let allowedPct = 0;
    let rulesSummary = "";

    for (const row of txnRows) {
      const sku = (row.sku || row.itemNumber || "").trim();
      if (!sku || isItemPlaceholder(sku)) continue;
      if (isHiddenDiscountSku(sku)) continue;
      if (row.netRevenue <= 0 && row.grossSales <= 0) continue;

      if (isMulberryLine(row)) {
        mulberryFace += Math.max(0, row.netRevenue);
        packageSold += Math.max(0, row.netRevenue);
        packageGross += Math.max(0, row.grossSales);
        continue;
      }

      // Jewelry / product lines in the package
      if (!(row.grossSales > 0)) continue;
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

      // APP missing → DM tier via store owner (AJ = dm). APP present → that role.
      const tier: ManagerTier =
        approval.approverCodes.length > 0 ? approver.role : "dm";
      const priced = tierCashPrice(resolved.item, tier);
      if (!(priced.cashPrice > 0)) {
        skippedNoPricing++;
        continue;
      }

      packageCash += priced.cashPrice;
      packageSold += Math.max(0, row.netRevenue);
      packageDisc += Math.max(0, row.discountAmount);
      packageGross += Math.max(0, row.grossSales);
      skuLabels.push(sku);
      scannedProductLines++;
      allowedPct = Math.max(allowedPct, priced.allowedPct);
      if (priced.rulesSummary) rulesSummary = priced.rulesSummary;
    }

    packageCash += mulberryFace;
    if (!(packageCash > 0) || !skuLabels.length) continue;

    const maxFin = multiTenderMaxFinance({
      packageCash,
      cashPaid: summary.cashPaid,
      ccPaid: summary.ccPaid,
      financeChannel: summary.financeChannel,
      financingMonths: approval.financingMonths,
    });
    if (!maxFin) {
      skippedNoPay++;
      continue;
    }

    multiTxnIds.add(tid);

    // Ceiling = paycode Payment Amt; flag when calculated > Payment Amt
    const paymentCeiling = summary.financePaid;
    const calculated = maxFin.maxFinance;
    if (calculated <= paymentCeiling + DOLLAR_EPSILON) continue;

    const overageDollars = calculated - paymentCeiling;
    hits.push({
      date: txnRows[0]!.date,
      store,
      transactionId: tid,
      sku: skuLabels.join("+"),
      itemNumber: skuLabels[0] || "",
      design: "",
      department: "",
      description: `Multi-tender package (${skuLabels.length} SKU${skuLabels.length === 1 ? "" : "s"}${mulberryFace > 0 ? " + Mulberry" : ""}) · calc $${calculated.toFixed(0)}`,
      salesAmount: packageGross,
      discAmt: packageDisc,
      soldTotal: calculated,
      cashPrice: packageCash,
      ceilingAmount: paymentCeiling,
      surchargePercent: maxFin.surchargePercent,
      overageDollars,
      overagePct:
        paymentCeiling > 0 ? (overageDollars / paymentCeiling) * 100 : 0,
      givenPct: packageGross > 0 ? (packageDisc / packageGross) * 100 : 0,
      allowedPct,
      payChannel: summary.financeChannel,
      payChannelLabel: `Split · ${PAY_CHANNEL_LABELS[summary.financeChannel]}`,
      payCode: summary.payCodeLabel,
      financingMonths: approval.financingMonths,
      approver,
      rulesSummary,
      approvalHints: approval.rawHits,
    });
  }

  // ── Single financing/lease/affirm with Payment Amt: package vs payment ──
  for (const [tid, split] of paySplits) {
    if (multiTxnIds.has(tid)) continue;
    const summary = summarizePaySplit(split);
    if (summary.isMultiTender) continue;
    if (!summary.financeChannel || !(summary.financePaid > 0)) continue;
    if (summary.singleChannel !== summary.financeChannel) continue;

    const txnRows = rowsByTxn.get(tid);
    if (!txnRows?.length) continue;

    const store = txnRows[0]!.storeName;
    const approval = parseApprovalFromDescriptions(
      descByTxn.get(tid) ?? txnRows.map((r) => r.description)
    );
    const approver = resolveApproverForTxn(
      approval.approverCodes,
      store,
      roles
    );
    if (!approver) {
      skippedNoApprover++;
      continue;
    }
    if (
      summary.financeChannel === "financing" &&
      approval.financingMonths == null
    ) {
      skippedNoPay++;
      continue;
    }

    let packageCash = 0;
    let mulberryFace = 0;
    let packageSold = 0;
    let packageDisc = 0;
    let packageGross = 0;
    const skuLabels: string[] = [];
    let allowedPct = 0;
    let rulesSummary = "";

    for (const row of txnRows) {
      const sku = (row.sku || row.itemNumber || "").trim();
      if (!sku || isItemPlaceholder(sku)) continue;
      if (isHiddenDiscountSku(sku)) continue;
      if (row.netRevenue <= 0 && row.grossSales <= 0) continue;

      if (isMulberryLine(row)) {
        mulberryFace += Math.max(0, row.netRevenue);
        packageSold += Math.max(0, row.netRevenue);
        packageGross += Math.max(0, row.grossSales);
        continue;
      }

      if (!(row.grossSales > 0)) continue;
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

      const tier: ManagerTier =
        approval.approverCodes.length > 0 ? approver.role : "dm";
      const priced = tierCashPrice(resolved.item, tier);
      if (!(priced.cashPrice > 0)) {
        skippedNoPricing++;
        continue;
      }

      packageCash += priced.cashPrice;
      packageSold += Math.max(0, row.netRevenue);
      packageDisc += Math.max(0, row.discountAmount);
      packageGross += Math.max(0, row.grossSales);
      skuLabels.push(sku);
      scannedProductLines++;
      allowedPct = Math.max(allowedPct, priced.allowedPct);
      if (priced.rulesSummary) rulesSummary = priced.rulesSummary;
    }

    packageCash += mulberryFace;
    if (!(packageCash > 0) || !skuLabels.length) continue;

    const ceiling = calculatorCeilingAmount(
      packageCash,
      summary.financeChannel,
      approval.financingMonths
    );
    if (!ceiling) {
      skippedNoPay++;
      continue;
    }

    multiTxnIds.add(tid);

    // Ceiling = paycode Payment Amt; flag when calculated > Payment Amt
    const paymentCeiling = summary.financePaid;
    const calculated = ceiling.ceiling;
    if (calculated <= paymentCeiling + DOLLAR_EPSILON) continue;

    const overageDollars = calculated - paymentCeiling;
    hits.push({
      date: txnRows[0]!.date,
      store,
      transactionId: tid,
      sku: skuLabels.join("+"),
      itemNumber: skuLabels[0] || "",
      design: "",
      department: "",
      description: `Finance package (${skuLabels.length} SKU${skuLabels.length === 1 ? "" : "s"}${mulberryFace > 0 ? " + Mulberry" : ""}) · calc $${calculated.toFixed(0)}`,
      salesAmount: packageGross,
      discAmt: packageDisc,
      soldTotal: calculated,
      cashPrice: packageCash,
      ceilingAmount: paymentCeiling,
      surchargePercent: ceiling.surchargePercent,
      overageDollars,
      overagePct:
        paymentCeiling > 0 ? (overageDollars / paymentCeiling) * 100 : 0,
      givenPct: packageGross > 0 ? (packageDisc / packageGross) * 100 : 0,
      allowedPct,
      payChannel: summary.financeChannel,
      payChannelLabel: PAY_CHANNEL_LABELS[summary.financeChannel],
      payCode: summary.payCodeLabel,
      financingMonths: approval.financingMonths,
      approver,
      rulesSummary,
      approvalHints: approval.rawHits,
    });
  }

  // ── Single-tender lines ──
  for (const row of scoped) {
    if (!isProductDiscountLine(row)) continue;
    const tid = row.transactionId;
    if (multiTxnIds.has(tid)) continue;
    scannedProductLines++;

    const approval = parseApprovalFromDescriptions(
      descByTxn.get(tid) ?? [row.description]
    );
    const approver = resolveApproverForTxn(
      approval.approverCodes,
      row.storeName,
      roles
    );
    if (!approver || !roles.has(approver.role)) {
      skippedNoApprover++;
      continue;
    }

    const split = paySplits.get(tid) as TxnPaySplit | undefined;
    const splitSummary = split ? summarizePaySplit(split) : null;

    let payRaw = "";
    let payChannel: PayChannel = "unknown";

    if (splitSummary?.singleChannel) {
      payRaw = splitSummary.payCodeLabel;
      payChannel = splitSummary.singleChannel;
    } else {
      payRaw =
        payOverlay.get(tid) ||
        row.payCode?.trim() ||
        payByTxn.get(tid) ||
        "";
      if (!payRaw) {
        skippedNoPay++;
        continue;
      }
      payChannel = normalizePayCode(payRaw);
    }

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

    const tier: ManagerTier =
      approval.approverCodes.length > 0 ? approver.role : "dm";
    const { cashPrice, allowedPct, rulesSummary } = tierCashPrice(
      resolved.item,
      tier
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
