"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store/app-context";

export default function HomePage() {
  const { loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace("/chat");
    }
  }, [loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-ink-muted">Loading...</div>
    </div>
  );
}
