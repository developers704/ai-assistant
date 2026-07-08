"use client";

import { useApp } from "@/lib/store/app-context";
import { useRealtimeVoice } from "@/lib/voice/useRealtimeVoice";
import { Mic, Loader2, PhoneOff, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  idle: "Start voice",
  connecting: "Connecting…",
  ready: "Listening",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
  error: "Tap to retry",
};

type RealtimeVoiceButtonProps = {
  /** floating = global FAB; inline = sits in chat composer row */
  variant?: "floating" | "inline" | "composer";
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
  const isInline = variant === "inline" || variant === "composer";
  const isComposer = variant === "composer";

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

  const voicePanel = panelOpen && (
    <div
      className={cn(
        "voice-card rounded-3xl p-4 sm:p-5 animate-in fade-in slide-in-from-bottom-3 duration-300 z-50",
        isInline
          ? // Mobile: fixed sheet centered above composer. Desktop: popover anchored to the mic's right edge.
            "fixed inset-x-3 bottom-24 mx-auto max-w-sm sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:mb-3 sm:w-80"
          : "w-[min(20rem,calc(100vw-2rem))]"
      )}
    >
      {/* Header: orb + status */}
      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0">
          {isLive && (
            <>
              <span className="voice-ring" />
              <span className="voice-ring" />
              <span className="voice-ring" />
            </>
          )}
          <div
            className={cn(
              "voice-orb relative flex h-12 w-12 items-center justify-center rounded-full",
              isSpeaking && "voice-orb-speaking"
            )}
          >
            {isBusy ? (
              <Loader2 size={19} className="animate-spin text-white" />
            ) : isSpeaking ? (
              <AudioLines size={19} className="text-white" />
            ) : (
              <Mic size={19} className="text-white" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Voice · Realtime
            </p>
            {isSpeaking && (
              <span className="voice-eq" aria-hidden>
                <span /><span /><span /><span /><span />
              </span>
            )}
          </div>
          <p className={cn("text-sm font-semibold mt-0.5 flex items-center gap-1.5", statusTone)}>
            {isLive && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
            )}
            {statusLabel}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-300 bg-rose-500/10 ring-1 ring-rose-400/25 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {isLive && !userTranscript && !isBusy && !isSpeaking && (
        <p className="mt-3 text-xs text-ink-secondary">
          Mic is on — speak naturally, ask follow-ups anytime.
        </p>
      )}

      {(userTranscript || assistantTranscript) && (
        <div className="mt-3 space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {userTranscript && (
            <div className="flex justify-end">
              <div className="chat-bubble-user max-w-[88%] rounded-2xl rounded-br-md px-3 py-2">
                <p className="text-xs text-white leading-relaxed">{userTranscript}</p>
              </div>
            </div>
          )}

          {assistantTranscript && (
            <div className="flex justify-start">
              <div className="chat-bubble-ai max-w-[92%] rounded-2xl rounded-tl-md px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-violet-300/80 mb-0.5">
                  Alexa
                </p>
                <p className="text-xs text-ink-secondary leading-relaxed line-clamp-6 whitespace-pre-wrap">
                  {assistantTranscript}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {isBusy && !userTranscript && (
        <p className="mt-3 text-xs text-ink-muted flex items-center gap-2">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </p>
      )}

      <button
        type="button"
        onClick={closePanel}
        className="mt-4 w-full py-2.5 text-xs font-semibold rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 hover:text-rose-100 ring-1 ring-rose-400/30 transition-colors flex items-center justify-center gap-1.5"
      >
        <PhoneOff size={13} />
        End voice chat
      </button>
    </div>
  );

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
      {voicePanel}

      <button
        type="button"
        onClick={handleMicClick}
        disabled={sessionActive && status !== "error"}
        aria-label={sessionActive ? "Voice session active" : "Start voice chat"}
        title={statusLabel}
        className={cn(
          isComposer ? "w-11 h-11 rounded-full" : isInline ? "w-11 h-11 rounded-full" : "w-12 h-12 rounded-2xl shadow-elevated",
          "flex items-center justify-center transition-all duration-300 shrink-0",
          isComposer
            ? cn(
                "voice-mic-btn text-violet-200 hover:text-white",
                sessionActive && status !== "error" && "voice-mic-btn-live text-rose-200"
              )
            : sessionActive && status !== "error"
              ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white scale-[1.02] shadow-glow-orange cursor-default animate-pulse"
              : isSpeaking
                ? "bg-gradient-to-r from-violet-600 to-indigo-700 text-white scale-[1.02] shadow-glow"
                : "btn-futuristic text-accent-neon hover:shadow-glow"
        )}
      >
        {isBusy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : sessionActive && isSpeaking ? (
          <AudioLines size={18} />
        ) : (
          <Mic size={18} />
        )}
      </button>
    </div>
  );
}
