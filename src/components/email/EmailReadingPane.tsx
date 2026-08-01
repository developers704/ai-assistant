"use client";

import type { Email } from "@/types";
import { formatRelativeTime, cn } from "@/lib/utils";
import { EmailBody } from "@/components/email/EmailBody";
import {
  Archive,
  Trash2,
  Star,
  MailOpen,
  Mail,
  Reply,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

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
  const conversation =
    email.threadMessages && email.threadMessages.length > 0
      ? email.threadMessages
      : [email];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0 border-b border-white/10 px-3 sm:px-5 py-3 bg-white/[0.02]">
        <div className="flex items-start gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden mt-0.5 p-1.5 rounded-lg text-white/50 hover:bg-white/10"
              aria-label="Back"
            >
              <X size={18} />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] sm:text-lg font-semibold text-ink leading-snug break-words">
              {email.subject}
            </h2>
            <p className="text-[11px] text-ink-muted mt-1">
              {conversation.length} message
              {conversation.length === 1 ? "" : "s"} ·{" "}
              {formatRelativeTime(email.receivedAt)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <ToolBtn
            label="Reply"
            disabled={busy}
            onClick={onReply}
            icon={<Reply size={14} />}
            primary
          />
          <ToolBtn
            label={email.isStarred ? "Unstar" : "Star"}
            disabled={busy}
            onClick={() => onAction(email.isStarred ? "unstar" : "star")}
            icon={
              <Star
                size={14}
                className={email.isStarred ? "fill-amber-300 text-amber-300" : undefined}
              />
            }
          />
          <ToolBtn
            label="Archive"
            disabled={busy}
            onClick={() => onAction("archive")}
            icon={<Archive size={14} />}
          />
          <ToolBtn
            label={email.isRead ? "Unread" : "Read"}
            disabled={busy}
            onClick={() => onAction(email.isRead ? "mark_unread" : "mark_read")}
            icon={email.isRead ? <Mail size={14} /> : <MailOpen size={14} />}
          />
          <ToolBtn
            label="Delete"
            disabled={busy}
            onClick={() => onAction("trash")}
            icon={<Trash2 size={14} />}
            danger
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 sm:px-5 py-4 space-y-3">
        {conversation.map((msg, idx) => {
          const isLatest = idx === conversation.length - 1;
          const isYou =
            /valliani|kash@/i.test(msg.fromEmail) || /kash/i.test(msg.from);
          return (
            <article
              key={msg.id}
              className={cn(
                "rounded-2xl ring-1 p-3.5 sm:p-4",
                isLatest
                  ? "ring-violet-400/30 bg-violet-500/[0.08]"
                  : "ring-white/[0.07] bg-white/[0.03]",
                isYou && "ring-cyan-400/20 bg-cyan-500/[0.05]"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {msg.from}
                    {isYou && (
                      <span className="ml-1.5 text-[10px] font-medium text-cyan-300/80">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-ink-muted truncate">{msg.fromEmail}</p>
                </div>
                <p className="text-[10px] text-ink-muted shrink-0 tabular-nums">
                  {formatRelativeTime(msg.receivedAt)}
                </p>
              </div>
              <EmailBody body={msg.body} bodyHtml={msg.bodyHtml} preview={msg.preview} />
            </article>
          );
        })}
      </div>
    </div>
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
    <Button
      size="sm"
      variant={primary ? "primary" : "outline"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8",
        danger && "text-rose-300 border-rose-400/20 hover:bg-rose-500/10"
      )}
    >
      {icon}
      <span className="ml-1 hidden sm:inline">{label}</span>
    </Button>
  );
}
