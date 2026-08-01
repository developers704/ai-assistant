"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store/app-context";
import { Sidebar, MobileNav } from "@/components/layout/Sidebar";
import { RealtimeVoiceButton } from "@/components/voice/RealtimeVoiceButton";
import { VoiceProvider } from "@/components/voice/VoiceProvider";
import { VoiceMiniHud } from "@/components/voice/VoiceMiniHud";
import { FuturisticBackground } from "@/components/layout/FuturisticBackground";
import { UiContextSync } from "@/components/layout/UiContextSync";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { state, loading, refresh } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = state?.user?.authRole === "admin";

  const showFloatingVoice =
    isAdmin &&
    pathname !== "/chat" &&
    pathname !== "/voice" &&
    pathname !== "/email" &&
    pathname !== "/contacts" &&
    pathname !== "/images" &&
    pathname !== "/analyst";

  const isVoicePage = pathname === "/voice";
  const isEmailPage = pathname === "/email";

  useEffect(() => {
    if (loading) return;
    if (!state?.isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, state?.isAuthenticated, router]);

  if (loading || !state?.isAuthenticated) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <FuturisticBackground />
        <p className="relative text-sm text-ink-muted animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 relative">
        <FuturisticBackground />
        <p className="text-ink-muted">Could not load app data.</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const shell = (
    <div
      className={cn(
        "flex relative",
        isEmailPage ? "h-dvh max-h-dvh overflow-hidden" : "min-h-screen"
      )}
    >
      <UiContextSync />
      <FuturisticBackground />
      {!isVoicePage && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {!isVoicePage && <MobileNav />}
        <main
          className={cn(
            "flex-1 overflow-x-hidden min-h-0",
            (isVoicePage || isEmailPage) && "overflow-hidden flex flex-col"
          )}
        >
          {isVoicePage ? (
            children
          ) : isEmailPage ? (
            <div className="flex-1 min-h-0 h-0 flex flex-col px-0 sm:px-3 py-0 sm:py-2 lg:py-3">
              {children}
            </div>
          ) : (
            <div className="max-w-[100rem] mx-auto px-3 sm:px-5 lg:px-6 py-4 lg:py-6">
              {children}
            </div>
          )}
        </main>
      </div>
      {showFloatingVoice && <RealtimeVoiceButton />}
      {isAdmin && <VoiceMiniHud />}
    </div>
  );

  if (!isAdmin) return shell;

  return <VoiceProvider>{shell}</VoiceProvider>;
}
