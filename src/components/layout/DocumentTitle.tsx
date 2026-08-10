"use client";

import { useEffect } from "react";
import { APP_TITLE } from "@/lib/brand";

/** Keep the window / tab title on brand (blocks stale PWA “Alexa …” leftovers). */
export function DocumentTitle() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = APP_TITLE;
  }, []);
  return null;
}
