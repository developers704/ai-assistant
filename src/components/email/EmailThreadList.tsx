"use client";

import type { Email } from "@/types";
import { formatRelativeTime, cn } from "@/lib/utils";
import { toEmailPreview } from "@/lib/email-html";
import { bucketLabel, initials } from "@/lib/email-buckets";
import type { InboxBucket } from "@/lib/email-buckets";
import { Star, MessagesSquare } from "lucide-react";

const AVATAR_TONES = [
  "bg-[#3d4f6f] text-sky-100",
  "bg-[#4a3d6f] text-violet-100",
  "bg-[#5c4a32] text-amber-100",
  "bg-[#2f4f45] text-emerald-100",
  "bg-[#5c3545] text-rose-100",
  "bg-[#2f4a55] text-cyan-100",
];

function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  return AVATAR_TONES[h];
}

function bucketPillClass(bucket: InboxBucket): string {
  switch (bucket) {
    case "to_respond":
      return "bg-orange-500/15 text-orange-200/90";
    case "fyi":
      return "bg-white/[0.06] text-white/50";
    case "marketing":
      return "bg-white/[0.04] text-white/40";
    case "purchases":
      return "bg-amber-500/12 text-amber-200/85";
    case "travel":
      return "bg-cyan-500/12 text-cyan-200/85";
    default:
      return "bg-white/[0.06] text-white/50";
  }
}

export function EmailThreadList({
  emails,
  selectedId,
  onSelect,
  onToggleStar,
  loading,
  showTriage = true,
}: {
  emails: Email[];
  selectedId: string | null;
  onSelect: (email: Email) => void;
  onToggleStar: (email: Email) => void;
  loading?: boolean;
  /** Hide AI triage tags/draft hints (Sent / Drafts). */
  showTriage?: boolean;
}) {
  if (loading) {
    return (
      <div className="p-8 text-sm text-white/35 animate-pulse">Loading mail…</div>
    );
  }

  if (!emails.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <p className="text-sm text-white/35">No messages here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto min-h-0 flex-1 h-0 touch-pan-y">
      {emails.map((email) => {
        const active =
          selectedId === email.id || selectedId === email.threadId;
        const count = email.messageCount ?? email.threadMessages?.length ?? 1;
        const bucket = showTriage ? email.inboxBucket : undefined;
        const preview = email.preview ? toEmailPreview(email.preview) : "";

        return (
          <div
            key={email.threadId || email.id}
            className={cn(
              "group relative flex border-b border-white/[0.04] transition-colors",
              active
                ? "bg-[#1a2235]"
                : !email.isRead
                  ? "bg-white/[0.025]"
                  : "hover:bg-white/[0.03]"
            )}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#7c6bb5]"
              />
            ) : null}

            <button
              type="button"
              className="px-2.5 self-start pt-3.5 text-white/20 hover:text-amber-200"
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

            <button
              type="button"
              className="flex-1 min-w-0 text-left py-3 pr-3"
              onClick={() => onSelect(email)}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    avatarTone(email.from)
                  )}
                >
                  {initials(email.from)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span
                      className={cn(
                        "text-[13px] truncate",
                        !email.isRead
                          ? "font-semibold text-white"
                          : "font-medium text-white/70"
                      )}
                    >
                      {email.from}
                    </span>
                    {bucket ? (
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-px text-[10px] font-medium",
                          bucketPillClass(bucket)
                        )}
                      >
                        {bucketLabel(bucket)}
                      </span>
                    ) : null}
                    {count > 1 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-white/35 shrink-0">
                        <MessagesSquare size={10} />
                        {count}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-white/35 shrink-0 tabular-nums">
                      {formatRelativeTime(email.receivedAt)}
                    </span>
                  </div>

                  <p
                    className={cn(
                      "mt-0.5 text-[13px] line-clamp-1 leading-snug",
                      !email.isRead ? "text-white/85" : "text-white/55"
                    )}
                  >
                    {email.subject || "(no subject)"}
                  </p>

                  {preview ? (
                    <p className="mt-0.5 text-[12px] text-white/35 line-clamp-1 leading-relaxed">
                      {preview}
                    </p>
                  ) : null}
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
