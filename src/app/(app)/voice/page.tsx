"use client";

import { VoiceSession } from "@/components/voice/VoiceSession";

export default function VoicePage() {
  return (
    <div className="fixed inset-0 z-[90] bg-[#020617] overflow-y-auto flex flex-col">
      <VoiceSession />
    </div>
  );
}
