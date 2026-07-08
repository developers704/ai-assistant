"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { ChatBubble, PendingActionCard } from "@/components/ui/ChatBubble";
import { RealtimeVoiceButton } from "@/components/voice/RealtimeVoiceButton";
import { ChatWelcome } from "@/components/chat/ChatWelcome";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ArrowDown, MessageSquarePlus } from "lucide-react";
import { PlasmaOrb } from "@/components/ui/PlasmaOrb";

export default function ChatPage() {
  const { state, sendChat, clearChat, confirmAction, rejectAction, updatePendingDraft } = useApp();
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = state?.chatHistory ?? [];
  const showWelcome = messages.length === 0 && !pendingText;
  const pendingEmail = state?.pendingActions.find((a) => a.type === "email");
  const messageShowsPending = messages.some((m) => m.pendingAction?.type === "email");
  const showOrphanPending = pendingEmail && !messageShowsPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, pendingText]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distanceFromBottom > 320);
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
        <div className="flex items-center gap-2 text-ink-muted text-sm">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px))] lg:h-[calc(100dvh-4rem)] max-lg:-mx-0.5">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl sm:rounded-3xl ring-1 ring-white/10 glass-panel-strong relative">
        {/* Ambient aurora wash */}
        <div className="chat-aurora pointer-events-none absolute inset-0" aria-hidden />

        {/* Desktop header only — mobile uses top nav "Alexa / AI Chat" */}
        <header className="relative shrink-0 hidden sm:block px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-white/8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <PlasmaOrb className="hidden sm:block h-9 w-9 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl font-display font-bold text-gradient-title tracking-tight">
                  AI Chat
                </h1>
                <p className="text-sm text-white/40 mt-0.5 flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  Alexa is online — ask anything
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => void clearChat()}
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white/5 ring-1 ring-white/10 text-ink-secondary hover:text-ink hover:bg-white/10 hover:ring-violet-400/25 transition-all disabled:opacity-50"
                  title="New conversation"
                >
                  <MessageSquarePlus size={14} />
                  New
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Mobile: new chat only */}
        {messages.length > 0 && (
          <div className="sm:hidden shrink-0 flex justify-end px-4 pt-2 relative">
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

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto overscroll-y-contain px-4 sm:px-6 py-3 sm:py-5 pb-2 scroll-smooth"
        >
          {showWelcome && (
            <ChatWelcome state={state} disabled={sending} onSuggestion={handleSend} />
          )}

          {messages.length > 0 && (
            <div className="space-y-4 sm:space-y-5 max-w-3xl mx-auto w-full">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={{
                    ...msg,
                    pendingAction:
                      msg.pendingAction?.type === "email" && pendingEmail
                        ? pendingEmail
                        : msg.pendingAction,
                  }}
                  onConfirm={confirmAction}
                  onReject={rejectAction}
                  onEdit={updatePendingDraft}
                />
              ))}
            </div>
          )}

          {pendingText && (
            <div className="space-y-4 sm:space-y-5 max-w-3xl mx-auto w-full mt-4">
              <ChatBubble
                message={{
                  id: "pending-user",
                  role: "user",
                  content: pendingText,
                  timestamp: new Date().toISOString(),
                }}
              />
              <div className="msg-enter flex gap-2.5 sm:gap-3">
                <PlasmaOrb className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 mt-0.5" />
                <div className="chat-bubble-ai px-4 py-3 rounded-3xl rounded-tl-lg flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                  <span className="text-shimmer text-sm font-medium">Thinking…</span>
                </div>
              </div>
            </div>
          )}

          {showOrphanPending && pendingEmail && (
            <div className="max-w-3xl mx-auto w-full mb-4">
              <PendingActionCard
                action={pendingEmail}
                onConfirm={confirmAction}
                onReject={rejectAction}
                onEdit={updatePendingDraft}
              />
            </div>
          )}

          <div ref={bottomRef} className="h-2" />
        </div>

        {/* Scroll-to-bottom pill */}
        {showScrollDown && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest"
            className="chat-scroll-pill msg-enter absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-ink-secondary hover:text-ink transition-colors"
          >
            <ArrowDown size={13} />
            Latest
          </button>
        )}

        <div className="shrink-0 border-t border-white/8 bg-gradient-to-t from-[#1a2230]/95 to-transparent backdrop-blur-xl relative">
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
