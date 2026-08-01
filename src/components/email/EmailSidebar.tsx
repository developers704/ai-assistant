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
  FileEdit,
  ShoppingBag,
  Briefcase,
  Tag,
} from "lucide-react";

export type EmailNavId = MailFolder | InboxBucket;

type Counts = Partial<Record<EmailNavId, number>>;

const FOLDERS: { id: MailFolder; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileEdit },
];

const TRIAGE: { id: InboxBucket; icon: typeof Eye }[] = [
  { id: "to_respond", icon: MessageSquareWarning },
  { id: "fyi", icon: Eye },
  { id: "marketing", icon: Megaphone },
];

const CATEGORIES: { id: InboxBucket; icon: typeof ShoppingBag }[] = [
  { id: "purchases", icon: ShoppingBag },
  { id: "travel", icon: Briefcase },
];

export function EmailSidebar({
  active,
  counts,
  onSelect,
  onCompose,
  className,
  title,
  subtitle,
}: {
  active: EmailNavId;
  counts: Counts;
  onSelect: (id: EmailNavId) => void;
  onCompose: () => void;
  className?: string;
  /** Optional header shown above Compose (desktop). */
  title?: string;
  subtitle?: string;
}) {
  return (
    <aside
      className={cn(
        "flex flex-col gap-0.5 p-3 border-r border-white/10 bg-[#0a0c10]/80 min-h-0 overflow-y-auto",
        className
      )}
    >
      {(title || subtitle) && (
        <div className="px-1 pb-3 pt-0.5">
          {title ? (
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="text-[11px] text-white/40 mt-0.5 truncate">{subtitle}</p>
          ) : null}
        </div>
      )}

      <button
        type="button"
        onClick={onCompose}
        className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-[#5b4a8a] hover:bg-[#6b59a0] px-3 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-violet-900/30"
      >
        <PenSquare size={16} />
        Compose
      </button>

      <p className="px-2.5 pt-1 pb-1 text-[10px] uppercase tracking-wider text-white/35 font-semibold">
        Mail
      </p>
      {FOLDERS.map(({ id, label, icon: Icon }) => (
        <NavBtn
          key={id}
          active={active === id}
          label={label}
          count={counts[id]}
          icon={<Icon size={16} strokeWidth={1.75} />}
          onClick={() => onSelect(id)}
        />
      ))}

      <p className="px-2.5 pt-4 pb-1 text-[10px] uppercase tracking-wider text-white/35 font-semibold">
        AI triage
      </p>
      {TRIAGE.map(({ id, icon: Icon }) => (
        <NavBtn
          key={id}
          active={active === id}
          label={bucketLabel(id)}
          count={counts[id]}
          icon={<Icon size={16} strokeWidth={1.75} />}
          onClick={() => onSelect(id)}
        />
      ))}

      <p className="px-2.5 pt-4 pb-1 text-[10px] uppercase tracking-wider text-white/35 font-semibold flex items-center gap-1.5">
        <Tag size={11} className="opacity-70" />
        Categories
      </p>
      {CATEGORIES.map(({ id, icon: Icon }) => (
        <NavBtn
          key={id}
          active={active === id}
          label={bucketLabel(id)}
          count={counts[id]}
          icon={<Icon size={16} strokeWidth={1.75} />}
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
        "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors",
        active
          ? "bg-[#5b4a8a] text-white shadow-md shadow-violet-900/25"
          : "text-white/60 hover:bg-white/[0.05] hover:text-white/85"
      )}
    >
      <span className={cn("shrink-0", active ? "opacity-100" : "opacity-80")}>
        {icon}
      </span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {count != null && count > 0 ? (
        <span
          className={cn(
            "tabular-nums text-[11px] shrink-0",
            active ? "text-white/70" : "text-white/40"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
