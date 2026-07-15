"use client";

import { useEffect, useState } from "react";
import { AppSplash } from "@/components/layout/AppSplash";
import { useApp } from "@/lib/store/app-context";

const MIN_SPLASH_MS = 700;
const EXIT_MS = 180;

/**
 * Single launch splash. Background stays fully opaque until unmount so the
 * chat UI never shows through a transparent fade (which looked like two icons).
 */
export function SplashOverlay() {
  const { loading } = useApp();
  const [readyToHide, setReadyToHide] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReadyToHide(true), MIN_SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && readyToHide && !hidden) {
      const done = window.setTimeout(() => setHidden(true), EXIT_MS);
      return () => window.clearTimeout(done);
    }
  }, [loading, readyToHide, hidden]);

  if (hidden) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#1e2733]"
      aria-busy={loading}
      aria-label="Loading Alexa"
    >
      <AppSplash />
    </div>
  );
}
