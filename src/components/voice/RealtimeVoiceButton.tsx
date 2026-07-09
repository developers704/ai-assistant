"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store/app-context";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

type RealtimeVoiceButtonProps = {
  /** floating = global FAB; inline = sits in chat composer row */
  variant?: "floating" | "inline" | "composer";
  className?: string;
};

export function RealtimeVoiceButton({
  variant = "floating",
  className,
}: RealtimeVoiceButtonProps) {
  const router = useRouter();
  const { state } = useApp();
  const voiceEnabled = state?.user?.preferences?.voiceEnabled ?? true;

  if (!voiceEnabled) return null;

  const isInline = variant === "inline" || variant === "composer";
  const isComposer = variant === "composer";

  const openVoice = () => {
    router.push("/voice");
  };

  return (
    <div
      className={cn(
        isInline
          ? "relative shrink-0"
          : "fixed right-4 bottom-5 z-30 flex flex-col items-end gap-2 safe-area-bottom",
        className
      )}
      style={isInline ? undefined : { paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <button
        type="button"
        onClick={openVoice}
        aria-label="Open voice assistant"
        title="Voice"
        className={cn(
          isComposer
            ? "w-11 h-11 rounded-full"
            : isInline
              ? "w-11 h-11 rounded-full"
              : "w-12 h-12 rounded-2xl shadow-elevated",
          "flex items-center justify-center transition-all duration-300 shrink-0",
          isComposer
            ? "voice-mic-btn text-violet-200 hover:text-white"
            : "btn-futuristic text-accent-neon hover:shadow-glow"
        )}
      >
        <Mic size={18} />
      </button>
    </div>
  );
}
