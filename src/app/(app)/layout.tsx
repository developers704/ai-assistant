"use client";

import { usePathname } from "next/navigation";
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
  const showFloatingVoice =
    pathname !== "/chat" &&
    pathname !== "/voice" &&
    pathname !== "/email" &&
    pathname !== "/contacts" &&
    pathname !== "/images" &&
    pathname !== "/analyst";

  const isVoicePage = pathname === "/voice";

  if (loading) {
    return null;
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

  return (
    <VoiceProvider>
      <div className="flex min-h-screen relative">
        <UiContextSync />
        <FuturisticBackground />
        {!isVoicePage && <Sidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          {!isVoicePage && <MobileNav />}
          <main className={cn("flex-1 overflow-x-hidden", isVoicePage && "overflow-hidden")}>
            {isVoicePage ? (
              children
            ) : (
              <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 lg:py-6">
                {children}
              </div>
            )}
          </main>
        </div>
        {showFloatingVoice && <RealtimeVoiceButton />}
        <VoiceMiniHud />
      </div>
    </VoiceProvider>
  );
}
