"use client";

import type { Email } from "@/types";
import { formatRelativeTime, cn } from "@/lib/utils";
import { toEmailPreview } from "@/lib/email-html";
import { bucketLabel, initials } from "@/lib/email-buckets";
import type { InboxBucket } from "@/lib/email-buckets";
import { Star, MessagesSquare } from "lucide-react";

const AVATAR_TONES = [
  "bg-sky-500/35 text-sky-100",
  "bg-violet-500/35 text-violet-100",
  "bg-amber-500/35 text-amber-100",
  "bg-emerald-500/35 text-emerald-100",
  "bg-rose-500/35 text-rose-100",
  "bg-cyan-500/35 text-cyan-100",
];

function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  return AVATAR_TONES[h];
}

function bucketPillClass(bucket: InboxBucket): string {
  switch (bucket) {
    case "to_respond":
      return "bg-orange-400/20 text-orange-200 ring-1 ring-orange-400/25";
    case "fyi":
      return "bg-amber-500/15 text-amber-200/90 ring-1 ring-amber-400/20";
    case "marketing":
      return "bg-white/8 text-white/45 ring-1 ring-white/10";
    case "purchases":
      return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25";
    case "travel":
      return "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/25";
    default:
      return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20";
  }
}

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
      <div className="p-10 text-center text-sm text-white/40">
        No messages in this view.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto min-h-0 flex-1 p-2 sm:p-3 space-y-2">
      {emails.map((email) => {
        const active =
          selectedId === email.id || selectedId === email.threadId;
        const count = email.messageCount ?? email.threadMessages?.length ?? 1;
        const bucket = email.inboxBucket;
        const preview = email.preview ? toEmailPreview(email.preview) : "";
        const needsReply = bucket === "to_respond";

        return (
          <div
            key={email.threadId || email.id}
            className={cn(
              "group relative rounded-2xl transition-all duration-200",
              active
                ? "bg-[#151d2e] ring-1 ring-sky-400/35 shadow-[0_8px_28px_-12px_rgba(56,189,248,0.35)] scale-[1.01]"
                : "bg-white/[0.035] ring-1 ring-white/[0.06] hover:bg-white/[0.055] hover:ring-white/10 hover:shadow-lg hover:shadow-black/20"
            )}
          >
            <button
              type="button"
              className="w-full text-left p-3 sm:p-3.5"
              onClick={() => onSelect(email)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                    avatarTone(email.from)
                  )}
                >
                  {initials(email.from)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "text-[13px] truncate",
                        !email.isRead
                          ? "font-semibold text-white"
                          : "font-medium text-white/75"
                      )}
                    >
                      {email.from}
                    </span>
                    {!email.isRead && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400"
                        title="Unread"
                      />
                    )}
                    {count > 1 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-white/40 shrink-0">
                        <MessagesSquare size={10} />
                        {count}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-white/40 shrink-0 tabular-nums pl-2">
                      {formatRelativeTime(email.receivedAt)}
                    </span>
                  </div>

                  {bucket && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                          bucketPillClass(bucket)
                        )}
                      >
                        {bucketLabel(bucket)}
                      </span>
                    </div>
                  )}

                  <p
                    className={cn(
                      "mt-1 text-[13px] line-clamp-1 leading-snug",
                      !email.isRead ? "text-white/90 font-medium" : "text-white/65"
                    )}
                  >
                    {email.subject || "(no subject)"}
                  </p>

                  {preview ? (
                    <p className="mt-0.5 text-[12px] text-white/40 line-clamp-2 leading-relaxed">
                      {preview}
                    </p>
                  ) : null}

                  {needsReply && (
                    <p className="mt-2 text-[11px] text-rose-300/90 font-medium">
                      Draft{" "}
                      <span className="font-normal text-white/45">
                        — AI will reply in your voice when you open this
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </button>

            <button
              type="button"
              className="absolute bottom-2.5 right-2.5 p-1.5 rounded-lg text-white/25 hover:text-amber-200 hover:bg-white/5 opacity-70 group-hover:opacity-100"
              aria-label={email.isStarred ? "Unstar" : "Star"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(email);
              }}
            >
              <Star
                size={14}
                className={
                  email.isStarred ? "fill-amber-300 text-amber-300" : undefined
                }
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
