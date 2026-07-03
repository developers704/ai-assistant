import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { getLatestReportWithSummary } from "@/lib/reports/store";
import type { ReportSummary } from "@/lib/reports/types";
import type { SalesSummary } from "@/types";
import { formatCurrency, formatPieceCount, sortTopProducts } from "@/lib/utils";
import type { SalesFocus } from "@/lib/ai/sales-focus";

export function getAssistantSalesSummary(): {
  summary: SalesSummary | ReportSummary;
  source: "report" | "mock";
  label?: string;
  vendorCode?: string;
} {
  const latest = getLatestReportWithSummary();
  if (latest) {
    return {
      summary: latest.summary,
      source: "report",
      label: latest.meta.label,
      vendorCode: latest.summary.vendorCode ?? latest.meta.vendorCode ?? undefined,
    };
  }
  return { summary: computeSalesSummary(mockSalesData), source: "mock" };
}

export function formatTopStoreAnswer(): string {
  const { summary, source, label } = getAssistantSalesSummary();
  const top = summary.topStores[0];
  if (!top) {
    return "I don't have store-level sales data right now. Upload a sales report in Data Analyst or open the Sales Dashboard.";
  }

  const share =
    summary.totalRevenue > 0
      ? ((top.revenue / summary.totalRevenue) * 100).toFixed(1)
      : null;

  const period =
    source === "report" ? (label ? ` (${label})` : " (latest report)") : " (demo data)";

  let answer = `Top store is **${top.name}** with **${formatCurrency(top.revenue)}** net sales`;
  if (share) {
    answer += `, about **${share}%** of total net sales`;
  }
  answer += `${period}. Want full store breakdown?`;
  return answer;
}

export function formatSalesSummaryBrief(): string {
  const { summary, source, label, vendorCode } = getAssistantSalesSummary();
  const changeIcon = summary.comparisonPreviousDay >= 0 ? "↑" : "↓";
  const top = summary.topStores[0];
  const header =
    source === "report"
      ? `**Sales** — ${vendorCode ? `${vendorCode} · ` : ""}${label ?? "latest report"}`
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

export function formatSalesByFocus(focus: SalesFocus): string {
  switch (focus) {
    case "top_store":
      return formatTopStoreAnswer();
    case "summary":
      return formatSalesSummaryBrief();
    case "full_report":
    default:
      return formatSalesReportMarkdown();
  }
}

export function formatSalesReportMarkdown(): string {
  const { summary, source, label, vendorCode } = getAssistantSalesSummary();
  const changeIcon = summary.comparisonPreviousDay >= 0 ? "↑" : "↓";
  const topStores = summary.topStores.slice(0, 5);
  const topProducts = sortTopProducts(summary.topProducts).slice(0, 5);

  const header =
    source === "report"
      ? `**Sales Summary** — ${vendorCode ? `${vendorCode} · ` : ""}${label ?? "Uploaded report"}`
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
        return `${i + 1}. ${id}${p.name} — ${formatCurrency(p.revenue)} · ${formatPieceCount(p.units)}`;
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
