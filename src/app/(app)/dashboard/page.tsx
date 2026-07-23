"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Daily Briefing removed — redirect legacy /dashboard links to Sales. */
export default function DashboardRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sales");
  }, [router]);
  return null;
}
