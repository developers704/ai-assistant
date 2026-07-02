"use client";

import { useEffect, useState } from "react";
import { AppSplash } from "@/components/layout/AppSplash";
import { cn } from "@/lib/utils";

/**
 * React-managed launch overlay — never call el.remove() on body children
 * (that breaks React reconciliation and causes removeChild errors on navigation).
 */
export function SplashOverlay() {
  const [phase, setPhase] = useState<"visible" | "hiding" | "hidden">("visible");

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setPhase("hiding"), 80);
    const doneTimer = window.setTimeout(() => setPhase("hidden"), 450);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] bg-[#1e2733] transition-opacity duration-300",
        phase === "hiding" ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
      aria-hidden={phase === "hiding"}
    >
      <AppSplash />
    </div>
  );
}
