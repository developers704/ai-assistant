import { NextResponse } from "next/server";
import {
  getAllStores,
  isStoreDirectoryAvailable,
  loadStoreDirectory,
} from "@/lib/stores/store-directory";
import { mockStores, getStoreStats } from "@/lib/mock-data";
import { readSessionFromCookies } from "@/lib/auth/session";
import type { StoreDirectoryEntry } from "@/lib/stores/types";

function summarizeStores(stores: StoreDirectoryEntry[]) {
  const byState: Record<string, number> = {};
  let openNow = 0;
  let openingSoon = 0;
  for (const s of stores) {
    const st = s.stateCode || s.state || "—";
    byState[st] = (byState[st] ?? 0) + 1;
    if (s.status === "Open") openNow++;
    else if (s.status === "Opening Soon") openingSoon++;
  }
  return { openNow, openingSoon, byState };
}

/** Stores Map — full directory for every signed-in user (DMs included). Sales stays district-scoped. */
export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isStoreDirectoryAvailable()) {
    const dir = loadStoreDirectory();
    const stores = getAllStores();
    const summary = summarizeStores(stores);

    return NextResponse.json({
      source: "synced",
      lastSyncedAt: dir.lastSyncedAt,
      sourceUrl: dir.sourceUrl,
      stores,
      stats: {
        total: stores.length,
        open: summary.openNow,
        openingSoon: summary.openingSoon,
        byState: summary.byState,
      },
      overview: summary,
    });
  }

  const stores = mockStores as unknown as StoreDirectoryEntry[];
  const stats = getStoreStats();
  return NextResponse.json({
    source: "mock",
    stores,
    stats: { ...stats, total: stores.length },
  });
}
