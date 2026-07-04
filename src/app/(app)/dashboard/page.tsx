"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";
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
  ArrowUpRight,
  Mail,
  Plus,
  MapPin,
} from "lucide-react";

function StatPill({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: typeof Calendar;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08] min-w-0">
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1", accent)}>
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-white leading-none tabular-nums">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}

function SectionLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium uppercase tracking-wider transition-colors",
        className
      )}
    >
      {children}
      <ArrowUpRight size={12} strokeWidth={2} />
    </Link>
  );
}

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
  const positiveTrend = salesSummary.comparisonPreviousDay >= 0;

  return (
    <div className="pb-8 max-lg:-mx-1">
      {/* Hero */}
      <header className="relative mb-6 sm:mb-8 overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/8 to-transparent pointer-events-none" />
        <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
        <div className="relative px-1 pt-1 pb-2 sm:px-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/70 mb-2">
            Daily Briefing
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            <span className="text-gradient-title">{getGreeting()}, </span>
            <span className="text-gradient-accent">{firstName}</span>
          </h1>
          <p className="text-sm text-white/45 mt-1.5">{formatLongDate()}</p>
        </div>
      </header>

      {/* At a glance */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <StatPill
          icon={Calendar}
          value={todayEvents.length}
          label="Meetings"
          accent="bg-rose-500/15 text-rose-300 ring-rose-400/25"
        />
        <StatPill
          icon={CheckSquare}
          value={pendingTasks.length}
          label="Tasks"
          accent="bg-amber-500/15 text-amber-300 ring-amber-400/25"
        />
        <StatPill
          icon={Mail}
          value={urgentEmails.length}
          label="Urgent"
          accent="bg-violet-500/15 text-violet-300 ring-violet-400/25"
        />
      </div>

      {/* Priority alert */}
      {urgentEmails.length > 0 && (
        <div className="mb-6 relative overflow-hidden rounded-2xl ring-1 ring-rose-400/25 bg-gradient-to-r from-rose-950/40 to-rose-900/20">
          <div className="absolute left-0 inset-y-0 w-1 bg-gradient-to-b from-rose-400 to-rose-600" />
          <div className="flex items-start gap-3 p-4 pl-5">
            <AlertTriangle size={18} className="text-rose-300 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">Priority</p>
              <p className="text-sm text-white/90 mt-1 leading-snug">
                <span className="text-rose-200/80">{urgentEmails[0].from}</span>
                {" — "}
                {urgentEmails[0].subject}
              </p>
              <Link
                href="/email"
                className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-rose-300 hover:text-rose-200 transition-colors"
              >
                Open inbox <ArrowUpRight size={11} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Sales hero */}
      <section className="mb-5 relative overflow-hidden rounded-3xl ring-1 ring-emerald-400/20 bg-gradient-to-br from-[#0f1a18] via-[#121a28] to-[#151028]">
        <div className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300/70">
                {salesSource === "report" ? "Report sales" : "Today&apos;s sales"}
              </p>
              {salesSource === "report" && reportLabel && (
                <p className="text-[11px] text-white/35 mt-1 line-clamp-1">{reportLabel}</p>
              )}
            </div>
            <SectionLink href="/sales" className="text-emerald-400/80 hover:text-emerald-300 shrink-0">
              Details
            </SectionLink>
          </div>

          <p className="text-4xl sm:text-[2.75rem] font-bold text-white tracking-tight tabular-nums">
            {formatCurrency(salesSummary.totalRevenue)}
          </p>

          <div className="flex items-center gap-2 mt-2">
            {positiveTrend ? (
              <TrendingUp size={15} className="text-emerald-400" strokeWidth={2} />
            ) : (
              <TrendingDown size={15} className="text-rose-400" strokeWidth={2} />
            )}
            <span className={cn("text-sm font-medium", positiveTrend ? "text-emerald-400" : "text-rose-400")}>
              {positiveTrend ? "+" : ""}
              {salesSummary.comparisonPreviousDay.toFixed(1)}%
            </span>
            <span className="text-xs text-white/30">vs prior period</span>
          </div>

          {salesSource === "mock" && (
            <p className="text-[11px] text-white/35 mt-3">
              Demo data — upload CSV in{" "}
              <Link href="/analyst" className="text-cyan-400/80 hover:text-cyan-300">
                Data Analyst
              </Link>
            </p>
          )}

          {salesSummary.topStores.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-white/[0.06]">
              {salesSummary.topStores.slice(0, 3).map((store, i) => (
                <div
                  key={store.name}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]"
                >
                  <span className="text-[10px] font-bold text-emerald-400/60 tabular-nums">#{i + 1}</span>
                  <span className="text-xs text-white/70">{store.name}</span>
                  <span className="text-xs font-semibold text-white tabular-nums">
                    {formatCurrency(store.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Schedule + Tasks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <section className="rounded-3xl ring-1 ring-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/12 ring-1 ring-rose-400/20">
                <Calendar size={16} className="text-rose-300" strokeWidth={1.75} />
              </span>
              <h2 className="text-sm font-semibold text-white">Schedule</h2>
            </div>
            <SectionLink href="/calendar" className="text-rose-400/70 hover:text-rose-300">
              All
            </SectionLink>
          </div>

          <div className="space-y-0">
            {todayEvents.length === 0 ? (
              <p className="text-sm text-white/35 py-4 text-center">Clear calendar today</p>
            ) : (
              todayEvents.slice(0, 4).map((event, i) => (
                <div
                  key={event.id}
                  className={cn(
                    "flex gap-3 py-3",
                    i > 0 && "border-t border-white/[0.05]"
                  )}
                >
                  <span className="text-[11px] font-medium text-rose-300/70 w-14 shrink-0 pt-0.5 tabular-nums">
                    {formatTimeInTimezone(event.start, tz)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/90 leading-snug truncate">{event.title}</p>
                    {event.location && (
                      <p className="text-[11px] text-white/35 mt-0.5 flex items-center gap-1 truncate">
                        <MapPin size={10} className="shrink-0 opacity-60" />
                        {event.location}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl ring-1 ring-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/12 ring-1 ring-amber-400/20">
                <CheckSquare size={16} className="text-amber-300" strokeWidth={1.75} />
              </span>
              <h2 className="text-sm font-semibold text-white">Tasks</h2>
            </div>
            <SectionLink href="/calendar" className="text-amber-400/70 hover:text-amber-300">
              All
            </SectionLink>
          </div>

          {pendingTasks.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-white/35">All caught up</p>
              <Link
                href="/calendar"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-amber-400/80 hover:text-amber-300 transition-colors"
              >
                <Plus size={13} /> Add task
              </Link>
            </div>
          ) : (
            <div className="space-y-0">
              {pendingTasks.slice(0, 4).map((task, i) => (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-2.5 py-2.5",
                    i > 0 && "border-t border-white/[0.05]"
                  )}
                >
                  <span className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 font-medium uppercase tracking-wide ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  <span className="text-sm text-white/85 truncate">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {reportSummary && salesSource === "report" && (
        <ReportInsightsCards summary={reportSummary} compact variant="briefing" />
      )}
    </div>
  );
}
