import { formatCurrency, formatPieceCount } from "@/lib/utils";
import type {
  SalesBreakdownRow,
  SalesComparisonResult,
  SalesQueryFilters,
  SalesQueryResult,
  SalesResolvedDateRange,
} from "./sales-types";

function money(n: number | null | undefined): string {
  if (n == null) return "n/a";
  return formatCurrency(n);
}

function filterLabel(filters: SalesQueryFilters, date: SalesResolvedDateRange): string {
  const parts: string[] = [];
  if (date.type !== "report_all") parts.push(date.label);
  else if (date.startDate && date.endDate) parts.push(`${date.startDate}–${date.endDate}`);
  if (filters.designs.length) parts.push(`design ${filters.designs.join(", ")}`);
  if (filters.departments.length) parts.push(`department ${filters.departments.join(", ")}`);
  if (filters.vendors.length) parts.push(`vendor ${filters.vendors.join(", ")}`);
  if (filters.classes.length) parts.push(`class ${filters.classes.join(", ")}`);
  if (filters.stores.length) parts.push(`store ${filters.stores.join(", ")}`);
  return parts.length ? parts.join("; ") : "the selected report period";
}

function topLines(rows: SalesBreakdownRow[] | undefined, label: string, limit = 5): string {
  if (!rows?.length) return "";
  const items = rows
    .slice(0, limit)
    .map((r) => `- **${r.name}** — ${money(r.netSales)}`)
    .join("\n");
  return `**${label}**\n${items}`;
}

export function formatSalesTextAnswer(result: Omit<SalesQueryResult, "spokenAnswer" | "textAnswer"> & {
  spokenAnswer?: string;
  textAnswer?: string;
}): string {
  if (result.clarification) {
    const opts = result.clarification.options.length
      ? `\n\nOptions: ${result.clarification.options.join(" · ")}`
      : "";
    return `${result.clarification.message}${opts}`;
  }
  if (result.error) return result.error;

  // Comparison-only answers (no shared AND filter slice)
  if (result.comparison) {
    const lines = [formatComparisonBlock(result.comparison)];
    if (result.warnings?.length) lines.push(`_${result.warnings.join(" ")}_`);
    return lines.join("\n\n");
  }

  const s = result.summary;
  if (!s || result.availability.matchingRowCount === 0) {
    return (
      result.warnings?.[0] ??
      `I found no matching sales for ${filterLabel(result.query.filters, result.query.resolvedDateRange)}.`
    );
  }

  const scope = filterLabel(result.query.filters, result.query.resolvedDateRange);
  const lines: string[] = [
    `**Sales summary** — ${scope}`,
    `**${money(s.netSales)}** net · **${formatPieceCount(s.unitsSold ?? 0)}** · **${(s.transactions ?? 0).toLocaleString()}** transactions`,
  ];

  const r = result.rankings;
  const b = result.breakdowns;
  const extras = [
    topLines(b?.byStore ?? r?.topStores, "By store"),
    topLines(b?.byDepartment ?? r?.topDepartments, "By department"),
    topLines(b?.byDesign ?? r?.topDesigns, "By design"),
    topLines(b?.byVendor ?? r?.topVendors, "By vendor"),
    topLines(b?.byClass ?? r?.topClasses, "By class"),
    topLines(b?.byVendorModel ?? r?.topVendorModels, "Top vendor models"),
  ].filter(Boolean);

  // Only show breakdowns that were requested via groupBy or default compact tops
  if (result.query.groupBy.length) {
    for (const g of result.query.groupBy) {
      const map: Record<string, SalesBreakdownRow[] | undefined> = {
        store: b?.byStore,
        department: b?.byDepartment,
        design: b?.byDesign,
        vendor: b?.byVendor,
        class: b?.byClass,
        product: b?.byProduct,
        sku: b?.bySku,
        vendor_model: b?.byVendorModel,
        date: b?.byDate,
      };
      const rows = map[g];
      if (rows?.length) {
        lines.push(topLines(rows, `By ${g.replace("_", " ")}`));
      }
    }
  } else if (extras.length && !result.comparison) {
    lines.push(...extras.slice(0, 4));
  }

  if (result.dashboardState && result.query) {
    // navigation hint added by caller if display requested
  }

  if (result.warnings?.length) {
    lines.push(`_${result.warnings.join(" ")}_`);
  }

  return lines.join("\n\n");
}

export function formatComparisonBlock(c: SalesComparisonResult): string {
  const ln = c.left.summary.netSales ?? 0;
  const rn = c.right.summary.netSales ?? 0;
  const delta = ln - rn;
  return (
    `**${c.left.label}** generated **${money(ln)}** net vs **${money(rn)}** at **${c.right.label}**` +
    ` (difference **${money(Math.abs(delta))}**, ${delta >= 0 ? c.left.label : c.right.label} ahead). ` +
    `Units: ${(c.left.summary.unitsSold ?? 0).toLocaleString()} vs ${(c.right.summary.unitsSold ?? 0).toLocaleString()}. ` +
    `Avg ticket: ${money(c.left.summary.averageTicket)} vs ${money(c.right.summary.averageTicket)}.`
  );
}

export function formatSalesSpokenAnswer(result: Omit<SalesQueryResult, "spokenAnswer" | "textAnswer">): string {
  if (result.clarification) {
    return `${result.clarification.message} ${result.clarification.options.slice(0, 3).join(", or ")}`.trim();
  }
  if (result.error) return result.error;

  if (result.comparison) {
    const c = result.comparison;
    const ln = c.left.summary.netSales ?? 0;
    const rn = c.right.summary.netSales ?? 0;
    const scope = filterLabel(result.query.filters, result.query.resolvedDateRange);
    return `${c.left.label} generated ${Math.round(ln).toLocaleString()} dollars in net sales versus ${Math.round(rn).toLocaleString()} at ${c.right.label} for ${scope}.`;
  }

  if (!result.summary || result.availability.matchingRowCount === 0) {
    return (
      result.warnings?.[0] ??
      `I found no matching sales for ${filterLabel(result.query.filters, result.query.resolvedDateRange)}.`
    );
  }

  const s = result.summary;
  const scope = filterLabel(result.query.filters, result.query.resolvedDateRange);

  const topStore = result.breakdowns?.byStore?.[0] ?? result.rankings?.topStores?.[0];
  let spoken = `For ${scope}, net sales were ${Math.round(s.netSales ?? 0).toLocaleString()} dollars from ${(s.unitsSold ?? 0).toLocaleString()} units.`;
  if (topStore && result.query.groupBy.includes("store")) {
    spoken += ` Top store was ${topStore.name} at ${Math.round(topStore.netSales).toLocaleString()} dollars.`;
  } else if (result.breakdowns?.byDepartment?.[0] && result.query.groupBy.includes("department")) {
    const d = result.breakdowns.byDepartment[0];
    spoken += ` Strongest department was ${d.name} at ${Math.round(d.netSales).toLocaleString()} dollars.`;
  }
  return spoken;
}

/** One short open line when boss said "show X sales" — no numbers. */
export function formatSalesOpenSpoken(
  result: Pick<SalesQueryResult, "query"> | { query: { filters: SalesQueryFilters; resolvedDateRange?: SalesResolvedDateRange } }
): string {
  const f = result.query.filters;
  const label =
    f.designs[0] ||
    f.departments[0] ||
    f.stores[0] ||
    f.vendors[0] ||
    f.classes[0] ||
    f.products[0];
  const range = "resolvedDateRange" in result.query ? result.query.resolvedDateRange : undefined;
  const dateBit =
    range && range.type !== "report_all" && range.label
      ? range.label
      : range?.startDate && range.startDate === range.endDate
        ? range.startDate
        : "";

  if (label && dateBit) return `Opening ${label} sales for ${dateBit}.`;
  if (label) {
    if (f.departments[0] && !f.designs[0]) return `Opening ${f.departments[0]} department sales.`;
    if (f.classes[0] && !f.designs[0] && !f.departments[0] && !f.stores[0]) {
      return `Opening ${f.classes[0]} class sales.`;
    }
    return `Opening ${label} sales.`;
  }
  if (dateBit) return `Opening sales for ${dateBit}.`;
  return "Opening Sales Dashboard.";
}

export function attachNavigationHint(text: string, navigated: boolean): string {
  if (!navigated) return text;
  return `${text}\n\nI've opened the filtered Sales dashboard.`;
}

export function attachSpokenNav(spoken: string, navigated: boolean): string {
  if (!navigated) return spoken;
  return `${spoken} I've opened the filtered Sales dashboard.`;
}
