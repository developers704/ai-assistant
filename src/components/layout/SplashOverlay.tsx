"use client";

import { useEffect, useState } from "react";
import { AppSplash } from "@/components/layout/AppSplash";
import { useApp } from "@/lib/store/app-context";

const MIN_SPLASH_MS = 650;
const EXIT_MS = 160;

function readPwaFlag(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.dataset.pwa === "1") return true;
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)");
  if (mq.matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  return false;
}

/**
 * Desktop / browser tab: show one branded splash until ready.
 * Installed mobile app (PWA): skip — OS already showed the icon splash.
 * That second in-app splash was the “two icons” on phone.
 */
export function SplashOverlay() {
  const { loading } = useApp();
  const [isPwa] = useState(readPwaFlag);
  const [readyToHide, setReadyToHide] = useState(false);
  const [hidden, setHidden] = useState(isPwa);

  useEffect(() => {
    if (isPwa) {
      setHidden(true);
      return;
    }
    const timer = window.setTimeout(() => setReadyToHide(true), MIN_SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [isPwa]);

  useEffect(() => {
    if (isPwa || hidden) return;
    if (!loading && readyToHide) {
      const done = window.setTimeout(() => setHidden(true), EXIT_MS);
      return () => window.clearTimeout(done);
    }
  }, [loading, readyToHide, hidden, isPwa]);

  if (isPwa || hidden) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#1e2733]"
      aria-busy={loading}
      aria-label="Loading Alexa"
    >
      <AppSplash variant="os-match" />
    </div>
  );
}
