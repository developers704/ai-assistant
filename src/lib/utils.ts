import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPieceCount(units: number): string {
  const n = Math.round(units);
  return n === 1 ? "1 pc" : `${n.toLocaleString()} pcs`;
}

/**
 * Rows removed from the sales report entirely (all aggregates + Top 20).
 * See .cursor/rules/sales-report.mdc
 */
const EXCLUDED_SALES_SKUS = new Set([
  "ITEM",
  "250000",
  "217365",
  "217286",
  "159004",
  "JVS-200940",
  "229080", // White bag with blue ribbon — packaging / $0 sale line
  "WATCH WINDER-1",
  "WATCH WINDER",
]);

/** True when vendor model matches an excluded product (e.g. complimentary watch winder). */
export function isExcludedSalesVendorModel(vendorModel?: string | null): boolean {
  const normalized = (vendorModel ?? "").trim().toUpperCase();
  if (!normalized) return false;
  if (normalized === "WATCH WINDER" || normalized.startsWith("WATCH WINDER")) return true;
  return false;
}

/**
 * Earring pad / screwback pad accessory lines (e.g. "… Pad [s]") — not jewelry product revenue.
 * Match description / style / vendor model text.
 */
export function isExcludedSalesPadLine(text?: string | null): boolean {
  const normalized = (text ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return /\bPAD\s*\[S\]/.test(normalized);
}

/** True when SKU / Item # matches an excluded product rule. */
export function isExcludedSalesSku(sku?: string | null): boolean {
  const normalized = (sku ?? "").trim().toUpperCase();
  if (!normalized) return false;
  if (EXCLUDED_SALES_SKUS.has(normalized)) return true;
  if (normalized.startsWith("MLB-")) return true;
  if (normalized.startsWith("WATCH WINDER")) return true;
  return false;
}

/** @deprecated Use isExcludedSalesSku — kept for older call sites. */
export function isExcludedTopProductSku(sku?: string | null): boolean {
  return isExcludedSalesSku(sku);
}

export function isItemPlaceholderSku(sku?: string | null): boolean {
  return isExcludedSalesSku(sku);
}

/** True when a parsed sales row should be dropped from the report. */
export function isExcludedSalesRow(row: {
  sku?: string | null;
  itemNumber?: string | null;
  department?: string | null;
  vendorModel?: string | null;
  style?: string | null;
  description?: string | null;
}): boolean {
  const dept = (row.department ?? "").trim();
  if (!dept || dept === "—" || /^uncategorized$/i.test(dept)) return true;
  if (isExcludedSalesVendorModel(row.vendorModel)) return true;
  if (
    isExcludedSalesPadLine(row.description) ||
    isExcludedSalesPadLine(row.style) ||
    isExcludedSalesPadLine(row.vendorModel)
  ) {
    return true;
  }
  const sku =
    (row.sku ?? "").trim() ||
    (row.itemNumber ?? "").trim() ||
    (row.style ?? "").trim();
  return isExcludedSalesSku(sku);
}

/** Bump when exclusion / return-pair rules change so cached sales versions rebuild. */
export const SALES_EXCLUSION_RULES_VERSION = 8;

type SalesReturnPairRow = {
  sku?: string | null;
  itemNumber?: string | null;
  department?: string | null;
  storeName?: string | null;
  quantity?: number | null;
  netRevenue?: number | null;
  grossSales?: number | null;
  transactionId?: string | null;
  vendorModel?: string | null;
};

function roundMoneyCents(n: number): number {
  return Math.round(n * 100);
}

function salesItemKey(row: SalesReturnPairRow): string {
  return (row.vendorModel || row.sku || row.itemNumber || "").trim().toUpperCase();
}

function salesSkuKey(row: SalesReturnPairRow): string {
  return (row.sku || row.itemNumber || "").trim().toUpperCase();
}

/** Absolute amount used for pairing — prefer Total (net), fall back to gross sales. */
function pairAmountCents(row: SalesReturnPairRow): number {
  const net = Number(row.netRevenue ?? 0);
  if (net !== 0) return roundMoneyCents(Math.abs(net));
  return roundMoneyCents(Math.abs(Number(row.grossSales ?? 0)));
}

/** Return / void leg: negative qty, or negative net/gross (covers corrupted +qty on returns). */
function isReturnLeg(row: SalesReturnPairRow): boolean {
  const qty = Number(row.quantity ?? 0);
  if (qty < 0) return true;
  const net = Number(row.netRevenue ?? 0);
  if (net < 0) return true;
  const gross = Number(row.grossSales ?? 0);
  return gross < 0;
}

function isSaleLeg(row: SalesReturnPairRow): boolean {
  const qty = Number(row.quantity ?? 0);
  const net = Number(row.netRevenue ?? 0);
  const gross = Number(row.grossSales ?? 0);
  if (qty < 0 || net < 0 || gross < 0) return false;
  return qty > 0 || net > 0 || gross > 0;
}

function findReturnPairMatch(
  rows: SalesReturnPairRow[],
  negIdx: number,
  usedPositive: Set<number>,
  drop: Set<number>,
  requireSameTxn: boolean
): number {
  const neg = rows[negIdx];
  if (!isReturnLeg(neg)) return -1;

  const store = (neg.storeName ?? "").trim().toLowerCase();
  if (!store) return -1;
  const amountCents = pairAmountCents(neg);
  if (!(amountCents > 0)) return -1;
  const item = salesItemKey(neg);
  const sku = salesSkuKey(neg);
  const txn = (neg.transactionId ?? "").trim().toUpperCase();
  const absNegQty = Math.abs(Number(neg.quantity ?? 0));

  // Cross-txn pairing must not steal exchange returns: if this receipt still has
  // a different sale line, keep the negative for net revenue.
  if (!requireSameTxn && txn && txnHasOtherSaleContext(rows, negIdx, drop)) {
    return -1;
  }

  for (let j = 0; j < rows.length; j++) {
    if (negIdx === j || drop.has(j) || usedPositive.has(j)) continue;
    const pos = rows[j];
    if (!isSaleLeg(pos)) continue;
    if ((pos.storeName ?? "").trim().toLowerCase() !== store) continue;
    if (pairAmountCents(pos) !== amountCents) continue;

    const posItem = salesItemKey(pos);
    const posSku = salesSkuKey(pos);
    if (sku && posSku && sku !== posSku) continue;
    if (!sku && item && posItem && item !== posItem) continue;
    if (item && posItem && item !== posItem) continue;

    // Prefer matching opposite absolute qty when both legs have a real qty signal
    const absPosQty = Math.abs(Number(pos.quantity ?? 0));
    if (absNegQty > 0 && absPosQty > 0 && absNegQty !== absPosQty) {
      // Allow qty both +1 with opposite-signed money (legacy parse quirk)
      const negQty = Number(neg.quantity ?? 0);
      const posQty = Number(pos.quantity ?? 0);
      if (!(negQty > 0 && posQty > 0 && Number(neg.netRevenue ?? 0) < 0)) continue;
    }

    const posTxn = (pos.transactionId ?? "").trim().toUpperCase();
    if (requireSameTxn) {
      if (!txn || !posTxn || txn !== posTxn) continue;
    } else if (txn && posTxn && txn === posTxn) {
      continue;
    }

    return j;
  }
  return -1;
}

/** Same receipt has another sale line (different SKU/amount) → exchange / multi-line. */
function txnHasOtherSaleContext(
  rows: SalesReturnPairRow[],
  negIdx: number,
  drop: Set<number>
): boolean {
  const neg = rows[negIdx];
  const txn = (neg.transactionId ?? "").trim().toUpperCase();
  if (!txn) return false;
  const negSku = salesSkuKey(neg);
  const negItem = salesItemKey(neg);
  const negAmt = pairAmountCents(neg);

  for (let j = 0; j < rows.length; j++) {
    if (j === negIdx || drop.has(j)) continue;
    const r = rows[j];
    if ((r.transactionId ?? "").trim().toUpperCase() !== txn) continue;
    if (!isSaleLeg(r)) continue;
    const posSku = salesSkuKey(r);
    const posItem = salesItemKey(r);
    if (negSku && posSku && negSku !== posSku) return true;
    if (negItem && posItem && negItem !== posItem) return true;
    if (pairAmountCents(r) !== negAmt) return true;
  }
  return false;
}

/**
 * Drop return / void pairs: a return leg that mirrors a sale leg with the same
 * store, absolute amount, and same SKU/vendor model. Prefer same Transaction #.
 *
 * Example: AR-10291959 has qty −1 and +1 for D67 at the same store / amount —
 * both rows are ignored. A later stand-alone sale (e.g. VR-102291107) is kept.
 */
export function dropMatchedSalesReturnPairs<T extends SalesReturnPairRow>(rows: T[]): T[] {
  if (rows.length < 2) return rows;

  const drop = new Set<number>();
  const usedPositive = new Set<number>();

  const pairPass = (requireSameTxn: boolean) => {
    for (let i = 0; i < rows.length; i++) {
      if (drop.has(i)) continue;
      if (!isReturnLeg(rows[i])) continue;
      const match = findReturnPairMatch(rows, i, usedPositive, drop, requireSameTxn);
      if (match >= 0) {
        drop.add(i);
        drop.add(match);
        usedPositive.add(match);
      }
    }
  };

  pairPass(true);
  pairPass(false);

  if (!drop.size) return rows;
  return rows.filter((_, idx) => !drop.has(idx));
}

/**
 * Units sold for dashboard / rankings: count only positive qty.
 * Exchange returns stay in the row set for net revenue but do not reduce unit totals.
 */
export function salesUnitsSold(quantity: number | null | undefined): number {
  const q = Number(quantity ?? 0);
  return q > 0 ? q : 0;
}

/**
 * After void pairs are removed, drop stand-alone negative-qty returns.
 * Keep a negative-qty line when the same Transaction # still has a sale leg
 * (exchange / trade-in under one receipt — net revenue stays accurate).
 */
export function dropStandaloneNegativeQtyReturns<
  T extends {
    quantity?: number | null;
    transactionId?: string | null;
    netRevenue?: number | null;
    grossSales?: number | null;
  }
>(rows: T[]): T[] {
  const txnsWithSale = new Set<string>();
  for (const r of rows) {
    if (!isSaleLeg(r)) continue;
    const txn = (r.transactionId ?? "").trim().toUpperCase();
    if (txn) txnsWithSale.add(txn);
  }

  return rows.filter((r) => {
    const qty = Number(r.quantity ?? 0);
    if (!(qty < 0)) return true;
    const txn = (r.transactionId ?? "").trim().toUpperCase();
    if (!txn) return false;
    return txnsWithSale.has(txn);
  });
}

export function filterExcludedSalesRows<
  T extends {
    sku?: string | null;
    itemNumber?: string | null;
    department?: string | null;
    storeName?: string | null;
    quantity?: number | null;
    netRevenue?: number | null;
    grossSales?: number | null;
    transactionId?: string | null;
    vendorModel?: string | null;
    style?: string | null;
    description?: string | null;
  }
>(rows: T[]): T[] {
  const withoutSkuDept = rows.filter((r) => !isExcludedSalesRow(r));
  const withoutVoidPairs = dropMatchedSalesReturnPairs(withoutSkuDept);
  return dropStandaloneNegativeQtyReturns(withoutVoidPairs);
}

export function filterTopProductSkus<
  T extends { itemNumber?: string; vendorModel?: string; sku?: string; name?: string; description?: string }
>(products: T[]): T[] {
  return products.filter((p) => {
    if (isExcludedSalesVendorModel(p.vendorModel)) return false;
    if (
      isExcludedSalesPadLine(p.name) ||
      isExcludedSalesPadLine(p.description) ||
      isExcludedSalesPadLine(p.vendorModel)
    ) {
      return false;
    }
    const sku = p.itemNumber || p.sku || p.vendorModel;
    return !isExcludedSalesSku(sku);
  });
}

export function sortTopProducts<T extends { revenue: number; units: number }>(products: T[]): T[] {
  return [...products].sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

/** Top SKUs by units sold (quantity), then revenue. */
export function sortTopProductsByUnits<T extends { revenue: number; units: number }>(products: T[]): T[] {
  return [...products].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}

/** Readable product line — cleans POS feed quirks and title-cases ALL CAPS. */
export function formatProductDisplayName(name: string): string {
  let s = name.trim();
  if (!s) return "";

  s = s
    .replace(/\uFFFD/g, " ")
    .replace(/\\+"/g, '"')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // (NO WARRANTY) / NO�WARRANTY / NO-WARRANTY
  s = s.replace(/\(?\s*NO[\s\-]*WARRANTY\s*\)?/gi, "(No Warranty)");

  // Metal + quoted tag: 14KT"OVANI-COLLECTION" → 14KT Ovani Collection
  s = s.replace(
    /\b((?:10|14|18)KT|(?:10|14|18)KY|SS|YG|WG|RG|SILVER)\s*"([^"]+)"/gi,
    (_m, metal: string, brand: string) =>
      `${normalizeMetalPrefix(metal)} ${titleCaseWords(brand.replace(/[_]+/g, " ").replace(/-/g, " "))}`
  );

  // Remaining quoted phrases: "LAB-GROWN" → Lab Grown
  s = s.replace(/"([^"]+)"/g, (_m, inner: string) =>
    titleCaseWords(String(inner).replace(/[_]+/g, " ").replace(/-/g, " "))
  );

  // Glued metal prefix: 14KTSomething → 14KT Something
  s = s.replace(
    /\b((?:10|14|18)KT|(?:10|14|18)KY|SS)(?=[A-Za-z])/gi,
    (_m, metal: string) => `${normalizeMetalPrefix(metal)} `
  );

  s = s.replace(/\s+/g, " ").trim();

  // Protect parentheticals so spaces inside don't break title-case
  const protectedParts: string[] = [];
  s = s.replace(/\([^)]*\)/g, (m) => {
    const normalized = /^\(\s*no\s+warranty\s*\)$/i.test(m) ? "(No Warranty)" : m;
    const idx = protectedParts.length;
    protectedParts.push(normalized);
    return `\u0000${idx}\u0000`;
  });

  // Title-case the full line (POS feeds are usually ALL CAPS)
  const letters = s.replace(/[^A-Za-z\u0000]/g, "");
  const alphaOnly = letters.replace(/\u0000/g, "");
  const mostlyUpper =
    alphaOnly.length > 0 &&
    alphaOnly.replace(/[a-z]/g, "").length >= alphaOnly.length * 0.6;
  if (mostlyUpper) {
    s = titleCaseWords(s);
  }

  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i) => protectedParts[Number(i)] ?? "");

  // Keep metal codes / certs uppercase after title-case
  s = s.replace(
    /\b((?:10|14|18)kt|(?:10|14|18)ky|ss|yg|wg|rg)\b/gi,
    (m) => normalizeMetalPrefix(m)
  );
  s = s.replace(/\b(igi|gia|cz|uv|pc)\b/gi, (m) => m.toUpperCase());
  s = s.replace(/\b(\d+(?:\.\d+)?)\s*ct\b/gi, "$1ct");
  // Fix common POS misspellings before brand casing
  s = s.replace(/\bowani\b/gi, "Ovani");
  // Known brand / design tokens from Valliani POS
  s = s.replace(
    /\b(linknlock|link\s*n\s*lock|novello|ovani|diani|aanika|love-spell|love spell|lab-?grown|lab grown)\b/gi,
    (m) => {
      const key = m.toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-");
      const map: Record<string, string> = {
        linknlock: "LinknLock",
        "link-n-lock": "LinknLock",
        novello: "Novello",
        ovani: "Ovani",
        diani: "Diani",
        aanika: "Aanika",
        "love-spell": "Love-Spell",
        labgrown: "Lab-Grown",
        "lab-grown": "Lab-Grown",
      };
      return map[key] ?? m;
    }
  );

  // Tighten collection / atelier labels
  s = s.replace(/-Collection\b/gi, " Collection");
  s = s.replace(/-Atelier\b/gi, " Atelier");

  // Tighten spacing around punctuation leftovers
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

function normalizeMetalPrefix(raw: string): string {
  const u = raw.toUpperCase();
  if (u === "SS" || u === "YG" || u === "WG" || u === "RG") return u;
  if (/^(10|14|18)KT$/.test(u)) return u;
  if (/^(10|14|18)KY$/.test(u)) return u;
  return u;
}

function titleCaseWords(text: string): string {
  const keepLower = new Set(["a", "an", "and", "or", "of", "the", "with", "for", "to"]);
  return text
    .split(/\s+/)
    .map((word, i) => {
      if (!word) return "";
      if (/^\([^)]*\)$/.test(word)) {
        // Keep already-normalized (No Warranty)
        if (/^\(no warranty\)$/i.test(word)) return "(No Warranty)";
        return `(${titleCaseWords(word.slice(1, -1))})`;
      }
      const bare = word.replace(/[^A-Za-z0-9.]/g, "");
      if (/^\d/.test(bare)) return word; // 1.00ct, 36mm
      const lowerCore = word.toLowerCase().replace(/[^a-z]/g, "");
      if (i > 0 && keepLower.has(lowerCore)) return word.toLowerCase();
      // Hyphenated: yellow-gold → Yellow-Gold
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) =>
            part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ""
          )
          .join("-");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(date?: Date): string {
  return (date || new Date()).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getDisplayFirstName(fullName?: string): string {
  if (!fullName) return "Kash";
  const first = fullName.split(" ")[0];
  return first === "Kashif" ? "Kash" : first;
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/•\s/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\n+/g, ". ")
    .trim();
}

export function getFileType(filename: string): "pdf" | "excel" | "csv" | "word" | "powerpoint" | "image" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "pdf";
    case "xlsx":
    case "xls": return "excel";
    case "csv": return "csv";
    case "doc":
    case "docx": return "word";
    case "ppt":
    case "pptx": return "powerpoint";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp": return "image";
    default: return "other";
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high": return "text-accent-rose bg-red-50";
    case "medium": return "text-amber-600 bg-amber-50";
    case "low": return "text-ink-muted bg-surface-tertiary";
    default: return "text-ink-secondary bg-surface-tertiary";
  }
}
