"use client";

import { useApp } from "@/lib/store/app-context";
import { useRealtimeVoice } from "@/lib/voice/useRealtimeVoice";
import { Icon } from "@/components/ui/Icon";
import { Mic, Loader2, Volume2, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  idle: "Start voice",
  connecting: "Connecting…",
  ready: "Listening…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Tap to retry",
};

type RealtimeVoiceButtonProps = {
  /** floating = global FAB; inline = sits in chat composer row */
  variant?: "floating" | "inline";
  className?: string;
};

export function RealtimeVoiceButton({
  variant = "floating",
  className,
}: RealtimeVoiceButtonProps) {
  const { state } = useApp();
  const voiceEnabled = state?.user?.preferences?.voiceEnabled ?? true;

  const {
    status,
    sessionActive,
    error,
    supported,
    userTranscript,
    assistantTranscript,
    startSession,
    closePanel,
  } = useRealtimeVoice(voiceEnabled);

  if (!supported || !voiceEnabled) return null;

  const panelOpen = sessionActive || status === "error";
  const isInline = variant === "inline";

  const handleMicClick = () => {
    if (status === "error") {
      closePanel();
      void startSession();
      return;
    }
    if (!sessionActive && status === "idle") {
      void startSession();
    }
  };

  const isLive = sessionActive && (status === "listening" || status === "ready");
  const isBusy = status === "connecting" || status === "thinking";
  const isSpeaking = status === "speaking";

  const micSize = isInline ? "w-11 h-11" : "w-12 h-12";

  return (
    <div
      className={cn(
        isInline
          ? "relative shrink-0 flex flex-col items-start"
          : "fixed right-4 bottom-5 z-30 flex flex-col items-end gap-2 safe-area-bottom",
        className
      )}
      style={isInline ? undefined : { paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      {panelOpen && (
        <div
          className={cn(
            "glass-panel-strong shadow-elevated rounded-2xl p-3.5 animate-in fade-in slide-in-from-bottom-2 z-50",
            isInline
              ? "absolute bottom-full left-0 mb-2 w-[min(18rem,calc(100vw-2rem))]"
              : "max-w-xs w-64"
          )}
        >
          <div className="mb-2">
            <p className="text-[10px] uppercase tracking-wide text-ink-muted">Voice · Realtime</p>
            <p className="text-[10px] text-ink-muted mt-0.5">
              Speak naturally — ask follow-ups anytime. Press Exit when done.
            </p>
          </div>

          {error && <p className="text-xs text-rose-300 mb-2">{error}</p>}

          {isLive && !userTranscript && !isBusy && !isSpeaking && (
            <p className="text-xs text-emerald-300/90 mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Mic is on — go ahead and speak
            </p>
          )}

          {userTranscript && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-muted">You</p>
              <p className="text-xs text-ink font-medium">{userTranscript}</p>
            </div>
          )}

          {isBusy && (
            <p className="text-xs text-ink-muted flex items-center gap-2">
              <Loader2 size={13} className="animate-spin" />
              {STATUS_LABELS[status]}
            </p>
          )}

          {assistantTranscript && (
            <div className="mt-2 pt-2 border-t border-white/15">
              <p className="text-[10px] uppercase tracking-wide text-ink-muted flex items-center gap-1">
                <Volume2 size={10} /> Alexa {isSpeaking && "(speaking)"}
              </p>
              <p className="text-xs text-ink-secondary mt-0.5 line-clamp-6 whitespace-pre-wrap">
                {assistantTranscript}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={closePanel}
            className="mt-3 w-full py-2 text-xs font-medium rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-rose-100 ring-1 ring-rose-400/30 transition-colors flex items-center justify-center gap-1.5"
          >
            <PhoneOff size={13} />
            Exit voice chat
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleMicClick}
        disabled={sessionActive && status !== "error"}
        aria-label={sessionActive ? "Voice session active" : "Start voice chat"}
        title={STATUS_LABELS[status] ?? "Start voice"}
        className={cn(
          micSize,
          "rounded-2xl flex items-center justify-center shadow-elevated transition-all duration-300 shrink-0",
          sessionActive && status !== "error"
            ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white scale-[1.02] shadow-glow-orange cursor-default"
            : isSpeaking
              ? "bg-gradient-to-r from-violet-600 to-indigo-700 text-white scale-[1.02] shadow-glow"
              : "btn-futuristic text-accent-neon hover:shadow-glow",
          sessionActive && status !== "error" && "animate-pulse"
        )}
      >
        {isBusy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Icon icon={Mic} size="md" active={sessionActive || status === "idle"} />
        )}
      </button>
    </div>
  );
}
