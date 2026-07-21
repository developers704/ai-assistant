"use client";

import Image from "next/image";
import { Instagram, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatCount, type IgAccount, type IgStatus } from "./types";

export function InstagramAccountHeader({
  account,
  status,
}: {
  account: IgAccount | null;
  status: IgStatus | null;
}) {
  if (!account || !status?.connected) {
    return (
      <div className="rounded-2xl ring-1 ring-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.08] via-white/[0.02] to-amber-500/[0.05] p-5 sm:p-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <span className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full ring-2 ring-white/15 bg-black/30">
            <Instagram className="text-fuchsia-300/70" size={30} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold text-ink">Instagram Business</h2>
              <Badge variant="warning">Not connected</Badge>
            </div>
            <p className="text-sm text-ink-secondary mt-1">
              No Instagram account linked. Add Valliani Meta credentials to connect.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl ring-1 ring-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.08] via-white/[0.02] to-amber-500/[0.05] p-5 sm:p-6">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="relative shrink-0">
          <span className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full ring-2 ring-fuchsia-400/40 bg-black/30 overflow-hidden">
            {account.profilePictureUrl ? (
              <Image
                src={account.profilePictureUrl}
                alt={account.username}
                width={80}
                height={80}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <Instagram className="text-fuchsia-300" size={30} />
            )}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-semibold text-ink truncate">
              @{account.username}
            </h2>
            <BadgeCheck size={16} className="text-sky-300" />
            <Badge variant="success">Connected</Badge>
          </div>
          {account.name && <p className="text-sm text-ink-secondary mt-0.5">{account.name}</p>}

          <div className="flex items-center gap-5 mt-3">
            <div>
              <span className="text-base font-bold text-ink tabular-nums">
                {formatCount(account.followersCount)}
              </span>
              <span className="text-xs text-ink-muted ml-1.5">followers</span>
            </div>
            <div>
              <span className="text-base font-bold text-ink tabular-nums">
                {formatCount(account.mediaCount)}
              </span>
              <span className="text-xs text-ink-muted ml-1.5">posts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
