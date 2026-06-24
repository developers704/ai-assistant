import { getPlaidClient } from "./client";
import { getPlaidTokens } from "./token-store";

export interface InvestmentHolding {
  accountId: string;
  accountName: string;
  securityName: string;
  ticker?: string;
  quantity: number;
  price: number;
  value: number;
  currency: string;
}

export interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  balance: number;
  currency: string;
}

export interface InvestmentSummary {
  totalValue: number;
  accounts: InvestmentAccount[];
  holdings: InvestmentHolding[];
  lastUpdated: string;
}

export async function fetchInvestmentSummary(): Promise<InvestmentSummary | null> {
  const tokens = getPlaidTokens();
  const client = getPlaidClient();
  if (!tokens?.access_token || !client) return null;

  const response = await client.investmentsHoldingsGet({
    access_token: tokens.access_token,
  });

  const { accounts, holdings, securities } = response.data;

  const securityMap = new Map(securities.map((s) => [s.security_id, s]));

  const mappedAccounts: InvestmentAccount[] = accounts.map((a) => ({
    id: a.account_id,
    name: a.name,
    type: a.type,
    subtype: a.subtype ?? undefined,
    balance: a.balances.current ?? 0,
    currency: a.balances.iso_currency_code ?? "USD",
  }));

  const mappedHoldings: InvestmentHolding[] = holdings.map((h) => {
    const security = securityMap.get(h.security_id);
    const price = h.institution_price ?? security?.close_price ?? 0;
    const value = h.institution_value ?? price * (h.quantity ?? 0);
    const account = accounts.find((a) => a.account_id === h.account_id);

    return {
      accountId: h.account_id,
      accountName: account?.name ?? "Account",
      securityName: security?.name ?? "Unknown",
      ticker: security?.ticker_symbol ?? undefined,
      quantity: h.quantity ?? 0,
      price,
      value,
      currency: h.iso_currency_code ?? "USD",
    };
  });

  const totalValue = mappedAccounts.reduce((sum, a) => sum + a.balance, 0);

  return {
    totalValue,
    accounts: mappedAccounts,
    holdings: mappedHoldings.sort((a, b) => b.value - a.value),
    lastUpdated: new Date().toISOString(),
  };
}
