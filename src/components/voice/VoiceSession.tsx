"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store/app-context";
import { useRealtimeVoice } from "@/lib/voice/useRealtimeVoice";
import { PlasmaOrb } from "@/components/ui/PlasmaOrb";
import { cn, getDisplayFirstName } from "@/lib/utils";
import { Mic, Loader2, PhoneOff, AudioLines } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  idle: "Starting…",
  connecting: "Connecting…",
  ready: "Listening",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
  error: "Something went wrong",
};

export function VoiceSession() {
  const router = useRouter();
  const { state } = useApp();
  const voiceEnabled = state?.user?.preferences?.voiceEnabled ?? true;
  const firstName = getDisplayFirstName(state?.user?.name) || "there";
  const startedRef = useRef(false);

  const {
    status,
    sessionActive,
    error,
    supported,
    userTranscript,
    assistantTranscript,
    audioLevel,
    startSession,
    closePanel,
  } = useRealtimeVoice(voiceEnabled);

  useEffect(() => {
    if (!supported || !voiceEnabled || startedRef.current) return;
    startedRef.current = true;
    void startSession();
  }, [supported, voiceEnabled, startSession]);

  const handleEnd = () => {
    closePanel();
    router.push("/chat");
  };

  if (!supported) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-ink-secondary">Voice is not supported in this browser.</p>
        <button
          type="button"
          onClick={() => router.push("/chat")}
          className="px-6 py-2.5 rounded-full bg-white/10 text-white text-sm ring-1 ring-white/20"
        >
          Back to Chat
        </button>
      </div>
    );
  }

  if (!voiceEnabled) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-ink-secondary">Voice is disabled in Settings.</p>
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="px-6 py-2.5 rounded-full bg-white/10 text-white text-sm ring-1 ring-white/20"
        >
          Open Settings
        </button>
      </div>
    );
  }

  const isLive = sessionActive && (status === "listening" || status === "ready");
  const isBusy = status === "connecting" || status === "thinking";
  const isSpeaking = status === "speaking";
  const statusLabel = STATUS_LABELS[status] ?? "Voice";
  const statusTone = isLive
    ? "text-emerald-300"
    : isSpeaking
      ? "text-cyan-300"
      : isBusy
        ? "text-violet-300"
        : status === "error"
          ? "text-rose-300"
          : "text-ink-muted";

  // Boost orb motion while Alexa speaks too
  const orbLevel = Math.max(audioLevel, isSpeaking ? 0.45 : 0, isBusy ? 0.2 : 0);

  return (
    <div className="flex flex-col items-center justify-between min-h-full px-4 sm:px-6 py-10 sm:py-14 safe-area-bottom">
      <div className="flex-shrink-0 text-center w-full max-w-xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Hi {firstName}, what&apos;s on your mind?
        </h1>
        <p className="mt-2 text-sm text-ink-muted">Speak naturally — Alexa is listening</p>
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-[280px] w-full my-6">
        {isLive && (
          <>
            <span
              className="voice-ring"
              style={{ width: "200%", height: "200%", left: "-50%", top: "-50%" }}
            />
            <span
              className="voice-ring"
              style={{
                width: "250%",
                height: "250%",
                left: "-75%",
                top: "-75%",
                animationDelay: "0.7s",
              }}
            />
          </>
        )}
        <PlasmaOrb
          variant="particles"
          density="high"
          audioLevel={orbLevel}
          className={cn(
            "relative h-48 w-48 sm:h-64 sm:w-64 transition-transform duration-200",
            isSpeaking && "scale-110",
            isLive && audioLevel > 0.08 && "scale-105"
          )}
        >
          <div className="relative z-10 drop-shadow-[0_0_12px_rgba(0,0,0,0.45)]">
            {isBusy ? (
              <Loader2 size={48} className="animate-spin text-white/85" />
            ) : isSpeaking ? (
              <AudioLines size={56} className="text-white/90 animate-pulse" />
            ) : (
              <Mic size={48} className="text-white/85" />
            )}
          </div>
        </PlasmaOrb>
      </div>

      <div className="w-full max-w-2xl flex-shrink-0 flex flex-col items-center gap-5 pb-4">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 shadow-2xl min-h-[140px]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className={cn("text-sm font-semibold flex items-center gap-2", statusTone)}>
              {isLive && (
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
              )}
              {statusLabel}
            </p>
            {isSpeaking && (
              <span className="voice-eq" aria-hidden>
                <span />
                <span />
                <span />
                <span />
                <span />
              </span>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-300 bg-rose-500/10 ring-1 ring-rose-400/25 rounded-xl px-4 py-3 mb-3 text-left">
              {error}
            </p>
          )}

          {isLive && !userTranscript && !assistantTranscript && !error && (
            <p className="text-base text-ink-secondary text-left">
              Listening for your voice…
            </p>
          )}

          {(userTranscript || assistantTranscript) && (
            <div className="space-y-3 max-h-52 overflow-y-auto text-left">
              {userTranscript && (
                <div className="flex justify-end">
                  <div className="chat-bubble-user max-w-[90%] rounded-2xl rounded-br-md px-4 py-3">
                    <p className="text-sm text-white leading-relaxed">{userTranscript}</p>
                  </div>
                </div>
              )}
              {assistantTranscript && (
                <div className="flex justify-start">
                  <div className="chat-bubble-ai max-w-[95%] rounded-2xl rounded-tl-md px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-violet-300/80 mb-1">
                      Alexa
                    </p>
                    <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                      {assistantTranscript}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleEnd}
          className="px-8 py-3.5 text-sm font-semibold rounded-full bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-100 ring-1 ring-white/20 hover:ring-rose-400/40 transition-all flex items-center justify-center gap-2"
        >
          <PhoneOff size={16} />
          End Session
        </button>
      </div>
    </div>
  );
}
