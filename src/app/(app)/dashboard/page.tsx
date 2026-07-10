"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Daily Briefing removed — redirect legacy /dashboard links to AI Chat. */
export default function DashboardRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/chat");
  }, [router]);
  return null;
}
