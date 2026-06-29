import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { getLatestReportWithSummary } from "@/lib/reports/store";
import type { ReportSummary } from "@/lib/reports/types";
import type { SalesSummary } from "@/types";
import { formatCurrency, formatPieceCount, sortTopProducts } from "@/lib/utils";

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
