"use client";

import Link from "next/link";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Icon, IconBadge } from "@/components/ui/Icon";
import { WeatherWidget } from "@/components/ui/WeatherWidget";
import {
  formatCurrency,
  getPriorityColor,
  formatLongDate,
  getGreeting,
  getDisplayFirstName,
} from "@/lib/utils";
import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { filterCalendarEvents, formatTimeInTimezone } from "@/lib/calendar-utils";
import { isTodayInTimezone, userTimezone } from "@/lib/calendar-dates";
import {
  Calendar,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  Plus,
  PieChart,
} from "lucide-react";

export default function DashboardPage() {
  const { state } = useApp();
  if (!state) return null;

  const portfolio = state.portfolio;
  const plaidConnected = state.integrations?.plaid?.connected ?? false;
  const institutionName = state.integrations?.plaid?.institutionName ?? "Investments";

  const tz = userTimezone(state);
  const todayEvents = filterCalendarEvents(state.events)
    .filter((e) => isTodayInTimezone(e.start, tz))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const pendingTasks = state.reminders.filter((r) => !r.completed);
  const urgentEmails = state.emails.filter((e) => e.category === "urgent" && !e.isRead);
  const salesSummary = computeSalesSummary(mockSalesData);

  const firstName = getDisplayFirstName(state.user?.name);

  return (
    <div>
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        subtitle={formatLongDate()}
        action={<WeatherWidget />}
      />

      <Card className="mb-6">
        <p className="text-ink-secondary text-sm">
          <span className="text-ink font-medium">{todayEvents.length} meetings</span>
          {" · "}
          <span className="text-ink font-medium">{pendingTasks.length} tasks</span>
          {" · "}
          <span className="text-ink font-medium">{urgentEmails.length} urgent emails</span>
          {portfolio && (
            <>
              {" · "}
              <span className="text-ink font-medium">
                Portfolio {formatCurrency(portfolio.totalValue)}
              </span>
            </>
          )}
        </p>
      </Card>

      {urgentEmails.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-400/30 flex items-start gap-3 ring-1 ring-rose-400/20">
          <Icon icon={AlertTriangle} size="lg" className="text-rose-300 flex-shrink-0 mt-0.5" active />
          <div>
            <p className="font-medium text-rose-100">Priority Alert</p>
            <p className="text-sm text-rose-200/90 mt-0.5">
              Urgent email from {urgentEmails[0].from}: {urgentEmails[0].subject}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <IconBadge
                icon={TrendingUp}
                iconBg="bg-emerald-500/20"
                iconColor="text-emerald-300"
                size="md"
              />
              Today&apos;s Sales
            </CardTitle>
            <Link href="/sales" className="text-emerald-300 text-sm hover:text-emerald-200 flex items-center gap-1">
              Details <Icon icon={ArrowRight} size="sm" />
            </Link>
          </CardHeader>
          <p className="text-3xl font-bold text-ink">{formatCurrency(salesSummary.totalRevenue)}</p>
          <div className="flex items-center gap-2 mt-2">
            {salesSummary.comparisonPreviousDay >= 0 ? (
              <Icon icon={TrendingUp} size="sm" className="text-emerald-400" />
            ) : (
              <Icon icon={TrendingDown} size="sm" className="text-rose-400" />
            )}
            <span className={salesSummary.comparisonPreviousDay >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {salesSummary.comparisonPreviousDay >= 0 ? "+" : ""}
              {salesSummary.comparisonPreviousDay.toFixed(1)}% vs yesterday
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {salesSummary.topStores.slice(0, 2).map((store) => (
              <div key={store.name} className="flex justify-between text-sm">
                <span className="text-ink-secondary">{store.name}</span>
                <span className="font-medium text-ink">{formatCurrency(store.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <IconBadge icon={Calendar} iconBg="bg-rose-500/20" iconColor="text-rose-300" size="md" />
              Schedule
            </CardTitle>
            <Link href="/calendar" className="text-rose-300 text-sm hover:text-rose-200">
              View all
            </Link>
          </CardHeader>
          <div className="space-y-3">
            {todayEvents.slice(0, 4).map((event) => (
              <div key={event.id} className="flex gap-3">
                <span className="text-xs text-ink-muted w-16 flex-shrink-0 pt-0.5">
                  {formatTimeInTimezone(event.start, tz)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{event.title}</p>
                  {event.location && (
                    <p className="text-xs text-ink-muted truncate">{event.location}</p>
                  )}
                </div>
              </div>
            ))}
            {todayEvents.length === 0 && (
              <p className="text-sm text-ink-muted">No meetings today</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <IconBadge icon={CheckSquare} iconBg="bg-amber-500/20" iconColor="text-amber-300" size="md" />
              Tasks
            </CardTitle>
            <Link href="/calendar" className="text-amber-300 text-sm hover:text-amber-200">
              View all
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {pendingTasks.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-ink-muted">No tasks yet</p>
                <Link
                  href="/calendar"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-amber-300 hover:text-amber-200"
                >
                  <Icon icon={Plus} size="xs" /> Add a task in Calendar & Tasks
                </Link>
              </div>
            ) : (
              pendingTasks.slice(0, 4).map((task) => (
                <div key={task.id} className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  <span className="text-sm text-ink truncate">{task.title}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <IconBadge icon={PieChart} iconBg="bg-indigo-500/20" iconColor="text-indigo-300" size="md" />
              Portfolio
            </CardTitle>
            <Link href="/investments" className="text-indigo-300 text-sm hover:text-indigo-200">
              View all
            </Link>
          </CardHeader>
          {plaidConnected && portfolio ? (
            <>
              <p className="text-3xl font-bold text-ink">{formatCurrency(portfolio.totalValue)}</p>
              <p className="text-xs text-ink-muted mt-1">{institutionName}</p>
              <div className="mt-4 space-y-2">
                {(portfolio.holdings.length > 0
                  ? portfolio.holdings.slice(0, 3).map((h) => ({
                      key: h.ticker ?? h.securityName,
                      label: h.ticker ?? h.securityName,
                      value: h.value,
                    }))
                  : portfolio.accounts.slice(0, 3).map((a) => ({
                      key: a.id,
                      label: a.name,
                      value: a.balance,
                    }))
                ).map((item) => (
                  <div key={item.key} className="flex justify-between text-sm gap-2">
                    <span className="text-ink-secondary truncate">{item.label}</span>
                    <span className="font-medium text-ink shrink-0">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-2">
              <p className="text-sm text-ink-muted">
                {plaidConnected ? "Loading portfolio…" : "Connect Vanguard in Settings"}
              </p>
              {!plaidConnected && (
                <Link href="/settings" className="text-xs text-indigo-300 hover:text-indigo-200 mt-2 inline-block">
                  Connect account
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
