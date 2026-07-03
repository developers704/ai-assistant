import type { ReportCategory, ReportPeriod } from "./types";

export function detectReportPeriod(fileName: string, label?: string): ReportPeriod {
  const text = `${fileName} ${label ?? ""}`.toLowerCase();
  if (/\b(half[\s-]?year|halfyear|h1|h2|6[\s-]?month)\b/.test(text)) return "half_yearly";
  if (/\b(quarter|quarterly|q1|q2|q3|q4)\b/.test(text)) return "quarterly";
  if (/\b(month|monthly|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(text)) {
    return "monthly";
  }
  if (/\b(daily|day|today)\b/.test(text)) return "daily";
  if (/\b(yearly|annual|year)\b/.test(text)) return "yearly";
  return "custom";
}

export function isStoreSalesFormat(columns: string[]): boolean {
  const lower = columns.map((c) => c.trim().toLowerCase());
  const hasProductId = lower.some((c) => c.includes("sku") || /^item\s*#?$/.test(c));
  return (
    lower.some((c) => c.includes("transaction") && c.includes("#")) &&
    hasProductId &&
    lower.some((c) => c === "store") &&
    lower.some((c) => c === "total") &&
    lower.some((c) => c.includes("vendor name") || c === "vendor name")
  );
}

export function detectReportCategory(fileName: string, columns: string[]): ReportCategory {
  const text = fileName.toLowerCase();
  const colLower = columns.map((c) => c.toLowerCase().trim());

  if (isStoreSalesFormat(columns) || /\b(sales-latest|sales-report|store.?sales|company.?sales)\b/.test(text)) {
    return "sales";
  }

  const isVendorPos =
    colLower.some((c) => c === "vendor #" || c === "vendor" || c.startsWith("vendor")) &&
    colLower.some((c) => c === "total") &&
    colLower.some((c) => c.includes("department"));

  if (isVendorPos || /\b(mhvr|vendor)\b/.test(text)) return "vendor";
  if (
    /\b(financing|payment)\b/.test(text) ||
    (colLower.some((c) => c === "pay method" || c.includes("pay method")) &&
      colLower.some((c) => c.includes("transaction date")) &&
      colLower.some((c) => c.includes("net amt") || c === "total"))
  ) {
    return "financing";
  }
  if (/\b(inventory|stock)\b/.test(text)) return "inventory";
  return "sales";
}

export function detectVendorCode(
  fileName: string,
  records: Record<string, unknown>[],
  columns: string[]
): string | null {
  const fromName = fileName.match(/\b([A-Z]{2,6})-report\b/i)?.[1]?.toUpperCase();
  if (fromName) return fromName;

  const vendorCol = columns.find((c) => /^vendor\s*#?$/i.test(c.trim()) || /^vendor$/i.test(c.trim()));
  const vendorNameCol = columns.find((c) => /^vendor\s*name$/i.test(c.trim()));
  const useCol = vendorNameCol ?? vendorCol;
  if (!useCol) return null;

  const counts = new Map<string, number>();
  for (const row of records) {
    const v = String(row[useCol] ?? "").trim().toUpperCase();
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function periodLabel(period: ReportPeriod): string {
  switch (period) {
    case "daily":
      return "Daily";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "half_yearly":
      return "Half-yearly";
    case "yearly":
      return "Yearly";
    default:
      return "Custom";
  }
}
