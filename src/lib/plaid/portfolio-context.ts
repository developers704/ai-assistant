import type { InvestmentAccount, InvestmentHolding } from "./investments";

export interface AllocationSlice {
  name: string;
  value: number;
  percent: number;
  ticker?: string;
}

const CHART_COLORS = [
  "#818cf8",
  "#a78bfa",
  "#c4b5fd",
  "#6366f1",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#38bdf8",
  "#fb923c",
  "#94a3b8",
];

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/** Build allocation slices from holdings, or fall back to account balances. */
export function computeAllocation(
  holdings: InvestmentHolding[],
  accounts: InvestmentAccount[],
  totalValue: number
): AllocationSlice[] {
  if (totalValue <= 0) return [];

  if (holdings.length > 0) {
    const byKey = new Map<string, AllocationSlice>();
    for (const h of holdings) {
      const key = h.ticker ?? h.securityName;
      const existing = byKey.get(key);
      if (existing) {
        existing.value += h.value;
      } else {
        byKey.set(key, {
          name: h.ticker ?? h.securityName,
          ticker: h.ticker,
          value: h.value,
          percent: 0,
        });
      }
    }
    const slices = [...byKey.values()].sort((a, b) => b.value - a.value);
    return slices.map((s) => ({
      ...s,
      percent: (s.value / totalValue) * 100,
    }));
  }

  return accounts
    .filter((a) => a.balance > 0)
    .map((a) => ({
      name: a.name,
      value: a.balance,
      percent: (a.balance / totalValue) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

export function formatPortfolioContext(params: {
  totalValue: number;
  institutionName?: string;
  env?: string;
  accounts: InvestmentAccount[];
  holdings: InvestmentHolding[];
  lastUpdated?: string;
}): string {
  const { totalValue, institutionName, env, accounts, holdings, lastUpdated } = params;
  const allocation = computeAllocation(holdings, accounts, totalValue);

  const accountLines = accounts
    .map((a) => `- ${a.name} (${a.subtype ?? a.type}): $${a.balance.toLocaleString()}`)
    .join("\n");

  const holdingLines = holdings.length
    ? holdings
        .slice(0, 15)
        .map(
          (h) =>
            `- ${h.ticker ?? h.securityName}: $${Math.round(h.value).toLocaleString()} (${h.quantity} shares @ $${h.price.toFixed(2)})`
        )
        .join("\n")
    : "No individual holdings — balance is at account level only.";

  const allocationLines = allocation.length
    ? allocation
        .slice(0, 10)
        .map((s) => `- ${s.name}: $${Math.round(s.value).toLocaleString()} (${s.percent.toFixed(1)}%)`)
        .join("\n")
    : "No allocation breakdown available.";

  return `
## Investments (Plaid — ${institutionName ?? "connected"}${env ? `, ${env}` : ""})
Total portfolio value: $${totalValue.toLocaleString()}
Accounts (${accounts.length}):
${accountLines || "None"}

Top holdings:
${holdingLines}

Allocation:
${allocationLines}
${lastUpdated ? `Last synced: ${lastUpdated}` : ""}`.trim();
}
