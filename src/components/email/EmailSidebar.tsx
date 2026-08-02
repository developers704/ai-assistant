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
  Calendar,
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
  { id: "meeting", icon: Calendar },
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
  /** Gmail-style drawer (mobile) vs desktop rail */
  variant = "desktop",
}: {
  active: EmailNavId;
  counts: Counts;
  onSelect: (id: EmailNavId) => void;
  onCompose: () => void;
  className?: string;
  title?: string;
  subtitle?: string;
  variant?: "desktop" | "drawer";
}) {
  const isDrawer = variant === "drawer";

  return (
    <aside
      className={cn(
        "flex flex-col gap-0.5 min-h-0 overflow-y-auto",
        isDrawer
          ? "em-drawer p-2 pt-1"
          : "p-3 border-r border-white/10 bg-[#0a0c10]/80",
        className
      )}
    >
      {(title || subtitle) && !isDrawer && (
        <div className="px-1 pb-3 pt-0.5">
          {title ? (
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="text-[11px] text-white/40 mt-0.5 truncate">{subtitle}</p>
          ) : null}
        </div>
      )}

      {isDrawer ? (
        <p className="px-4 pt-2 pb-3 text-[22px] font-normal text-white tracking-tight">
          Mail
        </p>
      ) : (
        <button
          type="button"
          onClick={onCompose}
          className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-[#5b4a8a] hover:bg-[#6b59a0] px-3 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-violet-900/30"
        >
          <PenSquare size={16} />
          Compose
        </button>
      )}

      {!isDrawer ? <SectionLabel isDrawer={false}>Mail</SectionLabel> : null}
      {FOLDERS.map(({ id, label, icon: Icon }) => (
        <NavBtn
          key={id}
          active={active === id}
          label={label}
          count={counts[id]}
          icon={<Icon size={isDrawer ? 20 : 16} strokeWidth={1.75} />}
          onClick={() => onSelect(id)}
          isDrawer={isDrawer}
        />
      ))}

      <SectionLabel isDrawer={isDrawer}>AI triage</SectionLabel>
      {TRIAGE.map(({ id, icon: Icon }) => (
        <NavBtn
          key={id}
          active={active === id}
          label={bucketLabel(id)}
          count={counts[id]}
          icon={<Icon size={isDrawer ? 20 : 16} strokeWidth={1.75} />}
          onClick={() => onSelect(id)}
          isDrawer={isDrawer}
        />
      ))}

      <SectionLabel isDrawer={isDrawer} icon={<Tag size={11} className="opacity-70" />}>
        Categories
      </SectionLabel>
      {CATEGORIES.map(({ id, icon: Icon }) => (
        <NavBtn
          key={id}
          active={active === id}
          label={bucketLabel(id)}
          count={counts[id]}
          icon={<Icon size={isDrawer ? 20 : 16} strokeWidth={1.75} />}
          onClick={() => onSelect(id)}
          isDrawer={isDrawer}
        />
      ))}
    </aside>
  );
}

function SectionLabel({
  children,
  isDrawer,
  icon,
}: {
  children: React.ReactNode;
  isDrawer: boolean;
  icon?: React.ReactNode;
}) {
  if (isDrawer) {
    return (
      <p className="px-4 pt-4 pb-1.5 text-[12px] font-medium text-white/45">
        {children}
      </p>
    );
  }
  return (
    <p className="px-2.5 pt-4 pb-1 text-[10px] uppercase tracking-wider text-white/35 font-semibold flex items-center gap-1.5 first:pt-1">
      {icon}
      {children}
    </p>
  );
}

function NavBtn({
  active,
  label,
  count,
  icon,
  onClick,
  isDrawer,
}: {
  active: boolean;
  label: string;
  count?: number;
  icon: React.ReactNode;
  onClick: () => void;
  isDrawer: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center text-left transition-colors",
        isDrawer
          ? cn(
              "gap-4 mx-1 px-4 py-3 rounded-full text-[15px]",
              active
                ? "em-nav-active font-medium"
                : "text-white/85 hover:bg-white/[0.06]"
            )
          : cn(
              "gap-2.5 rounded-xl px-2.5 py-2 text-[13px]",
              active
                ? "bg-[#5b4a8a] text-white shadow-md shadow-violet-900/25"
                : "text-white/60 hover:bg-white/[0.05] hover:text-white/85"
            )
      )}
    >
      <span className={cn("shrink-0", active && !isDrawer ? "opacity-100" : "opacity-90")}>
        {icon}
      </span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {count != null && count > 0 ? (
        <span
          className={cn(
            "tabular-nums shrink-0",
            isDrawer
              ? active
                ? "text-[13px] font-medium text-[#0b1220]/70"
                : "text-[13px] text-white/50"
              : active
                ? "text-[11px] text-white/70"
                : "text-[11px] text-white/40"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
