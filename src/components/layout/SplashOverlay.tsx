"use client";

import { useEffect, useState } from "react";
import { AppSplash } from "@/components/layout/AppSplash";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

const MIN_SPLASH_MS = 600;

/**
 * Single launch splash — stays until app data is ready (no double splash).
 */
export function SplashOverlay() {
  const { loading } = useApp();
  const [phase, setPhase] = useState<"visible" | "hiding" | "hidden">("visible");
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && minElapsed && phase === "visible") {
      setPhase("hiding");
      const done = window.setTimeout(() => setPhase("hidden"), 320);
      return () => window.clearTimeout(done);
    }
  }, [loading, minElapsed, phase]);

  if (phase === "hidden") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] bg-[#2a3444] transition-opacity duration-300",
        phase === "hiding" ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
      aria-hidden={phase === "hiding"}
      aria-busy={loading}
    >
      <AppSplash />
    </div>
  );
}
