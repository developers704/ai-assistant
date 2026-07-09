"use client";

import { useRouter, usePathname } from "next/navigation";
import { useVoice } from "@/components/voice/VoiceProvider";
import { PlasmaOrb } from "@/components/ui/PlasmaOrb";
import { cn } from "@/lib/utils";
import { PhoneOff, Maximize2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  connecting: "Connecting…",
  ready: "Listening",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
};

/**
 * Floating voice pill shown on every page (except /voice) while a voice
 * session is live. Lets the boss keep talking after Alexa navigates —
 * e.g. "show today sales" → sales page opens, summary plays, and the
 * mic stays hot for follow-ups like "which store was best?".
 */
export function VoiceMiniHud() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, sessionActive, assistantTranscript, audioLevel, closePanel } =
    useVoice();

  if (!sessionActive || pathname === "/voice") return null;

  const isSpeaking = status === "speaking";
  const isLive = status === "listening" || status === "ready";
  const label = STATUS_LABELS[status] ?? "Voice";
  const snippet =
    isSpeaking && assistantTranscript
      ? assistantTranscript.slice(-90)
      : null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] w-[min(480px,calc(100vw-1.5rem))] safe-area-bottom"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <div className="rounded-[1.5rem] p-[1.5px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_8px_40px_rgba(168,85,247,0.4)]">
        <div className="flex items-center gap-3 rounded-[1.4rem] bg-[#0b1120]/95 backdrop-blur-2xl px-3 py-2.5">
          <button
            type="button"
            onClick={() => router.push("/voice")}
            aria-label="Open voice screen"
            className="shrink-0"
          >
            <PlasmaOrb
              audioLevel={Math.max(audioLevel, isSpeaking ? 0.45 : 0)}
              className={cn(
                "h-10 w-10 transition-transform",
                isSpeaking && "scale-110"
              )}
            />
          </button>

          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-xs font-semibold flex items-center gap-1.5",
                isLive
                  ? "text-emerald-300"
                  : isSpeaking
                    ? "text-cyan-300"
                    : "text-violet-300"
              )}
            >
              {isLive && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {label}
            </p>
            {snippet ? (
              <p className="text-[11px] text-ink-secondary truncate mt-0.5">
                {snippet}
              </p>
            ) : (
              <p className="text-[11px] text-ink-muted truncate mt-0.5">
                Keep talking — Alexa is with you
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push("/voice")}
            aria-label="Expand voice"
            title="Open voice screen"
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-ink-secondary hover:text-white hover:bg-white/15 ring-1 ring-white/10 transition-all"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={closePanel}
            aria-label="End voice session"
            title="End session"
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-ink-secondary hover:text-rose-200 hover:bg-rose-500/20 ring-1 ring-white/10 hover:ring-rose-400/40 transition-all"
          >
            <PhoneOff size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
