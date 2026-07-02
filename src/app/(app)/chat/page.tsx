"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { ChatBubble, ChatInput } from "@/components/ui/ChatBubble";
import { WeatherWidget } from "@/components/ui/WeatherWidget";
import { RealtimeVoiceButton } from "@/components/voice/RealtimeVoiceButton";
import { Bot, Loader2, Sparkles, MessageSquarePlus } from "lucide-react";

const suggestions = [
  { text: "What do I need to focus on today?", color: "hover:ring-violet-400/40" },
  { text: "Show me today's sales across all stores", color: "hover:ring-emerald-400/40" },
  { text: "Summarize my important emails", color: "hover:ring-blue-400/40" },
  { text: "What's on my calendar today?", color: "hover:ring-rose-400/40" },
  { text: "Draft an email to the diamond supplier", color: "hover:ring-amber-400/40" },
  { text: "Remind me to review Baybrook Mall lease tomorrow", color: "hover:ring-teal-400/40" },
];

export default function ChatPage() {
  const { state, sendChat, clearChat, confirmAction, rejectAction } = useApp();
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = state?.chatHistory || [];

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

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px))] lg:h-[calc(100dvh-4rem)] max-lg:-mx-0.5">
      <div className="glass-panel-strong rounded-2xl sm:rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10">
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-0 border-b border-white/10 shrink-0">
          <PageHeader
            title="AI Chat"
            subtitle="Your executive assistant — ask anything"
            compact
            action={
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void clearChat()}
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl glass-panel ring-1 ring-white/10 text-ink-secondary hover:text-ink hover:bg-white/10 disabled:opacity-50"
                    title="Start a new conversation"
                  >
                    <MessageSquarePlus size={14} />
                    New chat
                  </button>
                )}
                <WeatherWidget className="max-lg:py-1.5 max-lg:px-2.5" />
              </div>
            }
          />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          {messages.length === 0 && !pendingText && (
            <div className="flex flex-col items-center justify-center text-center py-6 sm:py-14 max-w-xl mx-auto">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-violet-600/80 to-indigo-800 flex items-center justify-center mb-4 sm:mb-5 shadow-glow ring-1 ring-violet-400/30">
                <Sparkles size={24} className="text-amber-300 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-ink mb-2">How can I help you today?</h3>
              <p className="text-ink-secondary text-sm mb-6 sm:mb-8 leading-relaxed px-2">
                Emails, calendar, tasks, sales, documents, and more — just ask.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full">
                {suggestions.map(({ text, color }) => (
                  <button
                    key={text}
                    disabled={sending}
                    onClick={() => handleSend(text)}
                    className={`px-4 py-3.5 text-left text-sm glass-panel rounded-2xl transition-all ring-1 ring-white/10 hover:bg-white/12 active:scale-[0.99] ${color} disabled:opacity-50 disabled:cursor-not-allowed text-ink-secondary hover:text-ink`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} onConfirm={confirmAction} onReject={rejectAction} />
          ))}

          {pendingText && (
            <>
              <ChatBubble
                message={{
                  id: "pending-user",
                  role: "user",
                  content: pendingText,
                  timestamp: new Date().toISOString(),
                }}
              />
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center flex-shrink-0 shadow-glow">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl glass-panel text-sm text-ink-muted flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-violet-300" />
                  Thinking…
                </div>
              </div>
            </>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/10 shrink-0 bg-black/25 backdrop-blur-xl">
          <ChatInput
            onSend={handleSend}
            disabled={sending}
            voiceControl={<RealtimeVoiceButton variant="inline" />}
          />
        </div>
      </div>
    </div>
  );
}
