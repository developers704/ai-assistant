"use client";

import { useApp } from "@/lib/store/app-context";
import { useRealtimeVoice } from "@/lib/voice/useRealtimeVoice";
import { Icon } from "@/components/ui/Icon";
import { Mic, MicOff, Loader2, Volume2, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  idle: "Hold to talk",
  connecting: "Connecting…",
  ready: "Hold to talk",
  listening: "Keep holding…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Tap to retry",
};

export function RealtimeVoiceButton() {
  const { state } = useApp();
  const voiceEnabled = state?.user?.preferences?.voiceEnabled ?? true;

  const {
    status,
    error,
    supported,
    userTranscript,
    assistantTranscript,
    startListening,
    stopListening,
    disconnect,
    connect,
  } = useRealtimeVoice(voiceEnabled);

  if (!supported || !voiceEnabled) return null;

  const panelOpen =
    status !== "idle" || !!userTranscript || !!assistantTranscript || !!error;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    void startListening();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    stopListening();
  };

  const handleRetry = () => {
    disconnect();
    void connect();
  };

  const isActive = status === "listening";
  const isBusy = status === "connecting" || status === "thinking";
  const isSpeaking = status === "speaking";

  return (
    <div
      className="fixed right-4 bottom-6 z-30 flex flex-col items-end gap-3"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      {panelOpen && (
        <div className="max-w-xs w-72 glass-panel-strong shadow-elevated rounded-3xl p-4 animate-in fade-in slide-in-from-bottom-2">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted mb-2">
            Voice · Realtime
          </p>
          <p className="text-[10px] text-ink-muted mb-2">
            Press &amp; hold, speak, then release (at least 1 second).
          </p>

          {error && (
            <p className="text-sm text-rose-300 mb-2">{error}</p>
          )}

          {userTranscript && (
            <div className="mb-2">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">You</p>
              <p className="text-sm text-ink font-medium">{userTranscript}</p>
            </div>
          )}

          {isBusy && (
            <p className="text-sm text-ink-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {STATUS_LABELS[status]}
            </p>
          )}

          {assistantTranscript && (
            <div className="mt-2 pt-2 border-t border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted flex items-center gap-1">
                <Volume2 size={11} /> Alexa {isSpeaking && "(speaking)"}
              </p>
              <p className="text-sm text-ink-secondary mt-0.5 line-clamp-6 whitespace-pre-wrap">
                {assistantTranscript}
              </p>
            </div>
          )}

          {status !== "idle" && status !== "connecting" && (
            <button
              type="button"
              onClick={disconnect}
              className="mt-3 text-xs text-ink-muted hover:text-ink flex items-center gap-1"
            >
              <PhoneOff size={12} /> End session
            </button>
          )}

          {status === "error" && (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 text-xs text-accent-neon hover:underline"
            >
              Retry connection
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onPointerDown={status === "error" ? undefined : handlePointerDown}
        onPointerUp={status === "error" ? undefined : handlePointerUp}
        onPointerLeave={status === "error" ? undefined : handlePointerUp}
        onClick={status === "error" ? handleRetry : undefined}
        aria-label={isActive ? "Release to send" : "Hold to talk"}
        className={cn(
          "w-16 h-16 rounded-full flex flex-col items-center justify-center shadow-elevated transition-all duration-300 select-none touch-none",
          isActive
            ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white scale-110 animate-pulse shadow-glow-orange"
            : isSpeaking
              ? "bg-gradient-to-r from-violet-600 to-indigo-700 text-white scale-105 shadow-glow"
              : "btn-futuristic text-accent-neon hover:scale-105 hover:shadow-glow"
        )}
      >
        {isActive ? (
          <Icon icon={MicOff} size="xl" active />
        ) : isBusy ? (
          <Loader2 size={24} className="animate-spin" />
        ) : (
          <Icon icon={Mic} size="xl" active />
        )}
        <span className="text-[9px] mt-0.5 font-medium opacity-80">
          {STATUS_LABELS[status] ?? "Hold"}
        </span>
      </button>
    </div>
  );
}
