"use client";

import { useApp } from "@/lib/store/app-context";
import { useRealtimeVoice } from "@/lib/voice/useRealtimeVoice";
import { Mic, Loader2, PhoneOff, AudioLines, Mail, Calendar, BarChart3, ImageIcon, MessageSquare } from "lucide-react";
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/90 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="flex flex-col items-center max-w-2xl w-full px-6 text-center">
        
        {/* Dynamic Greeting */}
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 tracking-tight">
          Hi Kash, what's on your mind?
        </h2>

        {/* Large Central Orb */}
        <div className="relative mb-16">
          {isLive && (
            <>
              <span className="voice-ring" style={{ width: '200%', height: '200%', left: '-50%', top: '-50%' }} />
              <span className="voice-ring" style={{ width: '250%', height: '250%', left: '-75%', top: '-75%', animationDelay: '0.7s' }} />
            </>
          )}
          <div
            className={cn(
              "plasma-orb relative flex h-40 w-40 sm:h-56 sm:w-56 items-center justify-center rounded-full transition-transform duration-300",
              isSpeaking && "scale-110",
              isLive && !isSpeaking && !isBusy && "scale-105" // Vibrate/pulse when user speaks
            )}
            style={{
              boxShadow: isLive && !isSpeaking && !isBusy 
                ? '0 0 60px rgba(217, 70, 239, 0.6), inset 0 0 30px rgba(255, 255, 255, 0.5)' 
                : undefined,
              animation: isLive && !isSpeaking && !isBusy ? 'orb-breathe 0.5s ease-in-out infinite alternate' : undefined
            }}
          >
            <svg className="absolute w-0 h-0" aria-hidden="true">
              <defs>
                <filter id="electric-noise-voice">
                  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" result="noise" seed="3">
                    <animate attributeName="baseFrequency" values="0.06;0.08;0.06" dur="3s" repeatCount="indefinite" />
                  </feTurbulence>
                  <feColorMatrix type="matrix" values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 20 -8" in="noise" result="highContrast" />
                  <feComposite operator="in" in="SourceGraphic" in2="highContrast" result="composite" />
                </filter>
              </defs>
            </svg>
            <span className="plasma-lightning" style={{ filter: 'url(#electric-noise-voice)' }} />
            <span className="plasma-lightning-b" style={{ filter: 'url(#electric-noise-voice)' }} />
            <span className="plasma-core" />
            <span className="plasma-shine" />

            {/* Icon Overlay */}
            <div className="relative z-10">
              {isBusy ? (
                <Loader2 size={40} className="animate-spin text-white/80" />
              ) : isSpeaking ? (
                <AudioLines size={48} className="text-white/90 animate-pulse" />
              ) : (
                <Mic size={40} className="text-white/80" />
              )}
            </div>
          </div>

          {/* Floating Glassy Icons */}
          <div 
            className="absolute -top-4 -left-8 sm:-left-16 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-center text-violet-300/80" 
            style={{ animation: 'orb-float 12s ease-in-out infinite' }}
          >
            <Mail size={24} />
          </div>
          <div 
            className="absolute top-10 -right-6 sm:-right-12 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-center text-emerald-300/80" 
            style={{ animation: 'orb-float 15s ease-in-out infinite reverse', animationDelay: '-2s' }}
          >
            <BarChart3 size={20} />
          </div>
          <div 
            className="absolute -bottom-6 -left-4 sm:-left-8 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-center text-cyan-300/80" 
            style={{ animation: 'orb-float 14s ease-in-out infinite', animationDelay: '-5s' }}
          >
            <Calendar size={20} />
          </div>
          <div 
            className="absolute -bottom-2 -right-10 sm:-right-16 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-center text-pink-300/80" 
            style={{ animation: 'orb-float 13s ease-in-out infinite reverse', animationDelay: '-7s' }}
          >
            <ImageIcon size={24} />
          </div>
          <div 
            className="absolute -top-12 right-4 sm:right-10 w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-center text-indigo-300/80" 
            style={{ animation: 'orb-float 10s ease-in-out infinite', animationDelay: '-9s' }}
          >
            <MessageSquare size={16} />
          </div>
        </div>

        {/* Status & Transcripts */}
        <div className="w-full max-w-lg mx-auto bg-white/5 rounded-3xl p-6 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between gap-2 mb-4">
            <p className={cn("text-sm font-semibold flex items-center gap-2", statusTone)}>
              {isLive && (
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
              )}
              {statusLabel}
            </p>
            {isSpeaking && (
              <span className="voice-eq" aria-hidden>
                <span /><span /><span /><span /><span />
              </span>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-300 bg-rose-500/10 ring-1 ring-rose-400/25 rounded-xl px-4 py-3 mb-4 text-left">
              {error}
            </p>
          )}

          {isLive && !userTranscript && !isBusy && !isSpeaking && (
            <p className="text-sm text-ink-secondary text-left">
              Listening...
            </p>
          )}

          {(userTranscript || assistantTranscript) && (
            <div className="space-y-4 max-h-48 overflow-y-auto pr-2 text-left">
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
          onClick={closePanel}
          className="mt-8 px-8 py-3.5 text-sm font-semibold rounded-full bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-100 ring-1 ring-white/20 hover:ring-rose-400/40 transition-all flex items-center justify-center gap-2 backdrop-blur-md"
        >
          <PhoneOff size={16} />
          End Session
        </button>
      </div>
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
