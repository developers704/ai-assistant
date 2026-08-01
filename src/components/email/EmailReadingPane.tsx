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
  X,
  Flag,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";

export function EmailReadingPane({
  email,
  onClose,
  onReply,
  onAction,
  busy,
}: {
  email: Email;
  onClose?: () => void;
  onReply: () => void;
  onAction: (
    action: "star" | "unstar" | "archive" | "trash" | "mark_read" | "mark_unread"
  ) => void;
  busy?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const conversation =
    email.threadMessages && email.threadMessages.length > 0
      ? email.threadMessages
      : [email];
  const bucket = email.inboxBucket;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#0b1018]">
      <div className="shrink-0 sticky top-0 z-10 border-b border-white/10 px-4 sm:px-6 py-4 bg-[#0f1520]/92 backdrop-blur-md">
        <div className="flex items-start gap-3">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden mt-1 p-1.5 rounded-lg text-white/50 hover:bg-white/10"
              aria-label="Back"
            >
              <X size={18} />
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-semibold text-white leading-snug break-words tracking-tight">
              {email.subject || "(no subject)"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {bucket ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/65 ring-1 ring-white/10">
                  <Flag size={11} className="text-sky-300/80" />
                  {bucketLabel(bucket)}
                </span>
              ) : null}
              <span className="text-[11px] text-white/40">
                {conversation.length} message
                {conversation.length === 1 ? "" : "s"} ·{" "}
                {formatRelativeTime(email.receivedAt)}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={onReply}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-400 disabled:opacity-40 shadow-md shadow-sky-500/20"
            >
              <Reply size={15} />
              Reply
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction("archive")}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/[0.06] text-white/75 text-sm font-medium ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
            >
              <CheckCircle2 size={15} />
              Archive
            </button>
            <div className="relative">
              <button
                type="button"
                disabled={busy}
                onClick={() => setMoreOpen((v) => !v)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-white/[0.06] text-white/60 ring-1 ring-white/10 hover:bg-white/10"
                aria-label="More actions"
              >
                <MoreHorizontal size={16} />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-20 w-44 rounded-xl bg-[#151d2e] ring-1 ring-white/15 shadow-xl py-1 overflow-hidden">
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
                    icon={email.isRead ? <Mail size={14} /> : <MailOpen size={14} />}
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
              )}
            </div>
          </div>
        </div>

        {/* Mobile action row */}
        <div className="mt-3 flex sm:hidden flex-wrap gap-1.5">
          <ToolBtn label="Reply" onClick={onReply} disabled={busy} icon={<Reply size={14} />} primary />
          <ToolBtn
            label="Archive"
            onClick={() => onAction("archive")}
            disabled={busy}
            icon={<Archive size={14} />}
          />
          <ToolBtn
            label={email.isStarred ? "Unstar" : "Star"}
            onClick={() => onAction(email.isStarred ? "unstar" : "star")}
            disabled={busy}
            icon={
              <Star
                size={14}
                className={email.isStarred ? "fill-amber-300 text-amber-300" : undefined}
              />
            }
          />
          <ToolBtn
            label="Delete"
            onClick={() => onAction("trash")}
            disabled={busy}
            icon={<Trash2 size={14} />}
            danger
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 sm:px-5 py-4 space-y-4">
        {conversation.map((msg, idx) => {
          const isYou =
            /valliani|kash@/i.test(msg.fromEmail) || /kash/i.test(msg.from);
          return (
            <article
              key={msg.id}
              className={cn(
                "rounded-2xl overflow-hidden ring-1 shadow-sm",
                isYou
                  ? "ring-cyan-400/20 bg-cyan-500/[0.06]"
                  : "ring-white/[0.08] bg-white/[0.03]"
              )}
            >
              <div className="flex items-start gap-3 px-4 sm:px-5 py-3 border-b border-white/[0.06]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/25 text-sky-100 text-[11px] font-semibold">
                  {initials(msg.from)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {msg.from}
                    {isYou && (
                      <span className="ml-1.5 text-[10px] font-medium text-cyan-300/80">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-white/40 truncate">{msg.fromEmail}</p>
                </div>
                <p className="text-[10px] text-white/40 shrink-0 tabular-nums pt-1">
                  {formatRelativeTime(msg.receivedAt)}
                </p>
              </div>
              <EmailBody body={msg.body} bodyHtml={msg.bodyHtml} preview={msg.preview} />
              {idx < conversation.length - 1 && (
                <p className="px-4 py-2 text-[10px] text-white/35 border-t border-white/[0.05]">
                  Continued in thread
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
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
        "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
        danger
          ? "text-rose-300 hover:bg-rose-500/10"
          : "text-white/75 hover:bg-white/[0.06]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ToolBtn({
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
          ? "bg-sky-500 text-white hover:bg-sky-400"
          : danger
            ? "text-rose-300 hover:bg-rose-500/10"
            : "text-white/65 hover:bg-white/[0.07]"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
