import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { getLatestReportWithSummary } from "@/lib/reports/store";
import {
  extractSalesDateFromMessage,
  formatReportDateLong,
  isValidIsoDate,
} from "@/lib/reports/date-utils";
import type { ReportSummary } from "@/lib/reports/types";
import type { SalesSummary } from "@/types";
import { formatCurrency, formatPieceCount, sortTopProductsByUnits, filterTopProductSkus } from "@/lib/utils";
import type { SalesFocus } from "@/lib/ai/sales-focus";

export type AssistantSalesOptions = {
  /** ISO YYYY-MM-DD — filter report to this day */
  filterDate?: string;
  /** Raw user message — used to infer a day when filterDate not set */
  userMessage?: string;
};

export function getAssistantSalesSummary(options?: AssistantSalesOptions): {
  summary: SalesSummary | ReportSummary;
  source: "report" | "mock";
  label?: string;
  vendorCode?: string;
  filterDate?: string;
  availableDates: string[];
  dateMissing?: boolean;
} {
  const unfiltered = getLatestReportWithSummary();
  const availableDates = unfiltered?.availableDates ?? [];

  let filterDate =
    options?.filterDate && isValidIsoDate(options.filterDate) ? options.filterDate : undefined;

  if (!filterDate && options?.userMessage) {
    filterDate = extractSalesDateFromMessage(options.userMessage, availableDates) ?? undefined;
  }

  if (filterDate && availableDates.length > 0 && !availableDates.includes(filterDate)) {
    return {
      summary: unfiltered!.summary,
      source: "report",
      label: unfiltered!.meta.label,
      vendorCode: unfiltered!.summary.vendorCode ?? unfiltered!.meta.vendorCode ?? undefined,
      filterDate,
      availableDates,
      dateMissing: true,
    };
  }

  const latest = filterDate
    ? getLatestReportWithSummary({ filterDate })
    : unfiltered;

  if (latest) {
    const dayLabel = filterDate ? formatReportDateLong(filterDate) : undefined;
    return {
      summary: latest.summary,
      source: "report",
      label: dayLabel ?? latest.meta.label,
      vendorCode: latest.summary.vendorCode ?? latest.meta.vendorCode ?? undefined,
      filterDate,
      availableDates: latest.availableDates,
    };
  }
  return {
    summary: computeSalesSummary(mockSalesData),
    source: "mock",
    availableDates: [],
  };
}

function periodSuffix(source: "report" | "mock", label?: string, filterDate?: string): string {
  if (source !== "report") return " (demo data)";
  if (filterDate) return ` (${formatReportDateLong(filterDate)})`;
  return label ? ` (${label})` : " (latest report)";
}

export function formatTopStoreAnswer(options?: AssistantSalesOptions): string {
  const { summary, source, label, filterDate, dateMissing, availableDates } =
    getAssistantSalesSummary(options);
  if (dateMissing && filterDate) {
    return formatMissingDate(filterDate, availableDates);
  }
  const top = summary.topStores[0];
  if (!top) {
    return "I don't have store-level sales data right now. Upload a sales report in Data Analyst or open the Sales Dashboard.";
  }

  const share =
    summary.totalRevenue > 0
      ? ((top.revenue / summary.totalRevenue) * 100).toFixed(1)
      : null;

  let answer = `Top store is **${top.name}** with **${formatCurrency(top.revenue)}** net sales`;
  if (share) {
    answer += `, about **${share}%** of total net sales`;
  }
  answer += `${periodSuffix(source, label, filterDate)}. Want full store breakdown?`;
  return answer;
}

export function formatSalesSummaryBrief(options?: AssistantSalesOptions): string {
  const { summary, source, label, vendorCode, filterDate, dateMissing, availableDates } =
    getAssistantSalesSummary(options);
  if (dateMissing && filterDate) {
    return formatMissingDate(filterDate, availableDates);
  }
  const changeIcon = summary.comparisonPreviousDay >= 0 ? "↑" : "↓";
  const top = summary.topStores[0];
  const dayPart = filterDate
    ? formatReportDateLong(filterDate)
    : label ?? "latest report";
  const header =
    source === "report"
      ? `**Sales** — ${vendorCode ? `${vendorCode} · ` : ""}${dayPart}`
      : "**Sales** _(demo data)_";

  let md = `${header}

**Net revenue:** ${formatCurrency(summary.totalRevenue)} (${changeIcon} ${Math.abs(summary.comparisonPreviousDay).toFixed(1)}% vs prior period)
**Transactions:** ${summary.totalTransactions.toLocaleString()} · **AOV:** ${formatCurrency(summary.averageOrderValue)}`;

  if (top) {
    md += `\n**Top store:** ${top.name} — ${formatCurrency(top.revenue)}`;
  }

  md += "\n\nAsk for **full report** or **best store** for more detail.";
  return md;
}

export function formatTopProductsAnswer(options?: AssistantSalesOptions): string {
  const { summary, source, label, filterDate, dateMissing, availableDates } =
    getAssistantSalesSummary(options);
  if (dateMissing && filterDate) {
    return formatMissingDate(filterDate, availableDates);
  }
  const top = sortTopProductsByUnits(filterTopProductSkus(summary.topProducts)).slice(0, 5);
  if (!top.length) {
    return "I don't have product-level data right now. Upload a sales report or open the Sales Dashboard.";
  }
  const lines = top.map(
    (p, i) => `${i + 1}. **${p.itemNumber}** — ${formatPieceCount(p.units)} sold, ${formatCurrency(p.revenue)}`
  );
  return `**Top SKUs by quantity**${periodSuffix(source, label, filterDate)}\n\n${lines.join("\n")}`;
}

export function formatSalesByFocus(focus: SalesFocus, options?: AssistantSalesOptions): string {
  switch (focus) {
    case "top_store":
      return formatTopStoreAnswer(options);
    case "top_products":
      return formatTopProductsAnswer(options);
    case "summary":
      return formatSalesSummaryBrief(options);
    case "full_report":
    default:
      return formatSalesReportMarkdown(options);
  }
}

export function formatSalesReportMarkdown(options?: AssistantSalesOptions): string {
  const { summary, source, label, vendorCode, filterDate, dateMissing, availableDates } =
    getAssistantSalesSummary(options);
  if (dateMissing && filterDate) {
    return formatMissingDate(filterDate, availableDates);
  }
  const changeIcon = summary.comparisonPreviousDay >= 0 ? "↑" : "↓";
  const topStores = summary.topStores.slice(0, 5);
  const topProducts = sortTopProductsByUnits(filterTopProductSkus(summary.topProducts)).slice(0, 5);

  const dayPart = filterDate
    ? formatReportDateLong(filterDate)
    : label ?? "Uploaded report";
  const header =
    source === "report"
      ? `**Sales Summary** — ${vendorCode ? `${vendorCode} · ` : ""}${dayPart}`
      : "**Today's Sales Summary** _(demo data — upload CSV in Data Analyst)_";

  let md = `${header}

**Total Revenue:** ${formatCurrency(summary.totalRevenue)} (${changeIcon} ${Math.abs(summary.comparisonPreviousDay).toFixed(1)}% vs previous period)
**Units sold:** ${summary.totalTransactions.toLocaleString()}
**Avg. order value:** ${formatCurrency(summary.averageOrderValue)}`;

  if (source === "report" && "grossSales" in summary && summary.grossSales != null) {
    md += `\n**Gross sales:** ${formatCurrency(summary.grossSales)} · **Net:** ${formatCurrency(summary.totalRevenue)} · **Discounts:** ${formatCurrency(summary.discountTotal ?? 0)}`;
  }

  if (source === "report" && "totalMargin" in summary && summary.totalMargin != null && summary.totalMargin > 0) {
    md += `\n**Est. margin:** ${formatCurrency(summary.totalMargin)}${summary.marginRate ? ` (${(summary.marginRate * 100).toFixed(1)}%)` : ""}`;
  }

  if (topStores.length > 0) {
    md += `\n\n**Top stores:**\n${topStores
      .map((s, i) => `${i + 1}. ${s.name} — ${formatCurrency(s.revenue)}${s.change ? ` (${s.change >= 0 ? "+" : ""}${s.change.toFixed(1)}%)` : ""}`)
      .join("\n")}`;
  }

  if (topProducts.length > 0) {
    md += `\n\n**Top products:**\n${topProducts
      .map((p, i) => {
        const id = p.itemNumber ? `#${p.itemNumber} · ` : "";
        return `${i + 1}. ${id}${p.name} — ${formatPieceCount(p.units)} · ${formatCurrency(p.revenue)}`;
      })
      .join("\n")}`;
  }

  if (summary.recommendations.length > 0 && source === "mock") {
    md += `\n\n**Recommendations:**\n${summary.recommendations.map((r) => `• ${r}`).join("\n")}`;
  } else if (summary.recommendations.length > 0) {
    md += `\n\n**Insights:**\n${summary.recommendations.slice(0, 3).map((r) => `• ${r}`).join("\n")}`;
  }

  return md;
}

function formatMissingDate(filterDate: string, availableDates: string[]): string {
  const asked = formatReportDateLong(filterDate);
  const range =
    availableDates.length > 0
      ? ` Available days in the report: ${formatReportDateLong(availableDates[0])} – ${formatReportDateLong(availableDates[availableDates.length - 1])}.`
      : "";
  return `I don't have sales data for **${asked}**.${range} Try another date from the report, or open the Sales Dashboard.`;
}

/** Short 2–3 sentence spoken summary for voice. */
export function formatSalesSpokenBrief(options?: AssistantSalesOptions): string {
  const { summary, source, filterDate, dateMissing, availableDates, label } =
    getAssistantSalesSummary(options);

  if (dateMissing && filterDate) {
    const asked = formatReportDateLong(filterDate);
    if (availableDates.length) {
      return `I don't have sales for ${asked}. The report covers ${formatReportDateLong(availableDates[0])} through ${formatReportDateLong(availableDates[availableDates.length - 1])}.`;
    }
    return `I don't have sales for ${asked}.`;
  }

  const top = summary.topStores[0];
  const day =
    filterDate != null
      ? `On ${formatReportDateLong(filterDate)}`
      : source === "report"
        ? `Latest report${label ? ` (${label})` : ""}`
        : "Today";

  const revenue = `${Math.round(summary.totalRevenue).toLocaleString()} dollars`;
  const units = `${summary.totalTransactions.toLocaleString()} units`;

  if (top) {
    return `${day}, net sales were ${revenue} across ${units}. Top store was ${top.name} at ${Math.round(top.revenue).toLocaleString()} dollars.`;
  }
  return `${day}, net sales were ${revenue} across ${units}.`;
}
