"use client";

import { FuturisticBackground } from "@/components/layout/FuturisticBackground";
import { cn } from "@/lib/utils";

interface AppSplashProps {
  /** compact = smaller logo for inline loading states */
  variant?: "fullscreen" | "compact";
  className?: string;
}

/**
 * Branded launch splash — same mark as the home-screen / PWA icon (`/icon.svg`).
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
          "relative z-[1] flex flex-col items-center",
          compact ? "gap-3" : "gap-4"
        )}
      >
        {/* Same asset as installed app icon — avoids a second mismatched mark on launch */}
        <img
          src="/icon.svg"
          alt=""
          width={compact ? 56 : 80}
          height={compact ? 56 : 80}
          className={cn(
            "rounded-[22%] shadow-[0_12px_40px_rgba(76,29,149,0.45)] ring-1 ring-white/15",
            compact ? "h-14 w-14" : "h-20 w-20 sm:h-[5.5rem] sm:w-[5.5rem]"
          )}
          draggable={false}
        />

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
