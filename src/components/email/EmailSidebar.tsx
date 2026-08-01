"use client";

import { cn } from "@/lib/utils";
import type { InboxBucket, MailFolder } from "@/lib/email-buckets";
import { bucketLabel } from "@/lib/email-buckets";
import {
  Inbox,
  Star,
  Send,
  PenSquare,
  MessageSquareWarning,
  Eye,
  Megaphone,
} from "lucide-react";

export type EmailNavId = MailFolder | InboxBucket;

type Counts = Partial<Record<EmailNavId, number>>;

const FOLDERS: { id: MailFolder; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
];

const BUCKETS: { id: InboxBucket; icon: typeof Eye }[] = [
  { id: "to_respond", icon: MessageSquareWarning },
  { id: "fyi", icon: Eye },
  { id: "marketing", icon: Megaphone },
];

export function EmailSidebar({
  active,
  counts,
  onSelect,
  onCompose,
  className,
}: {
  active: EmailNavId;
  counts: Counts;
  onSelect: (id: EmailNavId) => void;
  onCompose: () => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex flex-col gap-1 p-2 sm:p-3 border-r border-white/10 bg-black/20 min-h-0",
        className
      )}
    >
      <button
        type="button"
        onClick={onCompose}
        className="mb-2 flex items-center justify-center gap-2 rounded-2xl bg-violet-500/25 ring-1 ring-violet-400/35 px-3 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/35 transition-colors"
      >
        <PenSquare size={16} />
        Compose
      </button>

      <p className="px-2 pt-1 text-[10px] uppercase tracking-wider text-white/35 font-semibold">
        Mail
      </p>
      {FOLDERS.map(({ id, label, icon: Icon }) => (
        <NavBtn
          key={id}
          active={active === id}
          label={label}
          count={counts[id]}
          icon={<Icon size={15} />}
          onClick={() => onSelect(id)}
        />
      ))}

      <p className="px-2 pt-3 text-[10px] uppercase tracking-wider text-white/35 font-semibold">
        AI triage
      </p>
      {BUCKETS.map(({ id, icon: Icon }) => (
        <NavBtn
          key={id}
          active={active === id}
          label={bucketLabel(id)}
          count={counts[id]}
          icon={<Icon size={15} />}
          onClick={() => onSelect(id)}
        />
      ))}
    </aside>
  );
}

function NavBtn({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors",
        active
          ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/30"
          : "text-white/55 hover:bg-white/[0.05] hover:text-white/80"
      )}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {count != null && count > 0 ? (
        <span className="tabular-nums text-[11px] text-white/40">{count}</span>
      ) : null}
    </button>
  );
}
