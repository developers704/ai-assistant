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

/** Non-jewelry SKUs hidden from Top Products only (still in report totals). */
const EXCLUDED_TOP_PRODUCT_SKUS = new Set([
  "ITEM",
  "250000",
  "217365",
  "217286",
  "159004",
]);

export function isExcludedTopProductSku(sku?: string | null): boolean {
  const normalized = (sku ?? "").trim().toUpperCase();
  if (!normalized) return false;
  if (EXCLUDED_TOP_PRODUCT_SKUS.has(normalized)) return true;
  if (normalized.startsWith("MLB")) return true;
  return false;
}

export function isItemPlaceholderSku(sku?: string | null): boolean {
  return isExcludedTopProductSku(sku);
}

export function filterTopProductSkus<T extends { itemNumber?: string }>(products: T[]): T[] {
  return products.filter((p) => !isExcludedTopProductSku(p.itemNumber));
}

export function sortTopProducts<T extends { revenue: number; units: number }>(products: T[]): T[] {
  return [...products].sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

/** Top SKUs by units sold (quantity), then revenue. */
export function sortTopProductsByUnits<T extends { revenue: number; units: number }>(products: T[]): T[] {
  return [...products].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}

/** Readable product line — title-case when feed is ALL CAPS. */
export function formatProductDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
      .join(" ");
  }
  return trimmed;
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
