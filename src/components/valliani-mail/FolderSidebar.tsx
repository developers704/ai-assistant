"use client";

import {
  Archive,
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
  STARRED_FOLDER,
  type MailFolder,
  type MailSummary,
} from "@/lib/valliani-mail/types";

function folderIcon(path: string): LucideIcon {
  const p = path.toLowerCase();
  if (p === "inbox") return Inbox;
  if (p === STARRED_FOLDER || p.includes("star")) return Star;
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
        "flex flex-col min-h-0 overflow-y-auto p-3 border-r border-white/10 bg-[#0a0c10]/80",
        className
      )}
    >
      <div className="px-1 pb-3">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Valliani Mail
        </h2>
        <p className="text-[11px] text-white/40 mt-0.5 truncate">{userEmail}</p>
      </div>

      <button
        type="button"
        onClick={onCompose}
        className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-sky-700/90 hover:bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        <PenSquare size={16} />
        Compose
      </button>

      <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-white/35 font-semibold">
        Folders
      </p>
      <div className="space-y-0.5 flex-1">
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
                "w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors",
                active
                  ? "bg-white/10 text-white font-semibold"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={16} strokeWidth={1.75} className="shrink-0 opacity-80" />
              <span className="flex-1 text-left truncate">{folder.name}</span>
              {unread ? (
                <span className="text-[11px] font-semibold text-sky-300 tabular-nums">
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
        className="mt-3 flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-white/45 hover:text-rose-300 hover:bg-white/5"
      >
        <LogOut size={15} />
        Sign out of mailbox
      </button>
    </aside>
  );
}
