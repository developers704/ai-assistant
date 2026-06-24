"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconBadge } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/utils";
import { computeAllocation } from "@/lib/plaid/portfolio-context";
import { PortfolioAllocationChart } from "@/components/investments/PortfolioAllocationChart";
import {
  PieChart,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Link2,
  Wallet,
  Building2,
} from "lucide-react";

interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  balance: number;
  currency: string;
}

interface InvestmentHolding {
  accountId: string;
  accountName: string;
  securityName: string;
  ticker?: string;
  quantity: number;
  price: number;
  value: number;
  currency: string;
}

interface InvestmentData {
  connected: boolean;
  totalValue: number;
  accounts: InvestmentAccount[];
  holdings: InvestmentHolding[];
  lastUpdated: string;
  error?: string;
}

export default function InvestmentsPage() {
  const { state } = useApp();
  const [data, setData] = useState<InvestmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const plaidConnected = state?.integrations?.plaid?.connected ?? false;
  const institutionName = state?.integrations?.plaid?.institutionName ?? "Vanguard";
  const plaidEnv = state?.integrations?.plaid?.env ?? "sandbox";

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/investments");
      const json = await res.json();
      if (!res.ok) {
        setData({
          connected: false,
          totalValue: 0,
          accounts: [],
          holdings: [],
          lastUpdated: new Date().toISOString(),
          error: json.error ?? "Could not load portfolio",
        });
        return;
      }
      setData(json as InvestmentData);
    } catch {
      setData({
        connected: false,
        totalValue: 0,
        accounts: [],
        holdings: [],
        lastUpdated: new Date().toISOString(),
        error: "Network error loading portfolio",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (plaidConnected) load();
    else {
      setLoading(false);
      setData(null);
    }
  }, [plaidConnected, load]);

  return (
    <div className="flex flex-col min-h-0">
      <div className="glass-panel-strong rounded-3xl ring-1 ring-white/10 overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
          <PageHeader
            title="Investments"
            subtitle={`Portfolio via Plaid · ${institutionName} · ${plaidEnv}`}
            action={
              plaidConnected ? (
                <Button size="sm" variant="outline" onClick={() => load(true)} disabled={refreshing}>
                  {refreshing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}{" "}
                  Refresh
                </Button>
              ) : null
            }
          />
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5">
          {!plaidConnected && (
            <Card className="border-amber-400/25 bg-amber-500/10">
              <div className="flex items-start gap-3">
                <IconBadge icon={Link2} iconBg="bg-amber-500/25" iconColor="text-amber-300" size="md" />
                <div className="flex-1">
                  <p className="font-medium text-ink">No investment account connected</p>
                  <p className="text-sm text-ink-muted mt-1">
                    Connect Vanguard (or a Sandbox test bank) in Settings to view holdings here.
                  </p>
                  <Link href="/settings" className="inline-block mt-3">
                    <Button size="sm">
                      <Link2 size={14} /> Go to Settings
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}

          {plaidConnected && loading && (
            <div className="flex items-center justify-center py-16 text-ink-muted gap-2">
              <Loader2 size={20} className="animate-spin" />
              Loading portfolio…
            </div>
          )}

          {plaidConnected && !loading && data?.error && (
            <Card className="border-rose-400/25 bg-rose-500/10">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-rose-300 mt-0.5" />
                <div>
                  <p className="font-medium text-ink">Could not load holdings</p>
                  <p className="text-sm text-ink-muted mt-1">{data.error}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => load(true)}>
                    Try again
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {plaidConnected && !loading && data && !data.error && (
            <>
              <Card className="bg-gradient-to-br from-indigo-500/15 to-violet-500/10 border-indigo-400/20">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-ink-muted mb-1">Total portfolio value</p>
                    <p className="text-4xl font-bold text-ink">{formatCurrency(data.totalValue)}</p>
                    <p className="text-xs text-ink-muted mt-2">
                      {data.accounts.length} account{data.accounts.length !== 1 ? "s" : ""} ·{" "}
                      {data.holdings.length} holding{data.holdings.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge variant="success">{institutionName}</Badge>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.accounts.map((account) => (
                  <Card key={account.id}>
                    <div className="flex items-start gap-3">
                      <IconBadge
                        icon={Wallet}
                        iconBg="bg-indigo-500/20"
                        iconColor="text-indigo-300"
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink truncate">{account.name}</p>
                        <p className="text-xs text-ink-muted capitalize">
                          {account.subtype ?? account.type}
                        </p>
                        <p className="text-lg font-semibold text-ink mt-2">
                          {formatCurrency(account.balance)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <PortfolioAllocationChart
                    slices={computeAllocation(data.holdings, data.accounts, data.totalValue)}
                    totalValue={data.totalValue}
                    title={data.holdings.length > 0 ? "Allocation by holding" : "Allocation by account"}
                  />
                </Card>
                {data.accounts.length > 1 && (
                  <Card>
                    <PortfolioAllocationChart
                      slices={computeAllocation([], data.accounts, data.totalValue)}
                      totalValue={data.totalValue}
                      title="Allocation by account"
                    />
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2.5">
                    <IconBadge
                      icon={PieChart}
                      iconBg="bg-violet-500/20"
                      iconColor="text-violet-300"
                      size="md"
                    />
                    Holdings
                  </CardTitle>
                </CardHeader>

                {data.holdings.length === 0 ? (
                  <p className="text-sm text-ink-muted py-4">No holdings returned for this account.</p>
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-ink-muted border-b border-white/10">
                          <th className="pb-2 pr-4 font-medium">Security</th>
                          <th className="pb-2 pr-4 font-medium">Ticker</th>
                          <th className="pb-2 pr-4 font-medium text-right">Qty</th>
                          <th className="pb-2 pr-4 font-medium text-right">Price</th>
                          <th className="pb-2 font-medium text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.holdings.map((h, i) => (
                          <tr key={`${h.accountId}-${h.ticker ?? h.securityName}-${i}`} className="border-b border-white/5">
                            <td className="py-2.5 pr-4">
                              <p className="text-ink font-medium truncate max-w-[200px]">{h.securityName}</p>
                              <p className="text-xs text-ink-muted truncate">{h.accountName}</p>
                            </td>
                            <td className="py-2.5 pr-4 text-ink-secondary">{h.ticker ?? "—"}</td>
                            <td className="py-2.5 pr-4 text-right text-ink-secondary">
                              {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </td>
                            <td className="py-2.5 pr-4 text-right text-ink-secondary">
                              {formatCurrency(h.price)}
                            </td>
                            <td className="py-2.5 text-right font-medium text-ink">
                              {formatCurrency(h.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <Building2 size={12} />
                Data via Plaid · read-only · last fetched{" "}
                {new Date(data.lastUpdated).toLocaleString()}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
