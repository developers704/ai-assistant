"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { ChatBubble, ChatInput } from "@/components/ui/ChatBubble";
import { WeatherWidget } from "@/components/ui/WeatherWidget";
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
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-4rem)]">
      <div className="glass-panel-strong rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10">
        <div className="px-5 sm:px-6 pt-5 pb-0 border-b border-white/10 shrink-0">
          <PageHeader
            title="AI Chat"
            subtitle="Your executive assistant — ask anything"
            action={
              <div className="flex items-center gap-2">
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
                <WeatherWidget />
              </div>
            }
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
          {messages.length === 0 && !pendingText && (
            <div className="flex flex-col items-center justify-center text-center py-8 sm:py-14 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/80 to-indigo-800 flex items-center justify-center mb-5 shadow-glow ring-1 ring-violet-400/30">
                <Sparkles size={28} className="text-amber-300" />
              </div>
              <h3 className="text-xl font-semibold text-ink mb-2">How can I help you today?</h3>
              <p className="text-ink-secondary text-sm mb-8 leading-relaxed">
                Emails, calendar, tasks, sales, documents, and more — just ask.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {suggestions.map(({ text, color }) => (
                  <button
                    key={text}
                    disabled={sending}
                    onClick={() => handleSend(text)}
                    className={`px-4 py-3 text-left text-sm glass-panel rounded-2xl transition-all ring-1 ring-white/10 hover:bg-white/12 ${color} disabled:opacity-50 disabled:cursor-not-allowed text-ink-secondary hover:text-ink`}
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

        <div className="border-t border-white/10 shrink-0 bg-black/10">
          <ChatInput onSend={handleSend} disabled={sending} />
        </div>
      </div>
    </div>
  );
}
