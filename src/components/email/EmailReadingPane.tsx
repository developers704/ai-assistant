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
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";

export function EmailReadingPane({
  email,
  onClose,
  onReply,
  onAction,
  busy,
  showTriage = true,
}: {
  email: Email;
  onClose?: () => void;
  onReply: () => void;
  onAction: (
    action: "star" | "unstar" | "archive" | "trash" | "mark_read" | "mark_unread"
  ) => void;
  busy?: boolean;
  showTriage?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const conversation =
    email.threadMessages && email.threadMessages.length > 0
      ? email.threadMessages
      : [email];
  const bucket = showTriage ? email.inboxBucket : undefined;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-[#0d121c]">
      <header className="shrink-0 border-b border-white/[0.06] px-4 sm:px-6 py-3.5 bg-[#10161f]/95">
        <div className="flex items-start gap-3">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden mt-0.5 p-1.5 rounded-lg text-white/45 hover:bg-white/10"
              aria-label="Back"
            >
              <X size={18} />
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-xl font-semibold text-white/95 leading-snug break-words tracking-tight">
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

          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <IconAction
              label="Reply"
              disabled={busy}
              onClick={onReply}
              primary
              icon={<Reply size={15} />}
            />
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

        <div className="mt-2.5 flex sm:hidden gap-1.5">
          <IconAction label="Reply" onClick={onReply} disabled={busy} primary icon={<Reply size={14} />} />
          <IconAction label="Archive" onClick={() => onAction("archive")} disabled={busy} icon={<Archive size={14} />} />
          <IconAction
            label="Delete"
            onClick={() => onAction("trash")}
            disabled={busy}
            danger
            icon={<Trash2 size={14} />}
          />
        </div>
      </header>

      <div
        data-email-scroll
        className="flex-1 min-h-0 h-0 overflow-y-auto overscroll-y-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {conversation.map((msg) => {
          const isYou =
            /valliani|kash@/i.test(msg.fromEmail) || /kash/i.test(msg.from);
          return (
            <section
              key={msg.id}
              className="border-b border-white/[0.05] last:border-b-0"
            >
              <div className="flex items-center gap-3 px-4 sm:px-6 pt-4 pb-2">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    isYou
                      ? "bg-[#2a4a55] text-cyan-100"
                      : "bg-[#2a3548] text-white/80"
                  )}
                >
                  {initials(msg.from)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white/90 truncate">
                    {msg.from}
                    {isYou ? (
                      <span className="ml-1.5 text-[10px] font-normal text-cyan-300/70">
                        you
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-white/35 truncate">{msg.fromEmail}</p>
                </div>
                <p className="text-[11px] text-white/35 shrink-0 tabular-nums">
                  {formatRelativeTime(msg.receivedAt)}
                </p>
              </div>
              <div className="px-4 sm:px-6 pb-5 pt-1">
                <EmailBody
                  body={msg.body}
                  bodyHtml={msg.bodyHtml}
                  preview={msg.preview}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
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
      <span className="hidden sm:inline">{label}</span>
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
