"use client";

import type { AppState } from "@/types";
import { cn } from "@/lib/utils";
import { IconBadge } from "@/components/ui/Icon";
import {
  Sparkles,
  ChevronRight,
  MessageSquare,
  TrendingUp,
  Mail,
  Calendar,
  Gem,
  Bell,
  type LucideIcon,
} from "lucide-react";

export const CHAT_SUGGESTIONS: {
  text: string;
  icon: LucideIcon;
  gradient: string;
  iconColor: string;
  glow: string;
  ringColor: string;
  ring: string;
}[] = [
  {
    text: "What do I need to focus on today?",
    icon: MessageSquare,
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
    iconColor: "text-white",
    glow: "shadow-[0_4px_14px_rgba(139,92,246,0.45)]",
    ringColor: "ring-violet-300/35",
    ring: "hover:ring-violet-400/35",
  },
  {
    text: "Show me today's sales across all stores",
    icon: TrendingUp,
    gradient: "from-emerald-400 via-teal-500 to-emerald-600",
    iconColor: "text-white",
    glow: "shadow-[0_4px_14px_rgba(52,211,153,0.45)]",
    ringColor: "ring-emerald-200/35",
    ring: "hover:ring-emerald-400/35",
  },
  {
    text: "Summarize my important emails",
    icon: Mail,
    gradient: "from-blue-400 via-blue-500 to-indigo-600",
    iconColor: "text-white",
    glow: "shadow-[0_4px_14px_rgba(59,130,246,0.45)]",
    ringColor: "ring-blue-200/35",
    ring: "hover:ring-blue-400/35",
  },
  {
    text: "What's on my calendar today?",
    icon: Calendar,
    gradient: "from-amber-400 via-orange-400 to-yellow-500",
    iconColor: "text-white",
    glow: "shadow-[0_4px_14px_rgba(251,146,60,0.45)]",
    ringColor: "ring-amber-200/35",
    ring: "hover:ring-amber-400/35",
  },
  {
    text: "Draft an email to the diamond supplier",
    icon: Gem,
    gradient: "from-fuchsia-500 via-purple-500 to-violet-700",
    iconColor: "text-white",
    glow: "shadow-[0_4px_14px_rgba(217,70,239,0.45)]",
    ringColor: "ring-fuchsia-200/35",
    ring: "hover:ring-fuchsia-400/35",
  },
  {
    text: "Remind me to review Baybrook Mall lease tomorrow",
    icon: Bell,
    gradient: "from-orange-400 via-rose-500 to-red-500",
    iconColor: "text-white",
    glow: "shadow-[0_4px_14px_rgba(251,113,133,0.45)]",
    ringColor: "ring-orange-200/35",
    ring: "hover:ring-orange-400/35",
  },
];

function buildHighlights(state: AppState) {
  const unread = state.emails.filter((e) => !e.isRead).length;
  const pendingTasks = state.reminders.filter((r) => !r.completed).length;
  const todayEvents = state.events.length;
  return [
    {
      label: "Inbox",
      value: unread > 0 ? `${unread} unread emails` : "Inbox caught up",
      tone: unread > 5 ? "text-amber-200" : "text-emerald-200",
    },
    {
      label: "Tasks",
      value: pendingTasks > 0 ? `${pendingTasks} open tasks` : "No pending tasks",
      tone: "text-violet-200",
    },
    {
      label: "Calendar",
      value: todayEvents > 0 ? `${todayEvents} events on file` : "Light calendar day",
      tone: "text-sky-200",
    },
  ];
}

function buildRecentActivity(state: AppState) {
  const fromChat = state.chatHistory
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .reverse()
    .map((m) => ({
      text: m.content.slice(0, 72).replace(/\n/g, " ") + (m.content.length > 72 ? "…" : ""),
      time: new Date(m.timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    }));

  if (fromChat.length > 0) return fromChat;

  return [
    { text: "Ask Alexa to summarize your inbox", time: "Ready" },
    { text: "Check today's sales across stores", time: "Ready" },
    { text: "Draft a follow-up email in one tap", time: "Ready" },
  ];
}

interface ChatWelcomeProps {
  state: AppState;
  disabled?: boolean;
  onSuggestion: (text: string) => void;
}

export function ChatWelcome({ state, disabled, onSuggestion }: ChatWelcomeProps) {
  const highlights = buildHighlights(state);
  const recent = buildRecentActivity(state);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Hero */}
      <div className="text-center pt-1 pb-5 sm:pt-4 sm:pb-8 max-lg:pt-0">
        <div className="relative mx-auto mb-4 sm:mb-6 w-fit">
          <div className="chat-orb-glow absolute inset-0 -m-5 sm:-m-6 rounded-full blur-2xl opacity-70" aria-hidden />
          <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-700 ring-1 ring-violet-300/40 shadow-[0_0_32px_rgba(139,92,246,0.4)]">
            <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-amber-300" strokeWidth={1.5} />
          </div>
        </div>

        <h2 className="text-[1.65rem] sm:text-3xl lg:text-[2rem] font-display font-semibold text-ink tracking-tight leading-tight px-2">
          How can I{" "}
          <span className="text-gradient-accent">help</span> you today?
        </h2>
        <p className="mt-2.5 text-sm sm:text-[15px] text-ink-secondary max-w-md mx-auto leading-relaxed px-4">
          <span className="lg:hidden">
            Emails, calendar, tasks, sales, documents, and more — just ask.
          </span>
          <span className="hidden lg:inline">
            Get clear answers, save time, and stay ahead.
          </span>
        </p>
      </div>

      {/* Suggestions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pb-2">
        {CHAT_SUGGESTIONS.map(({ text, icon, gradient, iconColor, glow, ringColor, ring }) => (
          <button
            key={text}
            type="button"
            disabled={disabled}
            onClick={() => onSuggestion(text)}
            className={cn(
              "group flex items-center gap-3 w-full text-left px-3 py-3 sm:px-4 sm:py-3.5 rounded-2xl",
              "bg-white/[0.04] ring-1 ring-white/10 transition-all duration-200",
              "hover:bg-white/[0.08] active:scale-[0.99] disabled:opacity-50",
              ring
            )}
          >
            <IconBadge
              icon={icon}
              gradient={gradient}
              iconColor={iconColor}
              glow={glow}
              ringColor={ringColor}
              variant="lush"
              size="md"
              className="h-10 w-10"
            />
            <span className="flex-1 min-w-0 text-[13px] sm:text-sm text-ink-secondary group-hover:text-ink leading-snug">
              {text}
            </span>
            <ChevronRight
              size={16}
              className="shrink-0 text-ink-muted opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
            />
          </button>
        ))}
      </div>

      {/* Desktop insight cards */}
      <div className="hidden lg:grid grid-cols-2 gap-4 mt-8">
        <div className="glass-panel rounded-2xl p-4 ring-1 ring-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-3">
            Recent activity
          </p>
          <ul className="space-y-3">
            {recent.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-ink-secondary line-clamp-2 leading-snug">{item.text}</span>
                <span className="text-[11px] text-ink-muted shrink-0 tabular-nums">{item.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel rounded-2xl p-4 ring-1 ring-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-3">
            Today&apos;s highlights
          </p>
          <ul className="space-y-3">
            {highlights.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-muted">{item.label}</span>
                <span className={cn("font-medium text-right", item.tone)}>{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
