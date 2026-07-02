"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { WeatherWidget } from "@/components/ui/WeatherWidget";
import { RealtimeVoiceButton } from "@/components/voice/RealtimeVoiceButton";
import { ChatWelcome } from "@/components/chat/ChatWelcome";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { Bot, Loader2, MessageSquarePlus } from "lucide-react";

export default function ChatPage() {
  const { state, sendChat, clearChat, confirmAction, rejectAction } = useApp();
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = state?.chatHistory ?? [];
  const showWelcome = messages.length === 0 && !pendingText;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, pendingText]);

  const handleSend = async (text: string) => {
    if (sending || !text.trim()) return;
    setSending(true);
    setPendingText(text.trim());
    try {
      await sendChat(text.trim());
    } finally {
      setPendingText(null);
      setSending(false);
    }
  };

  if (!state) {
    return (
      <div className="flex flex-col h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px))] lg:h-[calc(100dvh-4rem)] items-center justify-center">
        <div className="animate-pulse text-ink-muted text-sm">Loading chat…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px))] lg:h-[calc(100dvh-4rem)] max-lg:-mx-0.5">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl sm:rounded-3xl ring-1 ring-white/10 glass-panel-strong relative">
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[min(100%,480px)] h-40 sm:h-48 bg-gradient-to-b from-violet-500/12 to-transparent"
          aria-hidden
        />

        {/* Desktop header only — mobile uses top nav "Alexa / AI Chat" */}
        <header className="relative shrink-0 hidden sm:block px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-white/8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-display font-semibold text-ink tracking-tight">
                AI Chat
              </h1>
              <p className="text-sm text-ink-muted mt-0.5">
                Your executive assistant — ask anything
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => void clearChat()}
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white/5 ring-1 ring-white/10 text-ink-secondary hover:text-ink hover:bg-white/10 disabled:opacity-50"
                  title="New conversation"
                >
                  <MessageSquarePlus size={14} />
                  New
                </button>
              )}
              <WeatherWidget />
            </div>
          </div>
        </header>

        {/* Mobile: new chat only */}
        {messages.length > 0 && (
          <div className="sm:hidden shrink-0 flex justify-end px-4 pt-2">
            <button
              type="button"
              onClick={() => void clearChat()}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white/5 ring-1 ring-white/10 text-ink-secondary"
            >
              <MessageSquarePlus size={14} />
              New chat
            </button>
          </div>
        )}

        <div className="relative flex-1 overflow-y-auto overscroll-y-contain px-4 sm:px-6 py-3 sm:py-5 pb-2">
          {showWelcome && (
            <>
              <div className="sm:hidden mb-4 max-w-3xl mx-auto w-full">
                <WeatherWidget variant="banner" className="w-full" />
              </div>
              <ChatWelcome state={state} disabled={sending} onSuggestion={handleSend} />
            </>
          )}

          {messages.length > 0 && (
            <div className="space-y-4 max-w-3xl mx-auto w-full">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onConfirm={confirmAction}
                  onReject={rejectAction}
                />
              ))}
            </div>
          )}

          {pendingText && (
            <div className="space-y-4 max-w-3xl mx-auto w-full mt-4">
              <ChatBubble
                message={{
                  id: "pending-user",
                  role: "user",
                  content: pendingText,
                  timestamp: new Date().toISOString(),
                }}
              />
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-700 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.35)]">
                  <Bot size={17} className="text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl glass-panel text-sm text-ink-muted flex items-center gap-2 ring-1 ring-violet-400/15">
                  <Loader2 size={16} className="animate-spin text-violet-300" />
                  Thinking…
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-2" />
        </div>

        <div className="shrink-0 border-t border-white/8 bg-gradient-to-t from-[#1a2230]/95 to-transparent backdrop-blur-xl">
          <ChatComposer
            onSend={handleSend}
            disabled={sending}
            voiceControl={<RealtimeVoiceButton variant="composer" />}
          />
        </div>
      </div>
    </div>
  );
}
