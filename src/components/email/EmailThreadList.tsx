"use client";

import type { Email } from "@/types";
import { formatRelativeTime, cn } from "@/lib/utils";
import { toEmailPreview } from "@/lib/email-html";
import { bucketLabel, initials } from "@/lib/email-buckets";
import { Star, MessagesSquare } from "lucide-react";

export function EmailThreadList({
  emails,
  selectedId,
  onSelect,
  onToggleStar,
  loading,
}: {
  emails: Email[];
  selectedId: string | null;
  onSelect: (email: Email) => void;
  onToggleStar: (email: Email) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="p-6 text-sm text-white/40 animate-pulse">Loading mail…</div>
    );
  }

  if (!emails.length) {
    return (
      <div className="p-8 text-center text-sm text-white/40">
        No messages in this view.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.06] overflow-y-auto min-h-0 flex-1">
      {emails.map((email) => {
        const active =
          selectedId === email.id || selectedId === email.threadId;
        const count = email.messageCount ?? email.threadMessages?.length ?? 1;
        const bucket = email.inboxBucket;
        return (
          <div
            key={email.threadId || email.id}
            className={cn(
              "group flex items-stretch gap-0 transition-colors",
              active
                ? "bg-violet-500/15"
                : !email.isRead
                  ? "bg-white/[0.04]"
                  : "hover:bg-white/[0.03]"
            )}
          >
            <button
              type="button"
              className="px-2 sm:px-3 self-center text-amber-300/80 hover:text-amber-200"
              aria-label={email.isStarred ? "Unstar" : "Star"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(email);
              }}
            >
              <Star
                size={15}
                className={email.isStarred ? "fill-amber-300 text-amber-300" : "text-white/25"}
              />
            </button>
            <button
              type="button"
              className="flex-1 min-w-0 text-left px-1 py-2.5 sm:py-3 pr-3"
              onClick={() => onSelect(email)}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    !email.isRead
                      ? "bg-violet-500/30 text-violet-100"
                      : "bg-white/10 text-white/50"
                  )}
                >
                  {initials(email.from)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "text-[13px] truncate",
                        !email.isRead
                          ? "font-semibold text-ink"
                          : "font-medium text-ink-secondary"
                      )}
                    >
                      {email.from}
                    </span>
                    <span className="text-[10px] text-ink-muted shrink-0 tabular-nums">
                      {formatRelativeTime(email.receivedAt)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-[13px] line-clamp-1 leading-snug",
                      !email.isRead ? "text-ink font-medium" : "text-ink-secondary"
                    )}
                  >
                    {email.subject}
                  </p>
                  {email.preview ? (
                    <p className="text-xs text-ink-muted line-clamp-1 mt-0.5">
                      {toEmailPreview(email.preview)}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {count > 1 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-white/45">
                        <MessagesSquare size={10} />
                        {count}
                      </span>
                    )}
                    {bucket && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          bucket === "to_respond"
                            ? "bg-sky-500/15 text-sky-200"
                            : bucket === "marketing"
                              ? "bg-white/5 text-white/40"
                              : bucket === "purchases"
                                ? "bg-amber-500/15 text-amber-200"
                                : bucket === "travel"
                                  ? "bg-cyan-500/15 text-cyan-200"
                                  : "bg-emerald-500/10 text-emerald-200/80"
                        )}
                      >
                        {bucketLabel(bucket)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
