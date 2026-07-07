import { NextResponse } from "next/server";
import {
  getAllStores,
  getStoreSummary,
  isStoreDirectoryAvailable,
  loadStoreDirectory,
} from "@/lib/stores/store-directory";
import { mockStores, getStoreStats } from "@/lib/mock-data";

export async function GET() {
  if (isStoreDirectoryAvailable()) {
    const dir = loadStoreDirectory();
    const stores = getAllStores();
    const summary = getStoreSummary();

    return NextResponse.json({
      source: "synced",
      lastSyncedAt: dir.lastSyncedAt,
      sourceUrl: dir.sourceUrl,
      stores,
      stats: { total: stores.length, open: summary.openNow, openingSoon: summary.openingSoon, byState: summary.byState },
      overview: summary,
    });
  }

  const stats = getStoreStats();
  return NextResponse.json({ source: "mock", stores: mockStores, stats });
}
