"use client";

import { cn } from "@/lib/utils";

interface AppSplashProps {
  /**
   * fullscreen — branded splash with name (legacy / rare)
   * compact — small inline loader
   * os-match — same look as mobile OS/PWA splash (icon on solid bg only)
   */
  variant?: "fullscreen" | "compact" | "os-match";
  className?: string;
}

/**
 * Launch splash — always the home-screen mark (`/icon.svg`).
 * `os-match` mirrors Chrome/Android: centered icon on `#1e2733`, nothing else.
 */
export function AppSplash({ variant = "os-match", className }: AppSplashProps) {
  const compact = variant === "compact";
  const osMatch = variant === "os-match" || variant === "fullscreen";

  if (osMatch && !compact) {
    return (
      <div
        className={cn(
          "flex min-h-screen flex-col items-center justify-center bg-[#1e2733]",
          className
        )}
        role="status"
        aria-live="polite"
        aria-label="Loading Alexa"
      >
        <img
          src="/icon.svg"
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 rounded-[22%] shadow-none"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-8",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Loading Alexa"
    >
      <img
        src="/icon.svg"
        alt=""
        width={56}
        height={56}
        className="h-14 w-14 rounded-[22%]"
        draggable={false}
      />
    </div>
  );
}
