"use client";

import type { AppState } from "@/types";
import { cn } from "@/lib/utils";
import { PlasmaOrb } from "@/components/ui/PlasmaOrb";
import { GlassIconTile, type GlassPalette } from "@/components/ui/GlassIconTile";
import {
  ChevronRight,
  TrendingUp,
  Mail,
  Calendar,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

export const CHAT_SUGGESTIONS: {
  text: string;
  icon: LucideIcon;
  palette: GlassPalette;
}[] = [
  {
    text: "What's on my calendar today?",
    icon: Calendar,
    palette: "rose",
  },
  {
    text: "Show me today's sales across all stores",
    icon: TrendingUp,
    palette: "emerald",
  },
  {
    text: "Summarize my important emails",
    icon: Mail,
    palette: "indigo",
  },
  {
    text: "Show me news and markets",
    icon: Newspaper,
    palette: "sky",
  },
];

interface ChatWelcomeProps {
  state: AppState;
  disabled?: boolean;
  onSuggestion: (text: string) => void;
}

function greetingForNow(name?: string | null) {
  const hour = new Date().getHours();
  const first = (name ?? "").trim().split(/\s+/)[0] || null;
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return first ? `${part}, ${first}` : part;
}

export function ChatWelcome({ state, disabled, onSuggestion }: ChatWelcomeProps) {
  const greeting = greetingForNow(state.user?.name);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Hero */}
      <div className="text-center pt-1 pb-5 sm:pt-4 sm:pb-8 max-lg:pt-0">
        <div className="relative mx-auto mb-4 sm:mb-6 w-fit msg-enter">
          <div className="chat-orb-glow absolute inset-0 -m-6 sm:-m-8 rounded-full blur-3xl opacity-80" aria-hidden />
          <PlasmaOrb className="plasma-orb-float relative h-24 w-24 sm:h-32 sm:w-32" />
        </div>

        <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-violet-300/80 mb-1.5">
          {greeting}
        </p>
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
        {CHAT_SUGGESTIONS.map(({ text, icon: SuggestIcon, palette }, i) => (
          <button
            key={text}
            type="button"
            disabled={disabled}
            onClick={() => onSuggestion(text)}
            style={{ animationDelay: `${80 + i * 55}ms` }}
            className={cn(
              "chat-suggest-card msg-enter group flex items-center gap-3 w-full text-left px-3 py-3 sm:px-4 sm:py-3.5 rounded-2xl",
              "bg-white/[0.04] ring-1 ring-white/10 transition-all duration-200",
              "hover:bg-white/[0.08] hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-50",
              "hover:ring-violet-400/20"
            )}
          >
            <GlassIconTile icon={SuggestIcon} palette={palette} size="md" />
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
    </div>
  );
}
