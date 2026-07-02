"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Icon, IconBadge } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
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
import type { SalesSummary } from "@/types";
import type { ReportSummary } from "@/lib/reports/types";
import { ReportInsightsCards } from "@/components/reports/ReportInsightsCards";
import {
  Calendar,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  Plus,
} from "lucide-react";

export default function DashboardPage() {
  const { state } = useApp();
  const [salesSummary, setSalesSummary] = useState<SalesSummary>(() =>
    computeSalesSummary(mockSalesData)
  );
  const [salesSource, setSalesSource] = useState<"mock" | "report">("mock");
  const [reportLabel, setReportLabel] = useState<string | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);

  useEffect(() => {
    fetch("/api/sales")
      .then((r) => r.json())
      .then((d) => {
        if (d.summary) {
          setSalesSummary(d.summary);
          setSalesSource(d.source === "report" ? "report" : "mock");
          setReportLabel(d.reportLabel ?? null);
          if (d.source === "report") setReportSummary(d.summary as ReportSummary);
        }
      })
      .catch(() => {});
  }, []);

  if (!state) return null;

  const tz = userTimezone(state);
  const todayEvents = filterCalendarEvents(state.events)
    .filter((e) => isTodayInTimezone(e.start, tz))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const pendingTasks = state.reminders.filter((r) => !r.completed);
  const urgentEmails = state.emails.filter((e) => e.category === "urgent" && !e.isRead);

  const firstName = getDisplayFirstName(state.user?.name);

  return (
    <div>
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        subtitle={formatLongDate()}
      />

      <Card className="mb-6">
        <p className="text-ink-secondary text-sm">
          <span className="text-ink font-medium">{todayEvents.length} meetings</span>
          {" · "}
          <span className="text-ink font-medium">{pendingTasks.length} tasks</span>
          {" · "}
          <span className="text-ink font-medium">{urgentEmails.length} urgent emails</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <IconBadge
                icon={TrendingUp}
                gradient="from-emerald-400 via-teal-500 to-emerald-600"
                iconColor="text-white"
                glow="shadow-[0_4px_14px_rgba(52,211,153,0.45)]"
                ringColor="ring-emerald-200/40"
                variant="lush"
                size="md"
              />
              {salesSource === "report" ? "Latest Report Sales" : "Today&apos;s Sales"}
            </CardTitle>
            <Link href="/sales" className="text-emerald-300 text-sm hover:text-emerald-200 flex items-center gap-1">
              Details <Icon icon={ArrowRight} size="sm" />
            </Link>
          </CardHeader>
          {salesSource === "report" && reportLabel && (
            <Badge variant="success" className="mb-2 text-[10px]">
              From uploaded report: {reportLabel}
            </Badge>
          )}
          <p className="text-3xl font-bold text-ink">{formatCurrency(salesSummary.totalRevenue)}</p>
          <div className="flex items-center gap-2 mt-2">
            {salesSummary.comparisonPreviousDay >= 0 ? (
              <Icon icon={TrendingUp} size="sm" className="text-emerald-400" />
            ) : (
              <Icon icon={TrendingDown} size="sm" className="text-rose-400" />
            )}
            <span className={salesSummary.comparisonPreviousDay >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {salesSummary.comparisonPreviousDay >= 0 ? "+" : ""}
              {salesSummary.comparisonPreviousDay.toFixed(1)}% vs previous period
            </span>
          </div>
          {salesSource === "mock" && (
            <p className="text-xs text-ink-muted mt-2">
              Demo data — upload a CSV in{" "}
              <Link href="/analyst" className="text-cyan-300 hover:underline">
                Data Analyst
              </Link>{" "}
              for real numbers
            </p>
          )}
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
              <IconBadge
                icon={Calendar}
                gradient="from-rose-400 via-pink-500 to-rose-600"
                iconColor="text-white"
                glow="shadow-[0_4px_14px_rgba(244,63,94,0.45)]"
                ringColor="ring-rose-200/40"
                variant="lush"
                size="md"
              />
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
              <IconBadge
                icon={CheckSquare}
                gradient="from-amber-400 via-orange-400 to-yellow-500"
                iconColor="text-white"
                glow="shadow-[0_4px_14px_rgba(251,146,60,0.45)]"
                ringColor="ring-amber-200/40"
                variant="lush"
                size="md"
              />
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
      </div>

      {reportSummary && salesSource === "report" && (
        <div className="mt-6">
          <ReportInsightsCards summary={reportSummary} compact />
        </div>
      )}
    </div>
  );
}
