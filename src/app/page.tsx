"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store/app-context";

export default function HomePage() {
  const { loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace("/sales");
    }
  }, [loading, router]);

  return null;
}
