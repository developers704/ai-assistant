"use client";

import type { Email } from "@/types";
import { formatRelativeTime, cn } from "@/lib/utils";
import { EmailBody } from "@/components/email/EmailBody";
import { bucketLabel, initials } from "@/lib/email-buckets";
import {
  Archive,
  Trash2,
  Star,
  MailOpen,
  Mail,
  Reply,
  Forward,
  ChevronLeft,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { RealtimeVoiceButton } from "@/components/voice/RealtimeVoiceButton";

export function EmailReadingPane({
  email,
  onClose,
  onReply,
  onForward,
  onAction,
  busy,
  showTriage = true,
}: {
  email: Email;
  onClose?: () => void;
  onReply: () => void;
  onForward?: () => void;
  onAction: (
    action: "star" | "unstar" | "archive" | "trash" | "mark_read" | "mark_unread"
  ) => void;
  busy?: boolean;
  showTriage?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const conversation =
    email.threadMessages && email.threadMessages.length > 0
      ? email.threadMessages
      : [email];
  const bucket = showTriage ? email.inboxBucket : undefined;
  const latest = conversation[conversation.length - 1] ?? email;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-[#0d121c] max-lg:bg-[var(--em-bg,#0a1628)]">
      {/* Mobile Gmail-style top actions */}
      <div className="lg:hidden shrink-0 flex items-center gap-0.5 px-1.5 py-1.5 border-b border-white/[0.06] bg-[var(--em-surface,#0e1a2e)] safe-area-top">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full text-white/70 hover:bg-white/10"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
        ) : null}
        <div className="flex-1" />
        <RealtimeVoiceButton variant="inline" className="mr-0.5" />
        <IconBtn
          label="Archive"
          disabled={busy}
          onClick={() => onAction("archive")}
          icon={<Archive size={20} />}
        />
        <IconBtn
          label="Delete"
          disabled={busy}
          onClick={() => onAction("trash")}
          icon={<Trash2 size={20} />}
        />
        <IconBtn
          label={email.isRead ? "Mark unread" : "Mark read"}
          disabled={busy}
          onClick={() => onAction(email.isRead ? "mark_unread" : "mark_read")}
          icon={email.isRead ? <Mail size={20} /> : <MailOpen size={20} />}
        />
        <div className="relative">
          <IconBtn
            label="More"
            disabled={busy}
            onClick={() => setMoreOpen((v) => !v)}
            icon={<MoreHorizontal size={20} />}
          />
          {moreOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setMoreOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl bg-[#161c28] ring-1 ring-white/10 shadow-xl py-1 overflow-hidden">
                <MoreItem
                  label={email.isStarred ? "Unstar" : "Star"}
                  onClick={() => {
                    setMoreOpen(false);
                    onAction(email.isStarred ? "unstar" : "star");
                  }}
                  icon={
                    <Star
                      size={14}
                      className={
                        email.isStarred
                          ? "fill-amber-300 text-amber-300"
                          : undefined
                      }
                    />
                  }
                />
                <MoreItem
                  label="Reply"
                  onClick={() => {
                    setMoreOpen(false);
                    onReply();
                  }}
                  icon={<Reply size={14} />}
                />
                {onForward ? (
                  <MoreItem
                    label="Forward"
                    onClick={() => {
                      setMoreOpen(false);
                      onForward();
                    }}
                    icon={<Forward size={14} />}
                  />
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop header */}
      <header className="hidden lg:block shrink-0 border-b border-white/[0.06] px-6 py-3.5 bg-[#10161f]/95">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white/95 leading-snug break-words tracking-tight">
              {email.subject || "(no subject)"}
            </h2>
            <p className="mt-1 text-[12px] text-white/40">
              {bucket ? (
                <>
                  <span className="text-white/55">{bucketLabel(bucket)}</span>
                  <span className="mx-1.5 text-white/20">·</span>
                </>
              ) : null}
              {conversation.length} message
              {conversation.length === 1 ? "" : "s"}
              <span className="mx-1.5 text-white/20">·</span>
              {formatRelativeTime(email.receivedAt)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <IconAction
              label="Reply"
              disabled={busy}
              onClick={onReply}
              primary
              icon={<Reply size={15} />}
            />
            {onForward ? (
              <IconAction
                label="Forward"
                disabled={busy}
                onClick={onForward}
                icon={<Forward size={15} />}
              />
            ) : null}
            <IconAction
              label="Archive"
              disabled={busy}
              onClick={() => onAction("archive")}
              icon={<Archive size={15} />}
            />
            <div className="relative">
              <button
                type="button"
                disabled={busy}
                onClick={() => setMoreOpen((v) => !v)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-40"
                aria-label="More"
              >
                <MoreHorizontal size={16} />
              </button>
              {moreOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close menu"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl bg-[#161c28] ring-1 ring-white/10 shadow-xl py-1 overflow-hidden">
                    <MoreItem
                      label={email.isStarred ? "Unstar" : "Star"}
                      onClick={() => {
                        setMoreOpen(false);
                        onAction(email.isStarred ? "unstar" : "star");
                      }}
                      icon={
                        <Star
                          size={14}
                          className={
                            email.isStarred
                              ? "fill-amber-300 text-amber-300"
                              : undefined
                          }
                        />
                      }
                    />
                    <MoreItem
                      label={email.isRead ? "Mark unread" : "Mark read"}
                      onClick={() => {
                        setMoreOpen(false);
                        onAction(email.isRead ? "mark_unread" : "mark_read");
                      }}
                      icon={
                        email.isRead ? <Mail size={14} /> : <MailOpen size={14} />
                      }
                    />
                    <MoreItem
                      label="Delete"
                      danger
                      onClick={() => {
                        setMoreOpen(false);
                        onAction("trash");
                      }}
                      icon={<Trash2 size={14} />}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div
        data-email-scroll
        className="flex-1 min-h-0 h-0 overflow-y-auto overscroll-y-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Mobile subject + star */}
        <div className="lg:hidden px-4 pt-3 pb-1">
          <div className="flex items-start gap-2">
            <h2 className="flex-1 min-w-0 text-[1.35rem] font-normal text-white/95 leading-snug break-words tracking-tight">
              {email.subject || "(no subject)"}
            </h2>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction(email.isStarred ? "unstar" : "star")}
              className="p-1.5 rounded-full text-white/40 hover:bg-white/10 shrink-0 mt-0.5"
              aria-label={email.isStarred ? "Unstar" : "Star"}
            >
              <Star
                size={20}
                className={
                  email.isStarred ? "fill-amber-300 text-amber-300" : undefined
                }
              />
            </button>
          </div>
          {bucket ? (
            <span className="inline-flex mt-2 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50 ring-1 ring-white/[0.08]">
              {bucketLabel(bucket)}
            </span>
          ) : null}
        </div>

        {conversation.map((msg, idx) => {
          const isYou =
            /valliani|kash@/i.test(msg.fromEmail) || /kash/i.test(msg.from);
          const isLatest = idx === conversation.length - 1;
          return (
            <section
              key={msg.id}
              className="border-b border-white/[0.05] last:border-b-0"
            >
              <div className="flex items-start gap-3 px-4 sm:px-6 pt-4 pb-2">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                    isYou
                      ? "bg-[#2a4a55] text-cyan-100"
                      : "bg-[#5b4a8a]/80 text-violet-100"
                  )}
                >
                  {initials(msg.from)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[14px] font-medium text-white/90 truncate">
                      {msg.from}
                    </p>
                    <p className="text-[11px] text-white/35 shrink-0 tabular-nums">
                      {formatRelativeTime(msg.receivedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRecipients((v) => (isLatest ? !v : v))}
                    className="flex items-center gap-1 text-[12px] text-white/40 mt-0.5"
                  >
                    <span className="truncate">
                      to me
                      {msg.to ? `, ${shortTo(msg.to)}` : ""}
                    </span>
                    <ChevronDown size={14} className="shrink-0 opacity-60" />
                  </button>
                  {showRecipients && isLatest && (
                    <div className="mt-2 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2 text-[11px] text-white/50 space-y-1">
                      <p>
                        <span className="text-white/30 w-10 inline-block">From</span>
                        {msg.from} &lt;{msg.fromEmail}&gt;
                      </p>
                      {msg.to ? (
                        <p>
                          <span className="text-white/30 w-10 inline-block">To</span>
                          {msg.to}
                        </p>
                      ) : null}
                      {msg.cc ? (
                        <p>
                          <span className="text-white/30 w-10 inline-block">Cc</span>
                          {msg.cc}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
                {/* Per-message reply on mobile like Gmail */}
                <div className="lg:hidden flex items-center gap-0.5 shrink-0 -mr-1">
                  <button
                    type="button"
                    onClick={onReply}
                    className="p-2 rounded-full text-white/45 hover:bg-white/10"
                    aria-label="Reply"
                  >
                    <Reply size={18} />
                  </button>
                </div>
              </div>
              <div className="px-4 sm:px-6 pb-5 pt-1">
                <EmailBody
                  body={msg.body}
                  bodyHtml={msg.bodyHtml}
                  preview={msg.preview}
                  attachments={msg.attachments}
                />
              </div>
            </section>
          );
        })}

        {/* Spacer so bottom bar doesn't cover last lines */}
        <div className="h-24 lg:hidden" aria-hidden />
      </div>

      {/* Mobile Gmail-style Reply / Forward bar — Alexa cyan pills */}
      <div className="lg:hidden shrink-0 border-t border-white/[0.06] bg-[var(--em-surface,#0e1a2e)]/95 backdrop-blur-md px-4 py-3 safe-area-bottom">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onReply}
            className="em-reply-pill flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full text-[14px] font-semibold active:scale-[0.98] transition disabled:opacity-40"
          >
            <Reply size={18} />
            Reply
          </button>
          <button
            type="button"
            disabled={busy || !onForward}
            onClick={onForward}
            className="em-reply-pill flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full text-[14px] font-semibold active:scale-[0.98] transition disabled:opacity-40"
          >
            <Forward size={18} />
            Forward
          </button>
        </div>
        <p className="sr-only">
          Latest from {latest.from}
        </p>
      </div>
    </div>
  );
}

function shortTo(to: string): string {
  const parts = to.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    const m = parts[0]?.match(/^(.+?)\s*</);
    return (m?.[1] || parts[0] || "").replace(/"/g, "").slice(0, 24);
  }
  return parts
    .slice(0, 2)
    .map((p) => {
      const m = p.match(/^(.+?)\s*</);
      return (m?.[1] || p.split("@")[0] || p).replace(/"/g, "").slice(0, 12);
    })
    .join(", ");
}

function IconBtn({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-2.5 rounded-full text-white/65 hover:bg-white/10 disabled:opacity-40"
    >
      {icon}
    </button>
  );
}

function IconAction({
  label,
  icon,
  onClick,
  disabled,
  primary,
  danger,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40",
        primary
          ? "bg-[#5b4a8a] text-white hover:bg-[#6b59a0]"
          : danger
            ? "text-rose-300/90 hover:bg-rose-500/10"
            : "text-white/55 hover:bg-white/[0.06] hover:text-white/85"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MoreItem({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors",
        danger
          ? "text-rose-300 hover:bg-rose-500/10"
          : "text-white/70 hover:bg-white/[0.05]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
