"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useApp } from "@/lib/store/app-context";
import {
  useRealtimeVoice,
  type RealtimeVoiceStatus,
} from "@/lib/voice/useRealtimeVoice";

interface VoiceContextType {
  status: RealtimeVoiceStatus;
  sessionActive: boolean;
  error: string | null;
  supported: boolean;
  userTranscript: string;
  assistantTranscript: string;
  audioLevel: number;
  voiceEnabled: boolean;
  startSession: () => Promise<void>;
  closePanel: () => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

/**
 * Hosts the realtime voice session at the app-layout level so it SURVIVES
 * route changes. When Alexa navigates the boss to /sales or /email, the
 * mic + audio keep running and the spoken summary still plays.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const voiceEnabled = state?.user?.preferences?.voiceEnabled ?? true;
  const voice = useRealtimeVoice(voiceEnabled);

  return (
    <VoiceContext.Provider value={{ ...voice, voiceEnabled }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextType {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error("useVoice must be used within VoiceProvider");
  }
  return ctx;
}
