"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { formatRelativeTime, cn } from "@/lib/utils";
import { sortEmails } from "@/lib/email-utils";
import { toEmailPreview } from "@/lib/email-html";
import { EmailBody } from "@/components/email/EmailBody";
import type { ChatMessage, Email } from "@/types";
import {
  Mail,
  Reply,
  Star,
  AlertCircle,
  Link2,
  Loader2,
  Bot,
  X,
  Inbox,
  ChevronLeft,
} from "lucide-react";

/** Space reserved below mobile top nav + page padding */
const MOBILE_HEIGHT =
  "max-lg:h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] lg:h-[calc(100dvh-4rem)]";

export default function EmailPage() {
  const { state, sendChat, confirmAction, rejectAction, loading } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<ChatMessage | null>(null);
  const [mobileAssistantOpen, setMobileAssistantOpen] = useState(false);

  const showAssistant = assistantBusy || !!assistantMessage;

  useEffect(() => {
    if (showAssistant) setMobileAssistantOpen(true);
  }, [showAssistant]);

  if (!state) return null;

  const googleConnected = state.integrations?.google?.connected ?? false;
  const emails = sortEmails(state.emails);
  const selected = emails.find((e) => e.id === selectedId);
  const urgentCount = emails.filter((e) => e.category === "urgent").length;
  const needsReplyCount = emails.filter((e) => e.needsReply).length;
  const unreadCount = emails.filter((e) => !e.isRead).length;
  const mobileReading = !!selectedId;

  const runAssistant = async (message: string) => {
    setAssistantBusy(true);
    setAssistantMessage(null);
    setMobileAssistantOpen(true);
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

  const categoryBadge = (cat: string, small?: boolean) => {
    const size = small ? "text-[10px] px-1.5 py-0" : undefined;
    switch (cat) {
      case "urgent":
        return <Badge variant="danger" className={size}>Urgent</Badge>;
      case "important":
        return <Badge variant="warning" className={size}>Important</Badge>;
      case "promotional":
        return <Badge variant="default" className={size}>Promo</Badge>;
      default:
        return null;
    }
  };

  const assistantPanel = (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <p className="text-sm font-semibold text-ink flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/25">
            <Bot size={14} className="text-violet-300" />
          </span>
          Assistant
        </p>
        <button
          type="button"
          onClick={() => {
            setAssistantMessage(null);
            setMobileAssistantOpen(false);
          }}
          className="text-ink-muted hover:text-ink p-1.5 rounded-lg hover:bg-white/10"
          aria-label="Dismiss assistant"
        >
          <X size={16} />
        </button>
      </div>
      <div className="overflow-y-auto max-h-[40vh] lg:max-h-none">
        {assistantBusy ? (
          <p className="text-sm text-ink-muted flex items-center gap-2 py-2">
            <Loader2 size={16} className="animate-spin text-violet-300 shrink-0" />
            Working on your request…
          </p>
        ) : assistantMessage ? (
          <ChatBubble
            message={assistantMessage}
            onConfirm={async () => {
              await confirmAction();
              setAssistantMessage(null);
              setMobileAssistantOpen(false);
            }}
            onReject={async () => {
              await rejectAction();
              setAssistantMessage(null);
              setMobileAssistantOpen(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-col max-lg:-mx-3 max-lg:-mt-1 max-lg:-mb-3 lg:mx-0",
        MOBILE_HEIGHT
      )}
    >
      <div className="glass-panel-strong rounded-2xl lg:rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10">
        {/* ── Header ── */}
        <div className="px-3 sm:px-6 border-b border-white/10 shrink-0 pt-2 pb-2 sm:pt-4 sm:pb-3 lg:pt-5 lg:pb-4">
          {mobileReading ? (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="lg:hidden flex items-center gap-0.5 text-sm text-violet-300 font-medium py-1 -ml-1 mb-1 active:opacity-70"
            >
              <ChevronLeft size={22} />
              Inbox
            </button>
          ) : null}

          {!mobileReading && (
            <PageHeader
              compact
              title="Email"
              subtitle={`${unreadCount} unread · ${urgentCount} urgent · ${needsReplyCount} need reply${
                googleConnected ? " · Gmail" : ""
              }`}
              action={
                <Button
                  size="sm"
                  disabled={assistantBusy}
                  onClick={() => runAssistant("Summarize my inbox")}
                  aria-label="Summarize inbox"
                >
                  {assistantBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Inbox size={14} />
                  )}
                  <span className="hidden sm:inline ml-1">Summarize</span>
                </Button>
              }
            />
          )}

          {!googleConnected && !mobileReading && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 ring-1 ring-amber-400/20 bg-amber-500/10">
              <p className="text-xs sm:text-sm text-ink-secondary">Connect Gmail for your real inbox.</p>
              <Link href="/settings">
                <Button size="sm" variant="outline" className="shrink-0">
                  <Link2 size={14} />
                  <span className="hidden sm:inline ml-1">Connect</span>
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-hidden px-2 sm:px-6 py-2 sm:py-4">
          {loading && googleConnected && emails.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-ink-muted text-sm gap-3">
              <Loader2 size={24} className="animate-spin text-blue-300" />
              Loading Gmail inbox…
            </div>
          ) : emails.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <Mail size={36} className="text-ink-muted mb-3" />
              <p className="text-ink-secondary font-medium">Inbox is empty</p>
              <p className="text-sm text-ink-muted mt-1">New messages will appear here.</p>
            </div>
          ) : (
            <div className="flex h-full min-h-0 lg:flex-row lg:gap-4">
              {/* Inbox — full screen on phone when nothing selected */}
              <aside
                className={cn(
                  "flex flex-col min-h-0",
                  mobileReading ? "hidden lg:flex lg:w-72 xl:w-80 lg:shrink-0" : "flex-1 lg:w-72 xl:w-80 lg:shrink-0"
                )}
              >
                <div className="flex-1 overflow-y-auto overscroll-y-contain space-y-2 pr-0.5 min-h-0">
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      type="button"
                      className={cn(
                        "w-full text-left rounded-2xl p-3 transition-all active:scale-[0.99] ring-1",
                        selectedId === email.id
                          ? "ring-violet-400/50 bg-white/10"
                          : !email.isRead
                            ? "ring-white/10 bg-white/[0.06]"
                            : "ring-white/5 bg-white/[0.03] opacity-90"
                      )}
                      onClick={() => setSelectedId(email.id)}
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span
                          className={cn(
                            "text-sm truncate min-w-0",
                            !email.isRead ? "font-semibold text-ink" : "font-medium text-ink-secondary"
                          )}
                        >
                          {email.from}
                        </span>
                        <span className="text-[10px] text-ink-muted shrink-0">
                          {formatRelativeTime(email.receivedAt)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-sm line-clamp-2 leading-snug",
                          !email.isRead ? "text-ink" : "text-ink-secondary"
                        )}
                      >
                        {email.subject}
                      </p>
                      {email.preview && (
                        <p className="text-xs text-ink-muted line-clamp-1 mt-1">
                          {toEmailPreview(email.preview)}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {categoryBadge(email.category, true)}
                        {email.needsReply && (
                          <Badge variant="info" className="text-[10px] px-1.5 py-0">
                            Reply
                          </Badge>
                        )}
                        {!email.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-auto" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              {/* Reading pane — full screen on phone when email open */}
              <section
                className={cn(
                  "flex-1 min-w-0 flex flex-col min-h-0",
                  !mobileReading && "hidden lg:flex"
                )}
              >
                {selected ? (
                  <div className="flex flex-col flex-1 min-h-0 rounded-2xl ring-1 ring-white/10 bg-black/10 overflow-hidden">
                    {/* Subject bar */}
                    <div className="px-3 sm:px-5 py-3 border-b border-white/10 shrink-0">
                      <h2 className="text-[15px] sm:text-lg font-semibold text-ink leading-snug break-words">
                        {selected.subject}
                      </h2>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <div className="min-w-0">
                          <p className="text-sm text-ink-secondary truncate">{selected.from}</p>
                          <p className="text-[11px] text-ink-muted truncate">{selected.fromEmail}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {categoryBadge(selected.category, true)}
                        </div>
                      </div>
                      <p className="text-[11px] text-ink-muted mt-1">
                        {formatRelativeTime(selected.receivedAt)}
                      </p>
                    </div>

                    {/* Scrollable body — extra bottom pad for voice FAB */}
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 sm:px-5 py-3 pb-20 lg:pb-4">
                      <EmailBody
                        body={selected.body}
                        bodyHtml={selected.bodyHtml}
                        preview={selected.preview}
                      />
                    </div>

                    {/* Sticky actions */}
                    <div
                      className="shrink-0 px-3 sm:px-5 py-2.5 border-t border-white/10 bg-black/30 backdrop-blur-md flex gap-2"
                      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
                    >
                      <Button
                        size="sm"
                        disabled={assistantBusy}
                        onClick={() => handleDraftReply(selected)}
                        className="flex-1 sm:flex-none"
                      >
                        <Reply size={14} /> Reply
                      </Button>
                      {selected.needsReply && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={assistantBusy}
                          onClick={() => handleFollowUp(selected)}
                        >
                          <AlertCircle size={14} />
                          <span className="hidden sm:inline ml-1">Follow-up</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center">
                    <Mail size={28} className="text-blue-300 mb-3" />
                    <p className="text-ink font-medium">Select an email</p>
                  </div>
                )}
              </section>

              {/* Desktop assistant sidebar */}
              {showAssistant && (
                <aside className="hidden lg:flex lg:w-72 xl:w-80 shrink-0 flex-col min-h-0">
                  <Card className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 ring-1 ring-violet-400/20">
                    {assistantPanel}
                  </Card>
                </aside>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile assistant bottom sheet */}
      {showAssistant && mobileAssistantOpen && (
        <>
          <button
            type="button"
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            aria-label="Close assistant"
            onClick={() => setMobileAssistantOpen(false)}
          />
          <div
            className="lg:hidden fixed inset-x-0 bottom-0 z-50 glass-panel-strong rounded-t-2xl ring-1 ring-violet-400/30 shadow-elevated p-4 max-h-[70vh] overflow-y-auto"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {assistantPanel}
          </div>
        </>
      )}
    </div>
  );
}
