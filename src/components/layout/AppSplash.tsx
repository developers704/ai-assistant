"use client";

import { Sparkles } from "lucide-react";
import { FuturisticBackground } from "@/components/layout/FuturisticBackground";
import { cn } from "@/lib/utils";

interface AppSplashProps {
  /** compact = smaller logo for inline loading states */
  variant?: "fullscreen" | "compact";
  className?: string;
}

/**
 * Branded launch splash — icon + Alexa name (not icon-only).
 * Used while app state hydrates after PWA/home-screen open.
 */
export function AppSplash({ variant = "fullscreen", className }: AppSplashProps) {
  const compact = variant === "compact";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "min-h-screen relative",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Loading Alexa"
    >
      {!compact && <FuturisticBackground />}

      <div
        className={cn(
          "flex flex-col items-center animate-in fade-in zoom-in-95 duration-500",
          compact ? "gap-3" : "gap-4"
        )}
      >
        <div
          className={cn(
            "app-logo-badge icon-badge flex items-center justify-center rounded-2xl ring-1 ring-violet-400/35 shadow-glow",
            compact ? "h-14 w-14" : "h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20"
          )}
        >
          <Sparkles
            className={cn("text-amber-300", compact ? "h-7 w-7" : "h-9 w-9 sm:h-10 sm:w-10")}
            strokeWidth={1.75}
          />
        </div>

        <div className="space-y-1">
          <h1
            className={cn(
              "font-display font-semibold tracking-tight text-gradient-title",
              compact ? "text-2xl" : "text-3xl sm:text-4xl"
            )}
          >
            Alexa
          </h1>
          <p
            className={cn(
              "text-ink-muted tracking-[0.2em] uppercase",
              compact ? "text-[10px]" : "text-[11px] sm:text-xs"
            )}
          >
            executive assistance
          </p>
        </div>

        <div className="flex items-center gap-1.5 pt-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400/80 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400/60 animate-pulse [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400/40 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
