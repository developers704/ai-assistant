"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { LushEmpty, LushPanel } from "@/components/layout/PageShell";
import {
  Inbox,
  Send,
  ChevronLeft,
  AlertCircle,
  Loader2,
  BadgeCheck,
} from "lucide-react";
import {
  formatIgTime,
  type IgConversation,
  type IgMessage,
} from "./types";

async function getJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (body as { error?: string }).error ?? "Request failed." };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "Network error reaching the server." };
  }
}

function otherParticipant(
  c: IgConversation,
  businessId?: string | null
): IgConversation["participants"][number] | null {
  const other = c.participants.find((p) => p.id !== businessId);
  return other ?? c.participants[0] ?? null;
}

export function InstagramInbox({
  businessId,
  onRefresh,
}: {
  businessId?: string | null;
  onRefresh?: () => void;
}) {
  const [conversations, setConversations] = useState<IgConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<IgConversation | null>(null);

  const [messages, setMessages] = useState<IgMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getJson<{ conversations: IgConversation[] }>(
      "/api/social/instagram/conversations"
    );
    if (res.ok && res.data) {
      setConversations(res.data.conversations);
      if (res.data.conversations.length > 0 && !selected) {
        setSelected(res.data.conversations[0]);
      }
    } else {
      setError(res.error ?? "Could not load Instagram conversations.");
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const openConversation = useCallback(async (c: IgConversation) => {
    setSelected(c);
    setMobileThread(true);
    setMessages([]);
    setMessagesError(null);
    setSendError(null);
    setDraft("");
    setMessagesLoading(true);

    const res = await getJson<{ messages: IgMessage[] }>(
      `/api/social/instagram/conversations/${encodeURIComponent(c.id)}`
    );
    if (res.ok && res.data) setMessages(res.data.messages);
    else setMessagesError(res.error ?? "Could not load messages.");
    setMessagesLoading(false);
  }, []);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, messagesLoading]);

  const handleSend = async () => {
    if (!selected) return;
    const text = draft.trim();
    if (!text) return;
    const recipient = otherParticipant(selected, businessId);
    if (!recipient) return;

    if (!pendingConfirm) {
      setPendingConfirm(true);
      return;
    }

    setPendingConfirm(false);
    setSending(true);
    setSendError(null);
    const res = await getJson<{ success: boolean; messageId: string | null }>(
      "/api/social/instagram/send-message",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: recipient.id, text }),
      }
    );

    if (res.ok && res.data) {
      setDraft("");
      // Optimistically append the sent message.
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          from: { id: businessId ?? "me", username: null },
          message: text,
          createdTime: new Date().toISOString(),
        },
      ]);
      void loadConversations();
      onRefresh?.();
    } else {
      setSendError(res.error ?? "Could not send the message.");
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-ink-muted text-sm gap-3">
        <Loader2 size={24} className="animate-spin text-fuchsia-300" />
        Loading Instagram inbox…
      </div>
    );
  }

  if (error) {
    return (
      <LushPanel className="border border-amber-400/20">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-ink">{error}</p>
            <p className="text-xs text-ink-muted mt-1">
              Enable Instagram Messaging in your Meta app and grant{" "}
              <code>instagram_manage_messages</code> + <code>pages_messaging</code>.
            </p>
          </div>
        </div>
      </LushPanel>
    );
  }

  if (conversations.length === 0) {
    return (
      <LushEmpty
        message="No Instagram DMs yet. When people message your business account, conversations will appear here."
        icon={Inbox}
      />
    );
  }

  const recipient = selected ? otherParticipant(selected, businessId) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,300px)_1fr] gap-4 lg:gap-5 min-h-[420px]">
      {/* Conversation list */}
      <aside className={cn("flex flex-col min-h-0", mobileThread ? "hidden lg:flex" : "flex")}>
        <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.02] overflow-hidden">
          <ul className="divide-y divide-white/[0.05]">
            {conversations.map((c) => {
              const other = otherParticipant(c, businessId);
              const active = selected?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void openConversation(c)}
                    className={cn(
                      "w-full text-left px-3 py-3 transition-colors",
                      active ? "bg-fuchsia-500/12" : "hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink truncate">
                        {other?.username ? `@${other.username}` : "Instagram user"}
                      </span>
                      {c.updatedTime && (
                        <span className="text-[10px] text-ink-muted shrink-0">
                          {formatIgTime(c.updatedTime).split(",")[0]}
                        </span>
                      )}
                    </div>
                    {c.snippet && (
                      <p className="text-xs text-ink-muted truncate mt-0.5">{c.snippet}</p>
                    )}
                    {(c.unreadCount ?? 0) > 0 && (
                      <span className="inline-flex mt-1 text-[10px] font-semibold text-fuchsia-200 bg-fuchsia-500/15 px-1.5 py-0.5 rounded-full">
                        {c.unreadCount} new
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Thread */}
      <section className={cn("flex flex-col min-h-0", !mobileThread && "hidden lg:flex")}>
        <div className="flex flex-col flex-1 min-h-0 rounded-2xl ring-1 ring-white/[0.08] bg-white/[0.02] overflow-hidden">
          {/* Thread header */}
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileThread(false)}
                className="lg:hidden text-fuchsia-300 -ml-1"
                aria-label="Back to conversations"
              >
                <ChevronLeft size={22} />
              </button>
              <span className="text-sm font-semibold text-ink truncate">
                {recipient?.username ? `@${recipient.username}` : "Conversation"}
              </span>
              <BadgeCheck size={14} className="text-sky-300 shrink-0" />
            </div>
            <span className="text-[10px] text-ink-muted shrink-0">Instagram DM</span>
          </div>

          {/* Messages */}
          <div ref={threadRef} className="flex-1 overflow-y-auto overscroll-y-contain px-3 sm:px-4 py-3 min-h-[200px] space-y-2.5">
            {messagesLoading ? (
              <p className="text-sm text-ink-muted text-center py-6">Loading messages…</p>
            ) : messagesError ? (
              <p className="text-sm text-amber-200/90 text-center py-6">{messagesError}</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-ink-muted text-center py-6">No messages in this conversation.</p>
            ) : (
              messages.map((m) => {
                const mine = m.from?.id === businessId;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm break-words",
                        mine
                          ? "bg-gradient-to-br from-fuchsia-500/85 to-pink-600/80 text-white rounded-br-md"
                          : "bg-white/[0.05] text-ink rounded-bl-md ring-1 ring-white/[0.06]"
                      )}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{m.message || <span className="italic opacity-70">[non-text message]</span>}</p>
                      <p className={cn("text-[10px] mt-1", mine ? "text-white/70" : "text-ink-muted")}>
                        {formatIgTime(m.createdTime)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-white/[0.06] px-3 sm:px-4 py-3 shrink-0">
            {sendError && (
              <p className="text-xs text-rose-200/90 mb-2 px-3 py-2 rounded-xl bg-rose-500/10 ring-1 ring-rose-400/20">
                {sendError}
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setPendingConfirm(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder="Write a reply…"
                className="flex-1 resize-none min-h-[44px] max-h-32 rounded-2xl px-3.5 py-2.5 text-sm bg-white/[0.04] ring-1 ring-white/[0.08] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
              />
              <Button
                size="md"
                disabled={sending || !draft.trim()}
                onClick={() => void handleSend()}
                variant={pendingConfirm ? "danger" : "primary"}
                title={pendingConfirm ? "Tap again to send to Instagram" : "Send reply"}
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {pendingConfirm ? "Confirm send" : "Send"}
              </Button>
            </div>
            <p className="text-[10px] text-ink-muted mt-2">
              {pendingConfirm
                ? "Tap Confirm send to deliver this reply to Instagram."
                : "Replies are subject to Meta's 24-hour window. Draft first, then confirm to send."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
