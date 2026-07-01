"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { formatRelativeTime } from "@/lib/utils";
import { sortEmails } from "@/lib/email-utils";
import { toEmailPreview } from "@/lib/email-html";
import { EmailBody } from "@/components/email/EmailBody";
import type { ChatMessage, Email } from "@/types";
import { Mail, Reply, Star, AlertCircle, Link2, Loader2, Bot, X, Inbox } from "lucide-react";

export default function EmailPage() {
  const { state, sendChat, confirmAction, rejectAction, loading } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<ChatMessage | null>(null);

  if (!state) return null;

  const googleConnected = state.integrations?.google?.connected ?? false;
  const emails = sortEmails(state.emails);
  const selected = emails.find((e) => e.id === selectedId);
  const urgentCount = emails.filter((e) => e.category === "urgent").length;
  const needsReplyCount = emails.filter((e) => e.needsReply).length;
  const unreadCount = emails.filter((e) => !e.isRead).length;
  const showAssistant = assistantBusy || !!assistantMessage;

  const runAssistant = async (message: string) => {
    setAssistantBusy(true);
    setAssistantMessage(null);
    try {
      const result = await sendChat(message);
      if (result) setAssistantMessage(result);
    } finally {
      setAssistantBusy(false);
    }
  };

  const handleDraftReply = async (email: Email) => {
    await runAssistant(`Draft a reply to ${email.from} about "${email.subject}"`);
  };

  const handleFollowUp = async (email: Email) => {
    await runAssistant(`Create a follow-up reminder for email from ${email.from}`);
  };

  const categoryBadge = (cat: string) => {
    switch (cat) {
      case "urgent":
        return <Badge variant="danger">Urgent</Badge>;
      case "important":
        return <Badge variant="warning">Important</Badge>;
      case "promotional":
        return <Badge variant="default">Promo</Badge>;
      default:
        return null;
    }
  };

  const assistantPanel = (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <p className="text-sm font-semibold text-ink flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/25">
            <Bot size={14} className="text-violet-300" />
          </span>
          Assistant
        </p>
        {assistantMessage && !assistantBusy && (
          <button
            type="button"
            onClick={() => setAssistantMessage(null)}
            className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-white/10"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
        {assistantBusy ? (
          <p className="text-sm text-ink-muted flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-violet-300 shrink-0" />
            Working on your request…
          </p>
        ) : assistantMessage ? (
          <ChatBubble
            message={assistantMessage}
            onConfirm={async () => {
              await confirmAction();
              setAssistantMessage(null);
            }}
            onReject={async () => {
              await rejectAction();
              setAssistantMessage(null);
            }}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-4rem)]">
      <div className="glass-panel-strong rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10 shrink-0">
          <PageHeader
            title="Email Assistant"
            subtitle={
              googleConnected
                ? `${unreadCount} unread · ${urgentCount} urgent · ${needsReplyCount} need reply · Gmail connected`
                : `${urgentCount} urgent · ${needsReplyCount} need reply · demo inbox`
            }
            action={
              <div className="flex items-center gap-2">
                {googleConnected && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full ring-1 ring-emerald-400/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                )}
                <Button size="sm" disabled={assistantBusy} onClick={() => runAssistant("Summarize my inbox")}>
                  {assistantBusy ? <Loader2 size={14} className="animate-spin" /> : <Inbox size={14} />}
                  Summarize Inbox
                </Button>
              </div>
            }
          />

          {!googleConnected && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ring-amber-400/20 bg-amber-500/10">
              <p className="text-sm text-ink-secondary">
                Connect Gmail in Settings to see your real inbox instead of demo emails.
              </p>
              <Link href="/settings">
                <Button size="sm" variant="outline">
                  <Link2 size={14} /> Connect Gmail
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 px-5 sm:px-6 py-4">
          {loading && googleConnected && emails.length === 0 ? (
            <Card className="h-full flex flex-col items-center justify-center text-ink-muted text-sm gap-3">
              <Loader2 size={24} className="animate-spin text-blue-300" />
              Loading Gmail inbox…
            </Card>
          ) : emails.length === 0 ? (
            <Card className="h-full flex flex-col items-center justify-center text-center">
              <Mail size={40} className="text-ink-muted mb-3" />
              <p className="text-ink-secondary">Inbox is empty</p>
              <p className="text-sm text-ink-muted mt-1">New messages will appear here when they arrive.</p>
            </Card>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
              <aside className="lg:w-72 xl:w-80 shrink-0 flex flex-col min-h-0 max-h-[34vh] lg:max-h-none">
                <p className="text-xs text-ink-muted px-1 mb-2 shrink-0">
                  Sorted: unread & important first, then newest
                </p>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                  {emails.map((email) => (
                    <Card
                      key={email.id}
                      hover
                      className={`p-3.5 cursor-pointer transition-all ${
                        selectedId === email.id
                          ? "ring-2 ring-violet-400/50 bg-white/10"
                          : !email.isRead
                            ? "bg-white/6 ring-1 ring-white/10"
                            : "opacity-90"
                      }`}
                      onClick={() => setSelectedId(email.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p
                          className={`text-sm truncate ${!email.isRead ? "font-semibold text-ink" : "font-medium text-ink-secondary"}`}
                        >
                          {email.from}
                        </p>
                        <span className="text-[11px] text-ink-muted flex-shrink-0">
                          {formatRelativeTime(email.receivedAt)}
                        </span>
                      </div>
                      <p className={`text-sm truncate mb-1 ${!email.isRead ? "text-ink" : "text-ink-secondary"}`}>
                        {email.subject}
                      </p>
                      {email.preview && (
                        <p className="text-xs text-ink-muted line-clamp-1 mb-2">
                          {toEmailPreview(email.preview)}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {categoryBadge(email.category)}
                        {email.needsReply && <Badge variant="info">Needs Reply</Badge>}
                        {email.isImportant && !email.needsReply && email.category !== "important" && (
                          <Star size={13} className="text-amber-400" />
                        )}
                        {!email.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-auto" title="Unread" />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </aside>

              <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-4 min-h-0">
                <section className="flex-1 min-w-0 flex flex-col min-h-0">
                  {selected ? (
                    <Card className="flex-1 flex flex-col min-h-0 overflow-hidden p-0">
                      <div className="px-5 pt-5 pb-4 border-b border-white/10 shrink-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-ink leading-snug">{selected.subject}</h2>
                            <p className="text-sm text-ink-secondary mt-1 truncate">
                              {selected.from} &lt;{selected.fromEmail}&gt;
                            </p>
                            <p className="text-xs text-ink-muted mt-1">{formatRelativeTime(selected.receivedAt)}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                            {categoryBadge(selected.category)}
                            {selected.needsReply && <Badge variant="info">Needs Reply</Badge>}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                        <EmailBody
                          body={selected.body}
                          bodyHtml={selected.bodyHtml}
                          preview={selected.preview}
                        />
                      </div>

                      <div className="px-5 py-4 border-t border-white/10 flex gap-2 flex-wrap shrink-0 bg-black/10">
                        <Button size="sm" disabled={assistantBusy} onClick={() => handleDraftReply(selected)}>
                          <Reply size={14} /> Draft Reply
                        </Button>
                        {selected.needsReply && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={assistantBusy}
                            onClick={() => handleFollowUp(selected)}
                          >
                            <AlertCircle size={14} /> Set Follow-up
                          </Button>
                        )}
                      </div>
                    </Card>
                  ) : (
                    <Card className="flex-1 flex flex-col items-center justify-center text-center min-h-[240px]">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20 ring-1 ring-blue-400/25 mb-4">
                        <Mail size={28} className="text-blue-300" />
                      </span>
                      <p className="text-ink font-medium">Select an email to view details</p>
                      <p className="text-sm text-ink-muted mt-1 max-w-xs">
                        Or use Summarize Inbox to get an overview of what needs attention.
                      </p>
                    </Card>
                  )}

                  {showAssistant && (
                    <Card className="lg:hidden mt-4 p-4 ring-1 ring-violet-400/20 max-h-[38vh] shrink-0">
                      {assistantPanel}
                    </Card>
                  )}
                </section>

                {showAssistant && (
                  <aside className="hidden lg:flex lg:w-72 xl:w-80 shrink-0 flex-col min-h-0">
                    <Card className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 ring-1 ring-violet-400/20">
                      {assistantPanel}
                    </Card>
                  </aside>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
