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
]);

/** True when SKU / Item # matches an excluded product rule. */
export function isExcludedSalesSku(sku?: string | null): boolean {
  const normalized = (sku ?? "").trim().toUpperCase();
  if (!normalized) return false;
  if (EXCLUDED_SALES_SKUS.has(normalized)) return true;
  if (normalized.startsWith("MLB-")) return true;
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
}): boolean {
  const dept = (row.department ?? "").trim();
  if (!dept || dept === "—" || /^uncategorized$/i.test(dept)) return true;
  const sku = (row.sku ?? "").trim() || (row.itemNumber ?? "").trim();
  return isExcludedSalesSku(sku);
}

export function filterExcludedSalesRows<
  T extends { sku?: string | null; itemNumber?: string | null; department?: string | null }
>(rows: T[]): T[] {
  return rows.filter((r) => !isExcludedSalesRow(r));
}

export function filterTopProductSkus<
  T extends { itemNumber?: string; vendorModel?: string; sku?: string }
>(products: T[]): T[] {
  return products.filter((p) => {
    const sku = p.itemNumber || p.sku;
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
