"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store/app-context";
import { useVoice } from "@/components/voice/VoiceProvider";
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
    voiceEnabled,
    startSession,
    closePanel,
  } = useVoice();

  useEffect(() => {
    if (!supported || !voiceEnabled || startedRef.current || sessionActive) return;
    startedRef.current = true;
    void startSession();
  }, [supported, voiceEnabled, sessionActive, startSession]);

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

  const orbLevel = Math.max(audioLevel, isSpeaking ? 0.5 : 0, isBusy ? 0.22 : 0);
  const hasTranscript = Boolean(userTranscript || assistantTranscript);

  return (
    <div className="voice-stage relative flex flex-col items-center justify-between min-h-full px-4 sm:px-6 py-10 sm:py-14 safe-area-bottom overflow-hidden">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 voice-stage-glow" aria-hidden />
      <div className="pointer-events-none absolute inset-0 voice-stage-vignette" aria-hidden />

      <div className="relative flex-shrink-0 text-center w-full max-w-xl z-10">
        <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.28em] text-violet-300/60 mb-3">
          Voice
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white tracking-tight">
          Hi {firstName}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">What&apos;s on your mind?</p>
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-[300px] w-full my-4 z-10">
        <div
          className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 w-[70%] max-w-sm h-16 rounded-[100%] bg-violet-500/15 blur-2xl"
          aria-hidden
        />

        {isLive && (
          <>
            <span className="voice-ring voice-ring-violet" style={{ width: "175%", height: "175%", left: "-37.5%", top: "-37.5%" }} />
            <span
              className="voice-ring voice-ring-violet"
              style={{
                width: "220%",
                height: "220%",
                left: "-60%",
                top: "-60%",
                animationDelay: "0.75s",
              }}
            />
            <span
              className="voice-ring voice-ring-violet"
              style={{
                width: "265%",
                height: "265%",
                left: "-82.5%",
                top: "-82.5%",
                animationDelay: "1.5s",
              }}
            />
          </>
        )}

        <div
          className={cn(
            "relative transition-transform duration-300 ease-out",
            isSpeaking && "scale-[1.06]",
            isLive && audioLevel > 0.1 && "scale-[1.03]"
          )}
        >
          <PlasmaOrb
            density="high"
            audioLevel={orbLevel}
            className="lumen-orb-hero relative h-56 w-56 sm:h-72 sm:w-72"
          />
        </div>
      </div>

      <div className="relative w-full max-w-xl flex-shrink-0 flex flex-col items-center gap-4 pb-4 z-10">
        <div className="voice-panel w-full">
          <div className="relative overflow-hidden rounded-2xl min-h-[132px]">
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-40 w-64 rounded-full bg-violet-500/15 blur-3xl" />

            <div className="relative px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className={cn("text-sm font-medium flex items-center gap-2 tracking-wide", statusTone)}>
                  {isLive && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse" />
                  )}
                  {statusLabel}
                </p>
                {isSpeaking && (
                  <span className="voice-eq voice-eq-violet" aria-hidden>
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                )}
              </div>

              {error && (
                <div className="mb-3 text-left">
                  <p className="text-sm text-rose-300 bg-rose-500/10 ring-1 ring-rose-400/25 rounded-xl px-4 py-3">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => void startSession()}
                    className="mt-2 px-4 py-2 text-xs font-semibold rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-100 ring-1 ring-violet-400/30 transition-all"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!sessionActive && !error && status === "idle" && (
                <button
                  type="button"
                  onClick={() => void startSession()}
                  className="mb-3 px-5 py-2.5 text-sm font-semibold rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-100 ring-1 ring-violet-400/30 transition-all"
                >
                  Start voice session
                </button>
              )}

              {!hasTranscript && !error && (
                <p className="text-[15px] text-ink-muted text-left min-h-[2.75rem] leading-relaxed">
                  {isBusy
                    ? "Thinking…"
                    : isSpeaking
                      ? "Alexa is speaking…"
                      : "Listening for your voice…"}
                </p>
              )}

              {hasTranscript && (
                <div className="space-y-3 max-h-52 overflow-y-auto text-left border-t border-white/[0.06] pt-3 mt-1">
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
                        <p className="text-[10px] uppercase tracking-[0.16em] text-violet-300/70 mb-1.5">
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

            <div className="relative flex items-center justify-end gap-3 px-4 sm:px-5 pb-4 pt-2 border-t border-white/[0.06]">
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
