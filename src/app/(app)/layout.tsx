"use client";

import { useApp } from "@/lib/store/app-context";
import { Sidebar, MobileNav } from "@/components/layout/Sidebar";
import { RealtimeVoiceButton } from "@/components/voice/RealtimeVoiceButton";
import { FuturisticBackground } from "@/components/layout/FuturisticBackground";
import { UiContextSync } from "@/components/layout/UiContextSync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { state, loading, refresh } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <FuturisticBackground />
        <div className="animate-pulse text-ink-muted">Loading...</div>
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

  return (
    <div className="flex min-h-screen relative">
      <UiContextSync />
      <FuturisticBackground />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1 overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 lg:py-6">
            {children}
          </div>
        </main>
      </div>
      <RealtimeVoiceButton />
    </div>
  );
}
