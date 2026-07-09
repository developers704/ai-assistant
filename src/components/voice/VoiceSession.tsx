"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store/app-context";
import { useRealtimeVoice } from "@/lib/voice/useRealtimeVoice";
import { PlasmaOrb } from "@/components/ui/PlasmaOrb";
import { cn, getDisplayFirstName } from "@/lib/utils";
import { PhoneOff } from "lucide-react";

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

  const orbLevel = Math.max(audioLevel, isSpeaking ? 0.45 : 0, isBusy ? 0.2 : 0);
  const hasTranscript = Boolean(userTranscript || assistantTranscript);

  return (
    <div className="flex flex-col items-center justify-between min-h-full px-4 sm:px-6 py-10 sm:py-14 safe-area-bottom">
      <div className="flex-shrink-0 text-center w-full max-w-xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Hi {firstName}, what&apos;s on your mind?
        </h1>
        <p className="mt-2 text-sm text-ink-muted">Speak naturally — Alexa is listening</p>
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-[320px] w-full my-6">
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
          audioLevel={orbLevel}
          className={cn(
            "relative h-56 w-56 sm:h-72 sm:w-72 transition-transform duration-200",
            isSpeaking && "scale-110",
            isLive && audioLevel > 0.08 && "scale-105"
          )}
        />
      </div>

      <div className="w-full max-w-2xl flex-shrink-0 flex flex-col items-center gap-5 pb-4">
        {/* Jewelry-image-style gradient shell */}
        <div
          className={cn(
            "relative w-full rounded-[1.75rem] p-[1.5px] transition-all duration-500",
            isLive || isSpeaking || hasTranscript
              ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_60px_rgba(168,85,247,0.35),0_20px_50px_rgba(15,23,42,0.5)]"
              : "bg-gradient-to-r from-violet-500/50 via-fuchsia-500/40 to-cyan-400/30 shadow-[0_12px_48px_rgba(139,92,246,0.2)]"
          )}
        >
          <div className="relative overflow-hidden rounded-[1.65rem] bg-[#121a28]/95 backdrop-blur-2xl min-h-[140px]">
            <div className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.12),transparent)]" />

            <div className="relative px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4">
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

              {!hasTranscript && !error && (
                <p className="text-base text-ink-muted text-left min-h-[3rem]">
                  {isBusy
                    ? "Thinking…"
                    : isSpeaking
                      ? "Alexa is speaking…"
                      : "Listening for your voice…"}
                </p>
              )}

              {hasTranscript && (
                <div className="space-y-3 max-h-52 overflow-y-auto text-left border-t border-white/8 pt-3 mt-1">
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

            <div className="relative flex items-center justify-end gap-3 px-4 sm:px-5 pb-4 pt-2 border-t border-white/8">
              <button
                type="button"
                onClick={handleEnd}
                className="shrink-0 px-4 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-100 ring-1 ring-white/15 hover:ring-rose-400/40 transition-all flex items-center gap-1.5"
              >
                <PhoneOff size={14} />
                End Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
