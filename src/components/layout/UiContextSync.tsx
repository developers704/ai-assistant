"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Sync current page to server for Voice/Chat context — no LLM cost. */
export function UiContextSync() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;
    void fetch("/api/ui-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPath: pathname, lastOpenedPage: pathname }),
    });
  }, [pathname]);

  return null;
}

export async function syncUiSelection(patch: Record<string, string | undefined>) {
  await fetch("/api/ui-context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
