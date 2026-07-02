"use client";

import { useEffect } from "react";

/** Removes the static HTML splash once React has mounted. */
export function SplashDismiss() {
  useEffect(() => {
    const el = document.getElementById("static-app-splash");
    if (!el) return;
    el.classList.add("opacity-0", "pointer-events-none");
    const t = window.setTimeout(() => el.remove(), 320);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
