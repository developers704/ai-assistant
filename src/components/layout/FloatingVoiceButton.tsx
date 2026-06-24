"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store/app-context";
import { useSpeech } from "@/lib/hooks/useSpeech";

/**
 * Global voice command button shown on every page (bottom-right).
 * Tap to speak; the command runs through the assistant and the reply is spoken back.
 */
export function FloatingVoiceButton() {
  const { sendChat } = useApp();
  const pathname = usePathname();
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [thinking, setThinking] = useState(false);

  const handleTranscript = async (text: string) => {
    if (!text) return;
    setTranscript(text);
    setReply("");
    setThinking(true);
    const message = await sendChat(text);
    setThinking(false);
    if (message?.content) {
      setReply(message.content);
      speak(message.content);
    }
  };

  const { listening, speaking, supported, toggleListening, speak } =
    useSpeech(handleTranscript);

  // The chat page has its own mic in the input box, so hide the floating one there.
  if (!supported || pathname === "/chat") return null;

  const panelOpen = listening || thinking || !!transcript;

  return (
    <div className="fixed right-4 bottom-6 z-30 flex flex-col items-end gap-3" style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}>
      {panelOpen && (
        <div className="max-w-xs w-72 glass-panel-strong shadow-elevated rounded-3xl p-4 animate-in fade-in slide-in-from-bottom-2">
          {listening && (
            <p className="text-sm text-ink-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-rose animate-pulse" />
              Listening...
            </p>
          )}
          {transcript && (
            <div className="mt-1">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">You said</p>
              <p className="text-sm text-ink font-medium">{transcript}</p>
            </div>
          )}
          {thinking && (
            <p className="mt-3 text-sm text-ink-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </p>
          )}
          {reply && (
            <div className="mt-3 pt-3 border-t border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted flex items-center gap-1">
                <Volume2 size={11} /> Assistant {speaking && "(speaking)"}
              </p>
              <p className="text-sm text-ink-secondary mt-0.5 line-clamp-6 whitespace-pre-wrap">
                {reply}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={toggleListening}
        aria-label={listening ? "Stop voice command" : "Start voice command"}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-elevated transition-all duration-300",
          listening
            ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white scale-110 animate-pulse shadow-glow-orange"
            : "btn-futuristic text-accent-neon hover:scale-105 hover:shadow-glow"
        )}
      >
        {listening ? <Icon icon={MicOff} size="2xl" active /> : <Icon icon={Mic} size="2xl" active />}
      </button>
    </div>
  );
}
