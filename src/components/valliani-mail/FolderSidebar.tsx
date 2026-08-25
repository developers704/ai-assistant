"use client";

import {
  AlarmClock,
  Archive,
  Clock,
  FileEdit,
  Inbox,
  LogOut,
  PenSquare,
  Send,
  ShieldAlert,
  Star,
  Trash2,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_MAIL_FOLDER,
  SCHEDULED_FOLDER,
  SNOOZED_FOLDER,
  STARRED_FOLDER,
  type MailFolder,
  type MailSummary,
} from "@/lib/valliani-mail/types";

function folderIcon(path: string): LucideIcon {
  const p = path.toLowerCase();
  if (p === "inbox") return Inbox;
  if (p === STARRED_FOLDER || p.includes("star") || p.includes("flag")) {
    return Star;
  }
  if (p === SCHEDULED_FOLDER || p.includes("schedule")) return Clock;
  if (p === SNOOZED_FOLDER || p.includes("snooze")) return AlarmClock;
  if (p === ALL_MAIL_FOLDER || p.includes("all")) return Layers;
  if (p.includes("sent")) return Send;
  if (p.includes("draft")) return FileEdit;
  if (p.includes("archive")) return Archive;
  if (p.includes("junk") || p.includes("spam")) return ShieldAlert;
  if (p.includes("trash")) return Trash2;
  return Inbox;
}

export function FolderSidebar({
  folders,
  summary,
  selectedFolder,
  userEmail,
  onSelect,
  onCompose,
  onLogout,
  className,
}: {
  folders: MailFolder[];
  summary: MailSummary | null;
  selectedFolder: string;
  userEmail: string;
  onSelect: (path: string) => void;
  onCompose: () => void;
  onLogout: () => void;
  className?: string;
}) {
  function unreadFor(path: string): number | undefined {
    if (!summary) return undefined;
    if (path === ALL_MAIL_FOLDER) {
      return summary.totalUnread || undefined;
    }
    const hit = summary.folders.find(
      (f) => f.path.toLowerCase() === path.toLowerCase()
    );
    return hit?.unread || undefined;
  }

  return (
    <aside
      className={cn(
        // Solid on mobile drawer so inbox text never bleeds through; slight glass on desktop.
        "flex flex-col min-h-0 overflow-y-auto p-3 border-r border-white/10",
        "bg-[#0b0f16] lg:bg-[#0a0c10]/90 lg:backdrop-blur-xl",
        className
      )}
    >
      <div className="px-1.5 pb-3">
        <h2 className="text-[22px] lg:text-xl font-bold text-white tracking-tight">
          E-Mails
        </h2>
        <p className="text-[13px] lg:text-[11px] text-white/50 mt-1 truncate">
          {userEmail}
        </p>
      </div>

      {/* Desktop compose — mobile uses bottom-right FAB */}
      <button
        type="button"
        onClick={onCompose}
        className="mb-3 hidden lg:flex items-center justify-center gap-2 rounded-2xl bg-sky-700/90 hover:bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        <PenSquare size={16} />
        Compose
      </button>

      <p className="px-2.5 pb-1.5 text-[11px] lg:text-[10px] uppercase tracking-wider text-white/40 font-semibold">
        Folders
      </p>
      <div className="space-y-1 lg:space-y-0.5 flex-1">
        {folders.map((folder) => {
          const Icon = folderIcon(folder.path);
          const active =
            selectedFolder.toLowerCase() === folder.path.toLowerCase();
          const unread = unreadFor(folder.path);
          return (
            <button
              key={folder.path}
              type="button"
              onClick={() => onSelect(folder.path)}
              className={cn(
                "w-full flex items-center gap-3 lg:gap-2.5 rounded-xl px-3 lg:px-2.5 py-3 lg:py-2 text-[16px] lg:text-[13px] transition-colors",
                active
                  ? "bg-sky-500/25 text-sky-100 font-semibold ring-1 ring-sky-400/40"
                  : "text-white/75 hover:bg-white/5 hover:text-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.25 : 1.75}
                className={cn(
                  "shrink-0 lg:hidden",
                  active ? "text-sky-300" : "opacity-90"
                )}
              />
              <Icon
                size={16}
                strokeWidth={active ? 2.25 : 1.75}
                className={cn(
                  "shrink-0 hidden lg:block",
                  active ? "text-sky-300" : "opacity-80"
                )}
              />
              <span className="flex-1 text-left truncate">{folder.name}</span>
              {unread ? (
                <span
                  className={cn(
                    "text-[13px] lg:text-[11px] font-semibold tabular-nums",
                    active ? "text-sky-200" : "text-sky-300"
                  )}
                >
                  {unread}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="mt-3 flex items-center gap-2.5 rounded-xl px-3 lg:px-2.5 py-3 lg:py-2 text-[15px] lg:text-[13px] text-white/50 hover:text-rose-300 hover:bg-white/5"
      >
        <LogOut size={17} className="lg:hidden" />
        <LogOut size={15} className="hidden lg:block" />
        Sign out of mailbox
      </button>
    </aside>
  );
}
